<script>
  import { onMount } from "svelte";

  const leaveTypeFullName = {
    AL: "Annual / Emergency",
    MC: "Medical",
    MAT: "Maternity",
    PAT: "Paternity",
    COMP_A: "Compassionate A (Parent/Child/Spouse)",
    COMP_B: "Compassionate B (Grandparent/Sibling)",
    MAR: "Marriage",
    HOSP: "Hospitalization",
    UNPAID: "Unpaid"
  };

  function formatDays(n) {
  return Number(n).toFixed(1);
}

  function getLeaveFullName(code) {
    return leaveTypeFullName[code] || code;
  }
  // =============== STATE =================
  let leaves = [];
  let filteredLeaves = [];

  let selectedStatus = "All";
  let selectedLeaveType = "All";
  let selectedMonth = "All";
  let selectedYear = "All";

  let showConfirmationModal = false;
  let leaveToCancel = null;
  let me = null;
  let currentAttachment = null;
  let newAttachmentName = "";

  // ---------- Form State (Unified Same As Leave Application Form) ----------
let modal;
let isEdit = false;
let editingUuid = null;
let originalLeaveType = null;
let leaveType = "AL";
let duration = "Full";
let dateFrom = "";
let dateUntil = "";
let totalDays = 0;
let reason = "";
let attachmentFiles = null;

const fixedDurations = {
  MAT: 98,
  PAT: 7,
  COMP_A: 3,
  COMP_B: 1,
  MAR: 3
};

