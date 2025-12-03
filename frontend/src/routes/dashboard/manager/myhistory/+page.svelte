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
    HOSP: "Hospitalization"
  };

  function getLeaveFullName(code) {
    return leaveTypeFullName[code] || code;
  }

  let leaves = [];
  let filteredLeaves = [];
  let user = null;

  let selectedStatus = "All";
  let selectedMonth = "All";
  let selectedYear = "All";
  let showEditModal = false;
  let editingLeave = null;

  let showConfirmationModal = false;
  let leaveToCancel = null;

  // ===== Edit Modal State (same as staff) =====
let modal; 
let isEdit = false;
let editingUuid = null;

// ===== Fixed leave durations (same as staff) =====
const fixedDurations = {
  MAT : 98,
  PAT : 7,
  "COMP_A": 3,
  "COMP_B": 1,
  MAR : 3
};

let leaveType = "AL";
let duration = "Full";
let dateFrom = "";
let dateUntil = "";
let totalDays = 0;
let reason = "";
let attachmentFiles = null;

// Dashboard helper functions
const atStartOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const parseLocalISO = (iso) => {
  if (!iso) return null;
  const [y,m,d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const localISO = (d) => {
  const x = atStartOfDay(d);
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
};

const diffDays = (from, until) => {
  if (!from) return 0;
  const a = atStartOfDay(from);
  const b = atStartOfDay(until || from);
  return Math.max(1, Math.floor((b - a) / 86400000) + 1);
};

const addDaysISO = (iso, days) => {
  const d = parseLocalISO(iso);
  d.setDate(d.getDate() + (days - 1));
  return localISO(d);
};

// ===== Auto-calc totalDays (same as dashboard) =====
$: {
  
  if (!dateFrom) {
    totalDays = 0;
  }
  else if (duration === "Half") {
    totalDays = 0.5;
    dateUntil = dateFrom;
  }
  else if (fixedDurations[leaveType]) {
    totalDays = fixedDurations[leaveType];
    dateUntil = addDaysISO(dateFrom, totalDays);
  }
  else {
    totalDays = diffDays(parseLocalISO(dateFrom), parseLocalISO(dateUntil || dateFrom));
  }
}

  const statuses = ["All", "Approved", "Pending", "Rejected", "Cancellation Pending"];
  const months = [
    "All", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const currentYear = new Date().getFullYear();
  const years = ["All", ...Array.from({ length: 10 }, (_, i) => currentYear - i)];

  // ===== Helpers =====
  const fmt = (iso) =>
    new Date(iso).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

  const monthName = (iso) =>
    new Date(iso).toLocaleString("default", { month: "long" });

  const yearOf = (iso) => Number(String(iso).slice(0, 4));


  // ===== LOAD MANAGER + LEAVES (MATCH STAFF LOGIC) =====
  onMount(async () => {
    try {
      // SAME AS STAFF
      const meRes = await fetch("http://localhost:5000/api/me", { credentials: "include" });
      user = { ...(await meRes.json()) };
      console.log("HOSP DATA — entitlement:", user?.hosp_entitlement, "balance:", user?.hosp_balance);
      console.log("USER:", user);

      await loadLeaveHistory();
    } catch (err) {
      console.error("Failed:", err);
    }
  });

  async function loadLeaveHistory() {
    try {
      const res = await fetch("http://localhost:5000/api/leave-requests", {
        credentials: "include"
      });
      const all = await res.json();

      // ⭐ Manager ONLY sees his own leave
        leaves = all.filter(l => l.staff_id === user.staff_id)
        .map(l => ({
          uuid: l.leave_id,
          id: l.staff_id,
          name: l.staff_name,
          dateFrom: l.date_from,
          dateTo: l.date_until,
          totalDays: l.total_days,
          type: l.leave_type,
          reason: l.reason,          // ADD THIS
          duration: l.duration,  

          status:
            l.status === "pending" ? "Pending" :
            l.status === "approved" ? "Approved" :
            l.status === "rejected" ? "Rejected" :
            l.status === "cancelled" ? "Cancelled" :
            l.status === "cancellation_pending" ? "Cancellation Pending" :
            l.status
        }));

    } catch (err) {
      console.error("Failed to load leave history:", err);
    }
  }


  // ===== FILTERING =====
$: filteredLeaves = leaves
  .filter(l => {
    const m = monthName(l.dateFrom);
    const y = yearOf(l.dateFrom);

    const matchStatus =
      selectedStatus === "All" ||
      l.status === selectedStatus;

    const matchMonth =
      selectedMonth === "All" ||
      m === selectedMonth;

    const matchYear =
      selectedYear === "All" ||
      y === Number(selectedYear);

    return matchStatus && matchMonth && matchYear;
  })
  .sort((a, b) => (a.dateFrom < b.dateFrom ? 1 : -1));



  // ===== CANCELLATION =====
  function requestCancellation(leaveItem) {
    leaveToCancel = leaveItem;
    showConfirmationModal = true;
  }

  function closeConfirmationModal() {
    leaveToCancel = null;
    showConfirmationModal = false;
  }
  function handleEdit(l) {
  if (l.status !== "Pending") return;

  isEdit = true;
  editingUuid = l.uuid;

  leaveType = l.type;
  duration = l.totalDays === 0.5 ? "Half" : l.duration || "Full";
  dateFrom = l.dateFrom.slice(0,10);
dateUntil = l.dateTo.slice(0,10);

  // Auto-set fixed leave types
  if (fixedDurations[leaveType]) {
    const days = fixedDurations[leaveType];
    const start = new Date(dateFrom);
    const end = new Date(start);
    end.setDate(start.getDate() + (days - 1));
    dateUntil = end.toISOString().slice(0, 10);
  }
  
  reason = l.reason || "";

  if (modal) modal.showModal();

}


  async function confirmCancellation() {
  if (!leaveToCancel) return;

  const status = leaveToCancel.status.toLowerCase();

  // 1) PENDING → DELETE
  if (leaveToCancel.status === "Pending") {
    await fetch(`http://localhost:5000/api/leave-requests/${leaveToCancel.uuid}`, {
      method: "DELETE",
      credentials: "include"
    });

    // remove from UI
    leaves = leaves.filter(l => String(l.uuid) !== String(leaveToCancel.uuid));

  }

  // 2) APPROVED → change to cancellation_pending
  if (status === "approved") {
    await fetch(`http://localhost:5000/api/leave-requests/${leaveToCancel.uuid}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancellation_pending" })
    });

    leaves = leaves.map(l =>
      l.uuid === leaveToCancel.uuid
        ? { ...l, status: "Cancellation Pending" }
        : l
    );
  }

  closeConfirmationModal();
  await loadLeaveHistory();
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
  request_type: "update"    // 🔥 TAMBAH LINE INI
};


  try {
    await fetch(`http://localhost:5000/api/leave-requests/${editingUuid}/edit`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    // Update UI instantly
    const idx = leaves.findIndex(x => String(x.uuid) === String(editingUuid));

    if (idx !== -1) {
      leaves[idx].type = leaveType;
      leaves[idx].dateFrom = dateFrom;
      leaves[idx].dateTo = payload.date_until;
      leaves[idx].totalDays = totalDays;
      leaves[idx].reason = reason;
      leaves = [...leaves];
    }

    closeEditModal();
  } catch (err) {
    console.error("Error updating:", err);
  }
}
function closeEditModal() {
  try {
    if (modal?.open) modal.close();
  } catch (e) {}

  isEdit = false;
  editingUuid = null;
}
function onFromChange() {
  if (!dateFrom) return;

  if (duration === "Half") {
    dateUntil = dateFrom;
    return;
  }

  if (fixedDurations[leaveType]) {
    dateUntil = addDaysISO(dateFrom, fixedDurations[leaveType]);
  }
}

function onUntilChange() {
  if (duration === "Half") return;
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
      <select bind:value={leaveType} required>
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
      <input type="file" bind:files={attachmentFiles} />
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
        <td class="center">{l.totalDays}</td>
        <td>{getLeaveFullName(l.type)}</td>

        <td>
          <span class="badge {l.status.toLowerCase().replace(' ', '-')}">{l.status}</span>
        </td>
    <td class="center">
  <div class="action-wrapper">

    <!-- SLOT 1: Pencil -->
    <div class="slot">
      {#if l.status === 'Pending'}
        <button class="icon-btn" on:click={() => handleEdit(l)} title="Edit Application">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0L15 4.59l3.75 3.75 1.96-1.3z"/>
          </svg>
        </button>
      {/if}
    </div>

    <!-- SLOT 2: Trash -->
    <div class="slot">
      {#if l.status === 'Pending' || l.status === 'Approved'}
        <button class="icon-btn delete" on:click={() => requestCancellation(l)} title="Cancel Application">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
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
  align-items: center;
  gap: 8px;
}

.slot {
  width: 24px;          /* fixed width slot */
  display: flex;
  justify-content: center;
}


.icon-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  color: #217859;
}

.icon-btn svg {
  width: 18px;
  height: 18px;
  fill: #217859;
}

.icon-btn:hover {
  background: #dcfce7;
}

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


  /* ===== Responsive (keep filters usable) ===== */
  @media (max-width: 640px) {
    .filters { gap: .75rem; }
    .filter select { font-size: 13px; }
    th, td { padding: 8px 10px; }
  }
</style>