const leaveTypes = [
  "All",
  "AL",
  "MC",
  "MAT",
  "PAT",
  "COMP_A",
  "COMP_B",
  "MAR",
  "HOSP",
  "UNPAID"
];


  const statuses = ["All", "Approved", "Pending", "Rejected", "Cancellation Pending"];
  const months = [
    "All", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const currentYear = new Date().getFullYear();
  const years = ["All", ...Array.from({ length: 10 }, (_, i) => currentYear - i)];
const leaveLabels = {
  AL: "Annual / Emergency",
  MC: "Medical",
  MAT: "Maternity",
  PAT: "Paternity",
  COMP_A: "Compassionate A",
  COMP_B: "Compassionate B",
  MAR: "Marriage",
  HOSP: "Hospitalization"
};
const leaveCodes = {
  "Annual / Emergency": "AL",
  "Medical": "MC",
  "Maternity": "MAT",
  "Paternity": "PAT",
  "Compassionate A": "COMP_A",
  "Compassionate B": "COMP_B",
  "Marriage": "MAR",
  "Hospitalization": "HOSP"
};


  // =========== HELPERS ============
  const fmt = (iso) =>
    new Date(iso).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

  const monthName = (iso) =>
    new Date(iso).toLocaleString("default", { month: "long" });

  const yearOf = (iso) => Number(String(iso).slice(0, 4));

  // =========== LOAD LEAVES FROM BACKEND ============
  onMount(async () => {
    try {
      // ✅ FIX 1 — Correct URL + credentials included
      const meRes = await fetch("/api/employee/me", {
        credentials: "include"
      });
      me = await meRes.json();

      // If failed to get user, do not continue
      if (!me || !me.staffId) {
        console.error("User not loaded.");
        return;
      }

      // ✅ FIX 2 — credentials required here too
      const res = await fetch("/api/leave-requests", {
        credentials: "include"
      });
      const data = await res.json();

      // Filter leaves for this logged-in staff only
      leaves = data
  .filter((l) => l.staff_id === me.staffId)
  .map(l => ({
    uuid: l.leave_id,
    id: l.staff_id,
    name: l.staff_name,
    dateFrom: l.date_from,
    dateTo: l.date_until,
    totalDays: l.total_days,
    type: l.leave_type,  // always keep AL/MC/MAT/PAT etc.
    reason: l.reason,
    duration: l.duration,
    attachment_path: l.attachment_path, 
    status:
  Number(l.total_days) === 0
    ? "Invalid"
    : l.status === "pending" ? "Pending"
    : l.status === "approved" ? "Approved"
    : l.status === "rejected" ? "Rejected"
    : l.status === "cancelled" ? "Cancelled"
    : l.status === "cancellation_pending" ? "Cancellation Pending"
    : l.status
}))

  if (sessionStorage.getItem("forceDashboardRefresh") === "true") {
        leaves = [...leaves];     // force UI to update
        sessionStorage.removeItem("forceDashboardRefresh");
      }

    } catch (err) {
      console.error("Failed to load leave history:", err);
    }
  });

  // =========== FILTERING ============
  $: filteredLeaves = leaves
    .filter((l) => {
      const m = monthName(l.dateFrom);
      const y = yearOf(l.dateFrom);

      const matchStatus = selectedStatus === "All" || l.status === selectedStatus;
      const matchMonth = selectedMonth === "All" || m === selectedMonth;
      const matchYear = selectedYear === "All" || y === Number(selectedYear);
      const matchType = selectedLeaveType === "All" || l.type === selectedLeaveType;

    return matchStatus && matchMonth && matchYear && matchType;
    })
    .sort((a, b) => (a.dateFrom < b.dateFrom ? 1 : -1));

  // =========== DELETE/CANCEL ============
  function requestCancellation(leaveItem) {
    leaveToCancel = leaveItem;
    showConfirmationModal = true;
  }

  function closeConfirmationModal() {
    leaveToCancel = null;
    showConfirmationModal = false;
  }

$: if (leaveType && dateFrom) {
  if (fixedDurations[leaveType]) {
    const days = fixedDurations[leaveType];
    const start = new Date(dateFrom);
    const end = new Date(start);
    end.setDate(start.getDate() + (days - 1));
    dateUntil = end.toISOString().slice(0, 10);
  }

  totalDays = autoCalc(leaveType, dateFrom, dateUntil, duration);
}

function autoCalc(type, from, until, duration) {
  if (!from) return 0;

  if (duration === "Half") return 0.5;

  if (fixedDurations[type]) return fixedDurations[type];

  const d1 = new Date(from);
  const d2 = new Date(until || from);
  const diff = (d2 - d1) / (1000 * 60 * 60 * 24) + 1;

  return diff > 0 ? diff : 1;
}
function handleEdit(l) {
  if (l.status !== "Pending") return;

  isEdit = true;
  editingUuid = l.uuid;
  originalLeaveType = l.type;
  leaveType = l.type;
  duration = l.totalDays === 0.5 ? "Half" : l.duration || "Full";
  currentAttachment = l.attachment_path || null;

  dateFrom = l.dateFrom.slice(0, 10);
  
  // fixed leave auto-set end date
  if (fixedDurations[leaveType]) {
    const days = fixedDurations[leaveType];
    const start = new Date(dateFrom);
    const end = new Date(start);
    end.setDate(start.getDate() + (days - 1));
    dateUntil = end.toISOString().slice(0, 10);
  } else {
    dateUntil = l.dateTo.slice(0, 10);
  }

  totalDays = autoCalc(leaveType, dateFrom, dateUntil, duration);
  reason = l.reason || "";
  currentAttachment = l.attachment_path || null;
  newAttachmentName = "";


  modal.showModal();
}

function preventTypeChange() {
  if (isEdit && leaveType !== originalLeaveType) {
    alert("Leave type changes are restricted. Kindly cancel the pending request and submit a new request.");
    leaveType = originalLeaveType; // revert back
  }
}

async function refreshDashboard() {
  if (!me) return;

  sessionStorage.setItem("forceDashboardRefresh", "true");

  // 1) Reload leaves
  const res = await fetch("/api/leave-requests", {
    credentials: "include"
  });
  const data = await res.json();

  leaves = data.filter(l => l.staff_id === me.staffId);

  // 2) 🔥 RELOAD USER PROFILE (IMPORTANT)
  const meRes2 = await fetch("/api/employee/me", { credentials: "include" });
  user = await meRes2.json();


  // 3) Force Svelte update
  leaves = [...leaves];
}

async function confirmCancellation() {
  if (!leaveToCancel) return;

  const id = leaveToCancel.uuid;

  // ---------------- PENDING → DELETE ----------------
  if (leaveToCancel.status === "Pending") {
    console.log('🔍 DELETE DEBUG:', {
      id,
      leaveToCancel,
      uuid: leaveToCancel.uuid
    });

    await fetch(`/api/leave-requests/${id}`, {
      method: "DELETE",
      credentials: "include"
    });

    window.location.reload(); 
    return;
  }

  // ---------------- APPROVED → CANCELLATION PENDING ----------------
  if (leaveToCancel.status === "Approved") {
    await fetch(`/api/leave-requests/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancellation_pending" })
    });

    window.location.reload();
    return;       // ✅ valid
  }

  alert("This leave cannot be cancelled.");
}

async function submitLeave(event) {
  event.preventDefault();

  const payload = {
    leave_type: leaveType,
    duration,
    date_from: dateFrom,
    date_until: duration === "Half" ? dateFrom : dateUntil,
    total_days: totalDays,
    reason,
    request_type: isEdit ? "update" : "new"
  };

  try {

const limitMap = {
  AL: 14,
  MC: 14,
  HOSP: 60,
  MAT: 98,
  PAT: 7,
  COMP_A: 3,
  COMP_B: 1,
  MAR: 3
};

const limit = limitMap[leaveType];

// count ALL used days (except the leave being edited)
let used = leaves
  .filter(l => l.type === leaveType)
  .filter(l => l.status === "Approved" || l.status === "Pending" || l.status === "Cancellation Pending")
  .filter(l => l.uuid !== editingUuid)   // exclude the one we are editing
  .reduce((s, l) => s + Number(l.totalDays), 0);

// check if new total exceeds limit
if (used + totalDays > limit) {
  alert(`Your ${getLeaveFullName(leaveType)} leave limit (${limit} days) has been exceeded.`);
  return;
}

if (isEdit && editingUuid) {
  const formData = new FormData();
  formData.append("leave_type", leaveType);
  formData.append("duration", duration);
  formData.append("date_from", dateFrom);
  formData.append("date_until", payload.date_until);
  formData.append("total_days", totalDays);
  formData.append("reason", reason);
  formData.append("request_type", "update");

  if (attachmentFiles && attachmentFiles.length > 0) {
    formData.append("attachment", attachmentFiles[0]);
  }

  await fetch(`http://localhost:5000/api/leave-requests/${editingUuid}/edit`, {
    method: "PATCH",
    credentials: "include",
    body: formData
  });

  await loadLeaveHistory();
  closeEditModal();
  return;
}
    // ---- NEW APPLICATION (OPTIONAL) ----
    else {
      await fetch(`/api/leave-requests`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }

    closeEditModal();

  } catch (err) {
    console.error("Error updating:", err);
  }
}

async function loadLeaveHistory() {
  try {
    if (!me || !me.staffId) return;

    const res = await fetch("/api/leave-requests", { credentials: "include" });
    const all = await res.json();  // ONLY ONE json() HERE

    leaves = all
      .filter(l => l.staff_id === me.staffId)
      .map(l => ({
        uuid: l.leave_id,
        id: l.staff_id,
        name: l.staff_name,
        dateFrom: l.date_from,
        dateTo: l.date_until,
        totalDays: l.total_days,
        type: l.leave_type,
        duration: l.duration,
        reason: l.reason,
        attachment_path: l.attachment_path,
        status:
          l.status === "pending" ? "Pending" :
          l.status === "approved" ? "Approved" :
          l.status === "rejected" ? "Rejected" :
          l.status === "cancelled" ? "Cancelled" :
          l.status === "cancellation_pending" ? "Cancellation Pending" :
          l.status
      }));

    leaves = [...leaves];
  } catch (err) {
    console.error("Failed to reload leave history:", err);
  }
}

function closeEditModal() {
  if (modal?.open) modal.close();

  isEdit = false;
  editingUuid = null;

  leaveType = "AL";
  duration = "Full";
  dateFrom = "";
  dateUntil = "";
  totalDays = 0;
  reason = "";
  attachmentFiles = null;
}


function onFromChange() {
  if (!dateFrom) return;

  // Half day → same day
  if (duration === "Half") {
    dateUntil = dateFrom;
  } 
  // Fixed duration → auto compute end date
  else if (fixedDurations[leaveType]) {
    const days = fixedDurations[leaveType];
    const start = new Date(dateFrom);
    const end = new Date(start);
    end.setDate(start.getDate() + (days - 1));
    dateUntil = end.toISOString().slice(0, 10);
  }

  // Auto-calc total
  totalDays = autoCalc(leaveType, dateFrom, dateUntil, duration);
}

function onUntilChange() {
  if (duration === "Half") return;
  totalDays = autoCalc(leaveType, dateFrom, dateUntil, duration);
}
</script>

<!-- ===== Confirmation Modal ===== -->
{#if showConfirmationModal}
  <div class="modal-backdrop">
    <div class="modal-dialog">
      <h3>Confirm Cancellation</h3>
      <p>Are you sure you want to cancel your leave application?</p>
      <div class="modal-actions">
        <button class="btn-danger" on:click={confirmCancellation}>Yes, cancel</button>
        <button class="btn-secondary" on:click={closeConfirmationModal}>No, keep it</button>
      </div>
    </div>
  </div>
{/if}

<!-- ===== FILTER BAR (Right aligned) ===== -->
<div class="filter-bar">
  <div class="filters">
    <div class="filter">
      <label>STATUS</label>
      <select bind:value={selectedStatus} aria-label="Filter by status">
        {#each statuses as s}
          <option value={s}>{s}</option>
        {/each}
      </select>
    </div>

    <div class="filter">
  <label>LEAVE TYPE</label>
  <select bind:value={selectedLeaveType} aria-label="Filter by leave type">
    {#each leaveTypes as t}
      <option value={t}>
        {t === "All" ? "All" : getLeaveFullName(t)}
      </option>
    {/each}
  </select>
</div>

    <div class="filter">
      <label>YEAR</label>
      <select bind:value={selectedYear} aria-label="Filter by year">
        {#each years as y}
          <option value={y}>{y}</option>
        {/each}
      </select>
    </div>

    <div class="filter">
      <label>MONTH</label>
      <select bind:value={selectedMonth} aria-label="Filter by month">
        {#each months as m}
          <option value={m}>{m}</option>
        {/each}
      </select>
    </div>
  </div>
</div>
<dialog bind:this={modal} class="leave-modal">

  <form class="leave-form" on:submit={submitLeave}>
    <button type="button" class="close-btn" on:click={closeEditModal}>✕</button>

    <h2 class="title">{isEdit ? "Edit Leave Application" : "Leave Application Form"}</h2>

    <!-- Leave Type -->
    <label>
      <span>Type</span>
      <select bind:value={leaveType} required on:change={preventTypeChange}>
        <option value="AL">Annual / Emergency</option>
        <option value="MC">Medical</option>
        <option value="MAT">Maternity</option>
        <option value="PAT">Paternity</option>
        <option value="COMP_A">Compassionate A (Parent/Child/Spouse)</option>
        <option value="COMP_B">Compassionate B (Grandparent/Sibling)</option>
        <option value="MAR">Marriage</option>
        <option value="HOSP">Hospitalization</option>

      </select>
    </label>

    <!-- Duration -->
    <div class="duration">
      <span>Leave Duration</span>
      <label><input type="radio" value="Full" bind:group={duration}> Full Day</label>
      <label><input type="radio" value="Half" bind:group={duration}> Half Day</label>
    </div>

   <div class="dates">
  <!-- DATE FROM -->
  <label>
    <span>Date From</span>
    <input 
      type="date" 
      bind:value={dateFrom} 
      on:change={onFromChange}
    />
  </label>

  <!-- DATE UNTIL -->
  <label>
    <span>Date Until</span>
    <input 
      type="date" 
      bind:value={dateUntil}
      on:change={onUntilChange}
      disabled={duration === "Half"}
      readonly={duration === "Half"}
    />
  </label>
</div>


    <!-- Total -->
    <label>
      <span>Total Days</span>
      <input type="number" bind:value={totalDays} readonly />
    </label>

    <!-- Reason -->
    <label>
      <span>Reason</span>
      <textarea rows="3" bind:value={reason} required></textarea>
    </label>

    <!-- Attachment -->
  <label>
  <span>Attachment</span>
  <input 
    type="file" 
    bind:files={attachmentFiles}
    on:change={() => {
      newAttachmentName = attachmentFiles?.[0]?.name || "";
    }}
  />

  {#if currentAttachment}
    <a 
      href={"http://localhost:5000/" + currentAttachment}
      target="_blank"
      class="view-attachment-btn"
    >
      View existing attachment
    </a>
  {/if}

  {#if newAttachmentName}
    <div class="new-file-label">
      New file selected: <strong>{newAttachmentName}</strong>
    </div>
  {/if}
</label>


    <button type="submit" class="submit-btn">
  {isEdit ? "SAVE" : "SUBMIT"}
</button>

  </form>
</dialog>

<!-- ===== TABLE ===== -->
<table class="leave-table">
  <thead>
    <tr>
      <th style="width:56px;">No.</th>
      <th>Staff ID</th>
      <th>Name</th>
      <th>Dates</th>
      <th class="center">Total Days</th>
      <th>Leave Type</th>
      <th>Status</th>
      <th class="actions-col">Action</th>
    </tr>
  </thead>
  <tbody>
    {#each filteredLeaves as l, i}
      <tr>
        <td>{i + 1}</td>
        <td>{l.id}</td>
        <td>{l.name}</td>
        <td>
          {fmt(l.dateFrom)}
          {#if l.dateTo !== l.dateFrom} – {fmt(l.dateTo)}{/if}
        </td>
        <td class="center">{formatDays(l.totalDays)}</td>
        <td>{getLeaveFullName(l.type)}</td>
        <td>
          <span 
            class="badge 
              {l.status.toLowerCase().replace(' ', '-')} 
              {l.status === 'Approved' && l.type === 'UNPAID' ? 'unpaid-approved' : ''}"
          >
            {l.status}
          </span>
        </td>

        <td class="center">
  <div class="action-wrapper">

    <!-- SLOT: FILE ICON -->
<div class="slot">
  {#if l.attachment_path && l.status !== 'Pending'}
    <button 
      class="icon-btn file-btn {l.status === 'Cancelled' ? 'disabled-file' : ''}"
      title={l.status === 'Cancelled' ? "Attachment disabled" : "View Attachment"}
      on:click={() => {
        if (l.status !== "Cancelled") {
          window.open("http://localhost:5000/" + l.attachment_path, "_blank");
        }
      }}
    >
      <svg viewBox="0 0 26 26">
        <path 
          fill="currentColor"
          d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 8V3.5L19.5 9H15a1 1 0 0 1-1-1z"
        />
      </svg>
    </button>
  {/if}
</div>

    
    <!-- FIXED SLOT: Pencil (Pending only) -->
    <div class="slot">
      {#if l.status === 'Pending'}
        <button class="icon-btn pencil-btn" title="Edit" on:click={() => handleEdit(l)}>
          <svg viewBox="0 0 24 24">
            <path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0L15 4.6l3.7 3.7 2-1.3z"/>
          </svg>
        </button>
      {/if}
    </div>

    <!-- FIXED SLOT: Trash (Pending + Approved) -->
    <div class="slot">
      {#if l.status === 'Pending' || l.status === 'Approved'}
        <button class="icon-btn delete" on:click={() => requestCancellation(l)}>
          <svg viewBox="0 0 24 24">
            <path d="M6 7h12v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7zm3-4h6l1 1h4v2H4V4h4l1-1z"/>
          </svg>
        </button>
      {/if}
    </div>

  </div>
</td>

      </tr>
    {/each}
  </tbody>
</table>

<style>
  /* ===== FILTER BAR ===== */
  .filter-bar {
    display: flex;
    justify-content: flex-end; /* push filters to the right */
    padding-right: 20px;  
    margin-bottom: 1rem;
  }
  .filters {
    display: flex;
    gap: 1.25rem;
    align-items: end;
  }
  .filter label {
    display: block;
    font-size: 12px;
    font-weight: 700;
    color: white; /* as requested: white label text */
    margin-bottom: 4px;
  }
  .filter select {
    padding: 6px 10px;
    border-radius: 9999px;
    border: 1px solid #d1d5db;
    font-size: 14px;
    background: #fff;
  }

  /* ===== TABLE ===== */
  table.leave-table {
    width: 97%;
    margin: 0 auto;
    border-collapse: collapse;
    background: #f9fafb;
    border-radius: 10px;
    overflow: hidden;
    font-size: 14px;
  }
  thead {
    background: #f1f5f9;
    text-align: left;
    font-weight: 700;
    color: #0f172a;
  }
  th, td {
    padding: 10px 12px;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: middle;
  }
  tbody tr:hover {
    background: #f3f4f6;
  }
  .center {
    text-align: center;
  }
  .actions-col {
    width: 80px;
    text-align: center;
  }

  /* ===== STATUS BADGES ===== */
  .badge {
    padding: 4px 10px;
    border-radius: 9999px;
    font-weight: 600;
    font-size: 12px;
    display: inline-block;
  }
  .badge.approved { background: #dcfce7; color: #166534; border-color:#cbeee3;}
  .badge.pending  { background: #fef9c3; color: #92400e; border-color:#f5e1b7;}
  .badge.rejected { background: #fee2e2; color: #991b1b; border-color:#f3c2c2; }
  .badge.cancelled {background:#f1f5f9; color:#475569; border-color:#e2e8f0;}
  .badge.cancellation-pending { background: #fef08a; color: #854d0e; border-color: #fddc63;}
/* === SPECIAL COLOR FOR APPROVED UNPAID LEAVE === */
.badge.unpaid-approved {
  background: #ffe7bb;    /* soft orange / light gold */
  color: #b45309;         /* darker amber text */
  border: 1px solid #f5c66c;
}
.badge.invalid {
  background: #a5a5a7;
  color: #ffff;
  border: 1px  #cbd5e1;
}

  /* ===== ACTION BUTTON ===== */
  .delete-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    color: #217859;
    padding: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
  }
  .delete-btn:hover {
    background: #dcfce7;
    color: #166534;
  }
  .delete-btn svg {
    width: 18px;
    height: 18px;
  }

  .file-btn svg {
  width: 10px;
  height: 10px;
  color: #217859; /* SAME GREEN AS TRASH */
  margin-left: 80px;
  margin-top: 0.7px;
}

.disabled-file {
  opacity: 0.35 !important;
  cursor: not-allowed !important;
  pointer-events: none !important;
}

.pencil-btn{
  margin-left: 14px;
}

  /* ===== MODAL ===== */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: grid;
    place-items: center;
    z-index: 100;
  }
  .modal-dialog {
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    width: min(400px, 90vw);
    text-align: center;
  }
  .modal-dialog h3 { 
    margin: 0 0 0.5rem; 
    color: #49bdb3;
    font-size: 26px;
  }
  .modal-dialog p { margin: 0 0 1.5rem; color: #4b5563; }
  .modal-actions {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
  }
  .modal-actions button {
    border: none;
    border-radius: 8px;
    padding: 0.6rem 1rem;
    font-weight: 600;
    cursor: pointer;
    font-size: 14px;
  }
  .btn-secondary { background: #e5e7eb; color: #1f2937; }
  .btn-danger { background: #ef4444; color: white; }

.action-wrapper {
  display: flex;
  justify-content: center;
  gap: 4px;
  align-items: center;
}

.slot {
  width: 28px;               /* kunci lebar setiap slot */
  display: flex;
  justify-content: center;
}

.icon-btn {
  background: transparent;
  border: none;
  padding: 4px;
  cursor: pointer;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon-btn svg {
  width: 18px;
  height: 18px;
  fill: #217859;
}

.icon-btn:hover {
  background: #dcfce7;
}
/* ===============================
   LEAVE APPLICATION FORM (MATCH UI)
   =============================== */

 /* Modal Styles */
  .leave-modal {
    border: 1px solid var(--ring);
    border-radius: 12px;
    box-shadow: var(--shadow);
    padding: 0;
    max-width: 500px;
    width: 90%;
  }
  .leave-modal::backdrop {
    background: rgba(0,0,0,0.2);
    backdrop-filter: blur(2px);
  }
  .leave-form {
    padding: 18px 22px 22px;
    display: grid;
    gap: 12px;
  }
  .leave-form .title { margin: 0 0 4px; }
  .leave-form label {
    display: grid;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
  }
  .leave-form input, .leave-form select, .leave-form textarea {
    font-size: 14px;
    font-weight: 400;
    border: 1px solid var(--ring);
    border-radius: 8px;
    padding: 8px 10px;
  }
  .leave-form input[required]:invalid, .leave-form textarea[required]:invalid {
    border-color: #ef4444;
  }
  
  /* --- Keep radios inline/left without changing their markup position --- */
  .leave-form .duration {
    display: flex;
    flex-direction: column;
    gap: .5rem;
    align-items: flex-start;
  }
  .leave-form .duration label {
    display: inline-flex;
    flex-direction: row;
    align-items: center;
    gap: .5rem;
    cursor: pointer;
    text-align: left;
    font-weight: 400; /* label weight normal */
  }
  .leave-form .duration input[type="radio"] {
    accent-color: #3FADA4; /* slightly darker than #49bdb3 */
    width: 16px;
    height: 16px;
    margin: 0;
  }

  /* Greyed-out look for locked fields */
  .leave-form input[readonly],
  .leave-form input:disabled {
    background:#f3f4f6;
    color:#6b7280;
    cursor:not-allowed;
  }

  /* helper text */
  .help { color:#6b7280; font-size:12px; display:block; margin-top:4px; font-weight: 400; }
  .help.warn { color:#b45309; }
  
  .submit-btn {
    background: #3FADA4;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 10px 14px;
    cursor: pointer;
    font-weight: 700;
    font-size: 14px;
    margin-top: 8px;
  }
  .submit-btn:hover { opacity: .9; }
  
  .close-btn{ 
    position:absolute; 
    right:10px; top:8px; 
    border:none; background:transparent; 
    font-size:20px; 
    cursor:pointer; 
    padding: 4px;
  }

  .new-file-label {
    margin-top: 4px;
    font-size: 12px;
    color: #0f172a;
  }

  .view-attachment-btn {
    display: inline-block;
    margin-top: 6px;
    font-size: 13px;
    color: #2563eb;
    text-decoration: underline;
    cursor: pointer;
  }
  .view-attachment-btn:hover {
    color: #1d4ed8;
  }


  /* ===== Responsive (keep filters usable) ===== */
  @media (max-width: 640px) {
    .filters { gap: .75rem; }
    .filter select { font-size: 13px; }
    th, td { padding: 8px 10px; }
  }
</style>