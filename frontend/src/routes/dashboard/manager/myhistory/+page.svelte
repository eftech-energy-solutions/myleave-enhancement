<script>
  import { onMount } from "svelte";
  import { apiFetch } from '$lib/api';
  import { PUBLIC_VITE_API_BASE } from '$env/static/public';
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

  const leaveTypeShortName = {
  AL: "Annual / Emergency",
  MC: "Medical",
  MAT: "Maternity",
  PAT: "Paternity",
  COMP_A: "Compassionate A",
  COMP_B: "Compassionate B",
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

  let leaves = [];
  let filteredLeaves = [];
  let user = null;
  let cancelReason = "";
  let showCancelReason = false;


  let selectedStatus = "All";
  let selectedLeaveType = "All";
  let selectedMonth = "All";
  let selectedYear = "All";
  let showEditModal = false;
  let editingLeave = null;
  let originalLeaveType = null;

  let showConfirmationModal = false;
  let leaveToCancel = null;
  let currentAttachment = null;
  let item = null;
  let newAttachmentName = "";

  let showDetailModal = false;
  let selectedLeave = null;

  // ===== Edit Modal State (same as staff) =====
let modal; 
let isEdit = false;
let editingUuid = null;
let toast = {
  show: false,
  closing: false, 
  type: "success", // success | error | info | warning
  title: "",
  message: ""
};

function showToast(message, type = "success", title = "", duration = 3000) {
  toast = {
    show: true,
    type,
    title: title || type.charAt(0).toUpperCase() + type.slice(1),
    message
  };

 setTimeout(() => {
    toast.closing = true;          // 🆕 trigger fade out

    setTimeout(() => {
      toast.show = false;          // 🆕 buang DOM lepas animation
      toast.closing = false;
    }, 250);
  }, duration);
}

// ===== Fixed leave durations (same as staff) =====
const fixedDurations = {
  MAT : 98,
  PAT : 7,
  "COMP_A": 3,
  "COMP_B": 1,
  MAR : 3
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

// const diffDays = (from, until) => {
//   if (!from) return 0;
//   const a = atStartOfDay(from);
//   const b = atStartOfDay(until || from);
//   return Math.max(1, Math.floor((b - a) / 86400000) + 1);
// };

function autoCalc(type, from, until, duration) {
  if (!from) return 0;

  // Half day
  if (duration === "Half") return 0.5;

  // Fixed-duration leave (MAT, PAT, etc.)
  if (fixedDurations[type]) return fixedDurations[type];

  const start = new Date(from);
  const end = new Date(until || from);

  let days = 0;
  
  function isHoliday(_) {
    return false; // backend already validates
  }

  function isWeekend(date) {
    const d = date.getDay();
    return d === 0 || d === 6; // Sun or Sat
  }
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // ❌ Skip weekend
    if (isWeekend(d)) continue;

    // ❌ Skip public holiday
    if (isHoliday(d)) continue;

    days++;
  }

  return days;
}

const addDaysISO = (iso, days) => {
  const d = parseLocalISO(iso);
  d.setDate(d.getDate() + (days - 1));
  return localISO(d);
};

// ===== Auto-calc totalDays (same as dashboard) =====
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

  const statuses = ["All", "Approved", "Pending", "Rejected", "Cancellation Pending"];
  const months = [
    "All", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const START_YEAR = 2025;
  const MAX_YEARS = 5;

  const currentYear = new Date().getFullYear();

  // determine earliest year to show
  const earliestYear = Math.max(
    START_YEAR,
    currentYear - (MAX_YEARS - 1)
  );

  // build rolling list
  const years = [
    "All",
    ...Array.from(
      { length: currentYear - earliestYear + 1 },
      (_, i) => earliestYear + i
    )
  ];

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
      const meRes = await fetch(
          `${PUBLIC_VITE_API_BASE}/api/me`,
          { credentials: "include" }
        );
      user = { ...(await meRes.json()) };
      console.log("USER:", user);
      console.log("HOSP DATA — entitlement:", user?.hosp_entitlement, "balance:", user?.hosp_balance);
      console.log("USER:", user);

      await loadLeaveHistory();
    } catch (err) {
      console.error("Failed:", err);
    }
  });

async function loadLeaveHistory() {
    try {
      // 1️⃣ Ensure user profile metadata is fully parsed first
      if (!user || !user.staff_id) {
        const meRes = await fetch(`${PUBLIC_VITE_API_BASE}/api/me`, { credentials: "include" });
        user = await meRes.json();
      }

      // Convert target ID to a clean string format ("888") safely once
      const targetUserId = String(user?.staff_id || user?.id || "888").trim();

      const res = await fetch(
        `${PUBLIC_VITE_API_BASE}/api/leave-requests`,
        { credentials: "include" }
      );
      const all = await res.json();

      console.log("ALL LEAVES LENGTH =", all.length);
      if (all.length > 0) console.log("👉 REAL DATABASE FIELDS:", all[0]);

      // 2️⃣ Filter matching records using structural key fallbacks
      const matchedRequests = all.filter(l => {
        // Checks every variation of staff id fields used across your tables
        const recordId = l.staff_id || l.staffid || l.id || l.user_id;
        
        return String(recordId).trim() === targetUserId;
      });

      // 3️⃣ Map the data onto Svelte's view grid tracking array
      leaves = matchedRequests.map(l => ({
        uuid: l.leave_id || l.uuid || l.id,
        id: l.staff_id || l.staffid || targetUserId,
        name: l.staff_name || user?.full_name || "irfan888",
        dateFrom: l.date_from,
        dateTo: l.date_until || l.date_from,
        totalDays: l.total_days,
        type: l.leave_type,
        reason: l.reason || "",        
        duration: l.duration || "Full",  
        attachment_path: l.attachment_path,
        createdAt: l.created_at, 
        cancellationReason: l.cancellation_reason,
        status:
          Number(l.total_days) === 0
            ? "Invalid"
            : l.status === "pending" ? "Pending"
            : l.status === "approved" ? "Approved"
            : l.status === "rejected" ? "Rejected"
            : l.status === "cancelled" ? "Cancelled"
            : l.status === "cancellation_pending" ? "Cancellation Pending"
            : l.status
      }));

      console.log("MY LEAVES HISTORY LENGTH =", leaves.length);
      console.log("MAPPED LEAVES HISTORY:", leaves);

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

    const matchType =
      selectedLeaveType === "All" ||
      l.type === selectedLeaveType;

  return matchStatus && matchMonth && matchYear && matchType;

  })
  .sort((a, b) => (a.dateFrom < b.dateFrom ? 1 : -1));



  // ===== CANCELLATION =====
  function requestCancellation(l) {

  // ✅ PENDING → DELETE TERUS (NO MODAL, NO REASON)
  if (l.status === "Pending") {
  fetch(
    `${PUBLIC_VITE_API_BASE}/api/leave-requests/${l.uuid}`,
    {
      method: "DELETE",
      credentials: "include"
    }
  )
    .then(res => {
      if (!res.ok) throw new Error("Delete failed");
      leaves = leaves.filter(x => String(x.uuid) !== String(l.uuid));

      // ✅ TOAST SUCCESS
      showToast("Leave application deleted successfully.", "success");
    })
    .catch(() => {
      // ❌ TOAST ERROR
      showToast("Failed to delete leave application.", "error");
    });

  return; // stop sini, tak buka modal
}

  // ✅ APPROVED → REQUEST CANCELLATION
  leaveToCancel = l;
  cancelReason = "";
  showCancelReason = false;
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
  originalLeaveType = l.type; 
  leaveType = l.type;
  duration = l.totalDays === 0.5 ? "Half" : l.duration || "Full";
  dateFrom = l.dateFrom.slice(0,10);
  dateUntil = l.dateTo.slice(0,10);
  totalDays = l.totalDays;
  // Auto-set fixed leave types
  if (fixedDurations[leaveType]) {
    const days = fixedDurations[leaveType];
    const start = new Date(dateFrom);
    const end = new Date(start);
    end.setDate(start.getDate() + (days - 1));
    dateUntil = end.toISOString().slice(0, 10);
  }
  
  reason = l.reason || "";
  currentAttachment = l.attachment_path || null;
  newAttachmentName = "";

  if (modal) modal.showModal();
}

function preventTypeChange() {
  if (isEdit && leaveType !== originalLeaveType) {
    showToast(
      "Leave type changes are restricted. Please cancel the pending request and submit a new one.",
      "info",
      "Action Restricted"
    );
    leaveType = originalLeaveType; // revert back
  }
}

async function confirmCancellation() {
  if (!leaveToCancel) return;

  const status = leaveToCancel.status.toLowerCase();

  // 1️⃣ PENDING → DELETE TERUS
  if (leaveToCancel.status === "Pending") {
    try {
      await fetch(
        `${PUBLIC_VITE_API_BASE}/api/leave-requests/${leaveToCancel.uuid}`,
        {
          method: "DELETE",
          credentials: "include"
        }
      );

      leaves = leaves.filter(l => String(l.uuid) !== String(leaveToCancel.uuid));

      // ✅ SUCCESS TOAST
      showToast(
        "Leave application has been deleted successfully.",
        "success",
        "Deleted"
      );

    } catch (err) {
      showToast(
        "Failed to delete leave application.",
        "error",
        "Action Failed"
      );
    }

    closeConfirmationModal();
    await loadLeaveHistory();
    return;
  }

  // 2️⃣ APPROVED → CANCELLATION PENDING (WITH REASON)
  if (status === "approved") {

    if (!cancelReason.trim()) {
      showToast(
        "Please provide a reason for cancellation.",
        "warning",
        "Missing Reason"
      );
      return;
    }

    try {
      await fetch(
        `${PUBLIC_VITE_API_BASE}/api/leave-requests/${leaveToCancel.uuid}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "cancellation_pending",
            cancellation_reason: cancelReason
          })
        }
      );

      leaves = leaves.map(l =>
        l.uuid === leaveToCancel.uuid
          ? { ...l, status: "Cancellation Pending" }
          : l
      );

      // ✅ SUCCESS TOAST
      showToast(
        "Cancellation request has been submitted successfully.",
        "success",
        "Request Submitted"
      );

    } catch (err) {
      showToast(
        "Failed to submit cancellation request.",
        "error",
        "Action Failed"
      );
    }

    closeConfirmationModal();
    await loadLeaveHistory();
    return;
  }
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
// ============================================
// CLIENT-SIDE VALIDATION FOR EDIT (ALL TYPES)
// Same behaviour as APPLY form
// ============================================

// 1. Annual Leave (AL / EL)
if (leaveType === "AL" || leaveType === "EL") {

  const annualOriginal = Number(user.leave_entitlement_annual_original ?? 14);

  // CF valid only before expiry
  let carryForward = 0;
  const cfExpiry = user.carry_forward_expiry ? new Date(user.carry_forward_expiry) : null;
  const today = new Date();

  if (cfExpiry && today <= cfExpiry) {
    carryForward = Number(user.carry_forward_balance || 0);
  }

  const entitlement = annualOriginal + carryForward;

  if (totalDays > entitlement) {
    showToast(
        `Entitlement: ${entitlement} days\nRequested: ${totalDays} days`,
        "warning",
        "Annual Leave Limit Exceeded",
        5000
      );
      return;
  }
}

// 2. MEDICAL (MC)
if (leaveType === "MC") {
  const limit = Number(user.leave_entitlement_medical ?? 14);

  if (totalDays > limit) {
        showToast(
      `Entitlement: ${limit} days\nRequested: ${totalDays} days`,
      "warning",
      "Medical Leave Limit Exceeded",
      5000
    );
    return;
  }
}

// 3. HOSPITALIZATION (HOSP)
if (leaveType === "HOSP") {
  const limit = Number(user.hosp_entitlement ?? 60); // entitlement
  const remaining = Number(user.hosp_balance ?? limit); // balance shown to user

  if (totalDays > remaining) {
   showToast(
  `Balance: ${remaining} days\nRequested: ${totalDays} days`,
  "warning",
  "Hospitalization Leave Exceeded",
  5000
);
return;
  }
}

// 4. FIXED-duration leaves (MAT, PAT, COMP_A, COMP_B, MAR)
if (fixedDurations[leaveType]) {
  const required = fixedDurations[leaveType];

  if (totalDays !== required) {
   showToast(
  `${getLeaveFullName(leaveType)} must be exactly ${required} days.`,
  "info",
  "Fixed Duration Leave"
);
return;
  }
}


try {
    // Build FormData payload
    const formData = new FormData();
    formData.append("leave_type", leaveType);
    formData.append("duration", duration);
    formData.append("date_from", dateFrom);
    formData.append("date_until", payload.date_until);
    formData.append("total_days", totalDays);
    formData.append("reason", reason);
    formData.append("request_type", "update");

    // If user selected a new attachment → send file
    if (attachmentFiles && attachmentFiles.length > 0) {
      formData.append("attachment", attachmentFiles[0]);
    }

    // PATCH request using FormData (NO headers!)
      await fetch(
        `${PUBLIC_VITE_API_BASE}/api/leave-requests/${editingUuid}/edit`,
        {
          method: "PATCH",
          credentials: "include",
          body: formData
        }
      );

showToast(
  "Your leave application has been updated successfully.",
  "success",
  "Edit Successful"
);
// 🔥 THIS FIXES YOUR ERROR
await loadLeaveHistory();
closeEditModal();

// ---- Fetch UPDATED DATA from backend ----
const updated = await fetch(
  `${PUBLIC_VITE_API_BASE}/api/leave-requests/${editingUuid}`,
  {
    credentials: "include"
  }
);
const updatedLeave = await updated.json();

// ---- Now find the correct index ----
const idx = leaves.findIndex(l => String(l.uuid) === String(editingUuid));

if (idx !== -1) {
  leaves[idx] = {
    ...leaves[idx],
    type: updatedLeave.leave_type,
    dateFrom: updatedLeave.date_from,
    dateTo: updatedLeave.date_until,
    totalDays: updatedLeave.total_days,
    reason: updatedLeave.reason,
    duration: updatedLeave.duration,
    attachment_path: updatedLeave.attachment_path  // <- REAL updated file path
  };

  leaves = [...leaves]; // force refresh
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

function openDetail(l) {
  selectedLeave = l;
  showDetailModal = true;
}

function closeDetail() {
  showDetailModal = false;
  selectedLeave = null;
}
</script>

<!-- ===== Confirmation Modal ===== -->
{#if showConfirmationModal}
  <div class="modal-backdrop">
    <div class="modal-dialog">
      <h3>Confirm Cancellation</h3>

      {#if !showCancelReason}
        <p>Are you sure you want to cancel your leave application?</p>

        <div class="modal-actions">
          <button
            class="btn-danger"
            on:click={() => showCancelReason = true}
          >
            Yes, continue
          </button>
          <button
            class="btn-secondary"
            on:click={closeConfirmationModal}
          >
            No, keep it
          </button>
        </div>

      {:else}
        <p>Please state your reason for cancellation:</p>

        <textarea
          rows="3"
          bind:value={cancelReason}
          placeholder="Enter cancellation reason.."
          style="width:100%; padding:8px; border-radius:8px; border:1px solid #d1d5db;"
        ></textarea>

        <div class="modal-actions" style="margin-top:12px;">
          <button
            class="btn-danger"
            disabled={!cancelReason.trim()}
            on:click={confirmCancellation}
          >
            Submit Cancellation
          </button>
          <button
            class="btn-secondary"
            on:click={closeConfirmationModal}
          >
            Cancel
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}


<!-- ===== DETAIL MODAL ===== -->
{#if showDetailModal && selectedLeave}
  <div class="modal-backdrop" on:click={closeDetail}>
    <div class="detail-modal" on:click|stopPropagation>
      <button class="detail-close-btn" on:click={closeDetail}>✕</button>
      <h3 class="detail-title">Leave Application Details</h3>

      <div class="detail-grid">
        <div class="detail-row">
          <span class="detail-label">Staff ID</span>
          <span class="detail-value">{selectedLeave.id}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Name</span>
          <span class="detail-value">{selectedLeave.name}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Requested On</span>
          <span class="detail-value">{selectedLeave.createdAt ? fmt(selectedLeave.createdAt) : '-'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Leave Type</span>
          <span class="detail-value">{getLeaveFullName(selectedLeave.type)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Duration</span>
          <span class="detail-value">{selectedLeave.duration === 'Half' ? 'Half Day' : 'Full Day'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Date From</span>
          <span class="detail-value">{fmt(selectedLeave.dateFrom)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Date Until</span>
          <span class="detail-value">{fmt(selectedLeave.dateTo)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Total Days</span>
          <span class="detail-value">{formatDays(selectedLeave.totalDays)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="detail-value">
            <span class="badge {selectedLeave.status.toLowerCase().replace(' ', '-')} {selectedLeave.status === 'Approved' && selectedLeave.type === 'UNPAID' ? 'unpaid-approved' : ''}">
              {selectedLeave.status}
            </span>
          </span>
        </div>
        <div class="detail-row detail-row-full">
          <span class="detail-label">Reason</span>
          <span class="detail-value detail-reason">{selectedLeave.reason || '-'}</span>
        </div>
        {#if selectedLeave.attachment_path}
          <div class="detail-row detail-row-full">
            <span class="detail-label">Attachment</span>
            <span class="detail-value">
              <a
                href={`${PUBLIC_VITE_API_BASE}${selectedLeave.attachment_path?.startsWith('/') ? '' : '/'}${selectedLeave.attachment_path}`}
                target="_blank"
                rel="noopener noreferrer"
                class="detail-attachment-link"
              >
                View Attachment
              </a>
            </span>
          </div>
        {/if}
        {#if selectedLeave.cancellationReason}
          <div class="detail-row detail-row-full">
            <span class="detail-label">Cancellation Reason</span>
            <span class="detail-value detail-reason">{selectedLeave.cancellationReason}</span>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}


<!-- ===== FILTER BAR (Right aligned) ===== -->
<div class="toprow">
  <div class="filters">
    <div class="filter-wrap">
      <svg class="filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 4h18l-7 8v6l-4 2v-8l-7-8z"/>
      </svg>
      <label class="filter-label" for="status-filter">Status</label>
      <div class="filter-select">
        <select id="status-filter" bind:value={selectedStatus} aria-label="Filter by status">
          {#each statuses as s}
            <option value={s}>{s}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="filter-wrap">
      <svg class="filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 4h18l-7 8v6l-4 2v-8l-7-8z"/>
      </svg>
      <label class="filter-label" for="type-filter">Leave Type</label>
      <div class="filter-select">
        <select id="type-filter" bind:value={selectedLeaveType} aria-label="Filter by leave type">
          <option value="All">All</option>
          {#each leaveTypes.slice(1) as t}
            <option value={t}>{leaveTypeShortName[t] || t}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="filter-wrap">
      <svg class="filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 4h18l-7 8v6l-4 2v-8l-7-8z"/>
      </svg>
      <label class="filter-label" for="year-filter">Year</label>
      <div class="filter-select">
        <select id="year-filter" bind:value={selectedYear} aria-label="Filter by year">
          {#each years as y}
            <option value={y}>{y}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="filter-wrap">
      <svg class="filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 4h18l-7 8v6l-4 2v-8l-7-8z"/>
      </svg>
      <label class="filter-label" for="month-filter">Month</label>
      <div class="filter-select">
        <select id="month-filter" bind:value={selectedMonth} aria-label="Filter by month">
          {#each months as m}
            <option value={m}>{m}</option>
          {/each}
        </select>
      </div>
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
    href={`${PUBLIC_VITE_API_BASE}${currentAttachment?.startsWith('/') ? '' : '/'}${currentAttachment}`}
    target="_blank"
    rel="noopener noreferrer"
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
<div class="table-card">
  {#if filteredLeaves.length === 0}
    <div class="no-data">No leave applications found.</div>
  {:else}
    <div class="table-wrapper">
      <table class="leave-table">
  <thead>
    <tr>
      <th style="width:56px;">No.</th>
      <th>Staff ID</th>
      <th>Name</th>
      <th>Requested</th>
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
        <td>{l.createdAt ? fmt(l.createdAt) : '-'}</td>
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

    <!-- View details -->
    <button class="icon-btn view-details-btn" title="View Details" on:click={() => openDetail(l)}>
      <svg viewBox="0 0 24 24">
        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>
      </svg>
    </button>

   <!-- SLOT: FILE ICON -->
<div class="slot">
  {#if l.attachment_path && l.status !== 'Pending'}
  <a
  href={`${PUBLIC_VITE_API_BASE}${l.attachment_path?.startsWith('/') ? '' : '/'}${l.attachment_path}`}
  target="_blank"
  rel="noopener noreferrer"
  class="icon-btn file-btn {l.status === 'Cancelled' ? 'disabled-file' : ''}"
  title={l.status === 'Cancelled' ? 'Attachment disabled' : 'View Attachment'}
>
    <svg viewBox="0 0 26 26">
      <path 
        fill="currentColor"
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 8V3.5L19.5 9H15a1 1 0 0 1-1-1z"
      />
    </svg>
  </a>
{/if}

</div>


    <!-- SLOT 1: Pencil -->
    <div class="slot">
      {#if l.status === 'Pending'}
        <button class="icon-btn pencil-btn" on:click={() => handleEdit(l)} title="Edit Application">
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
    </div>
  {/if}
</div>

{#if toast.show}
  <div class="toast-stack">
    <div class="toast-item {toast.type} {toast.closing ? 'closing' : ''}">
      <div class="toast-icon">
      {#if toast.type === 'success'}
        <svg viewBox="0 0 24 24" class="toast-svg">
          <path d="M9.5 16.2L4.8 11.5l1.4-1.4 3.3 3.3 8.1-8.1 1.4 1.4z"/>
        </svg>
      {/if}

      {#if toast.type === 'error'}
        <svg viewBox="0 0 24 24" class="toast-svg">
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm3.5 13.1-1.4 1.4L12 13.4l-2.1 2.1-1.4-1.4L10.6 12 8.5 9.9l1.4-1.4 2.1 2.1 2.1-2.1 1.4 1.4L13.4 12z"/>
        </svg>
      {/if}

      {#if toast.type === 'info'}
        <svg viewBox="0 0 24 24" class="toast-svg">
          <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/>
        </svg>
      {/if}

      {#if toast.type === 'warning'}
        <svg viewBox="0 0 24 24" class="toast-svg">
          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
        </svg>
      {/if}
    </div>

      <div class="toast-body">
        <strong>{toast.title}</strong>
        <p>{toast.message}</p>
      </div>

      <button class="toast-close" on:click={() => (toast.show = false)}>×</button>
    </div>
  </div>
{/if}

<style>
  /* ===== TOP ROW: filters left, action right ===== */
  .toprow {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }
  .filters {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    align-items: center;
  }
  .filter-wrap { display: flex; align-items: center; gap: 6px; }
  .filter-label { margin: 0 6px; font-weight: 600; font-size: 14px; color: var(--ink, #1F2937); }
  .filter-icon { width: 16px; height: 16px; color: var(--muted, #6B7280); opacity: 0.9; }
  .filter-select { min-width: 210px; }
  .filter-select select {
    appearance: none; -webkit-appearance: none;
    background: #fff url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b7280' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 10px center;
    border: 1px solid var(--line, #e5e7eb);
    border-radius: 10px;
    padding: .5rem 2rem .5rem .8rem;
    font-size: 14px; font-weight: 600; color: var(--ink, #1F2937);
    cursor: pointer; width: 100%;
  }
  .filter-select select:focus {
    outline: none;
    border-color: #0F9B8E;
    box-shadow: 0 0 0 3px rgba(15,155,142,.15);
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #0F9B8E;
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: .6rem 1.15rem;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(15,23,42,.08);
    white-space: nowrap;
  }
  .btn-primary:hover { background: #0C8075; }
  .add-leave-btn svg { width: 18px; height: 18px; fill: #fff; flex: none; }

  /* ===== TABLE CARD (matches Admin Activity Log) ===== */
  .table-card {
    background: #fff;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    box-shadow: 0 2px 10px rgba(15,23,42,.06);
    overflow: hidden;
  }
  .table-wrapper { overflow-x: auto; }
  table.leave-table {
    width: 100%;
    border-collapse: collapse;
  }
  .leave-table thead {
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }
  .leave-table th {
    padding: 14px 16px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
    vertical-align: middle;
  }
  .leave-table td {
    padding: 14px 16px;
    font-size: 14px;
    color: #111827;
    vertical-align: middle;
    border-bottom: 1px solid #f3f4f6;
  }
  .leave-table tbody tr:hover { background: #f9fafb; }
  .no-data {
    padding: 48px;
    text-align: center;
    color: #6b7280;
    font-size: 16px;
  }
  .center {
    text-align: center;
  }
  .actions-col {
    width: 140px;
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
  background: #ffe7bb;
  color: #b45309;
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
  width: 18px;
  height: 18px;
  color: #217859;
}

  .disabled-file {
  opacity: 0.35 !important;
  cursor: not-allowed !important;
  pointer-events: none !important;
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
    color: #0F9B8E;
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
  .btn-danger { background: #DC2626; color: white; }

.action-wrapper {
  display: flex;
  justify-content: center;
  gap: 2px;
  align-items: center;
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

/* ===== DETAIL MODAL ===== */
.detail-modal {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  width: min(520px, 92vw);
  max-height: 85vh;
  overflow-y: auto;
  padding: 28px 32px 32px;
  position: relative;
}
.detail-close-btn {
  position: absolute;
  top: 14px;
  right: 14px;
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  color: #9ca3af;
  padding: 4px 8px;
  border-radius: 6px;
}
.detail-close-btn:hover { background: #f3f4f6; color: #111827; }
.detail-title {
  margin: 0 0 20px;
  font-size: 20px;
  font-weight: 700;
  color: #111827;
}
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 24px;
}
.detail-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.detail-row-full {
  grid-column: 1 / -1;
}
.detail-label {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.detail-value {
  font-size: 14px;
  color: #111827;
}
.detail-reason {
  background: #f9fafb;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  line-height: 1.5;
}
.detail-attachment-link {
  color: #2563eb;
  text-decoration: underline;
  font-size: 14px;
}
.detail-attachment-link:hover { color: #1d4ed8; }

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
    backdrop-filter: blur(0.8px);
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
    border-color: #DC2626;
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
    font-weight: 400;
  }
  .leave-form .duration input[type="radio"] {
    accent-color: #3FADA4;
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
    background: var(--brand, #0F9B8E);
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: 10px 14px;
    cursor: pointer;
    font-weight: 600;
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

 /* =========================
   TOAST NOTIFICATION
========================= */
.toast-stack {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
}

.toast-item {
  display: flex;
  align-items: flex-start; 
  background: #fff;
  border-radius: 8px;
  min-width: 340px;
  max-width: 400px;
  padding: 12px 14px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.15);
  animation: slideIn 0.25s ease;
  border-left: 5px solid;
}

.toast-icon {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  margin-top: 2px;
}

.toast-svg {
  width: 20px;
  height: 20px;
  fill: #fff;
}

.toast-body {
  flex: 1;
}

.toast-body strong {
  display: block;
  font-size: 14px;
  color: #111827;
  margin-bottom: 2px;
}

.toast-body p {
  margin: 0;
  font-size: 13px;
  color: #4b5563;
}

.toast-close {
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #9ca3af;
  margin-left: 10px;
}
.toast-close:hover {
  color: #111827;
}

.toast-item.success {
  border-color: #22c55e;
}
.toast-item.success .toast-icon {
  background: #22c55e;
}

.toast-item.error {
  border-color: #DC2626;
}
.toast-item.error .toast-icon {
  background: #DC2626;
}

.toast-item.info {
  border-color: #0F9B8E;
}
.toast-item.info .toast-icon {
  background: #3b82f6;
}

.toast-item.warning {
  border-color: #f59e0b;
}
.toast-item.warning .toast-icon {
  background: #f59e0b;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(24px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
@keyframes fadeOut {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(24px);
  }
}

.toast-item.closing {
  animation: fadeOut 0.25s ease forwards;
}

/* ===== VIEW DETAILS BUTTON ===== */
.view-details-btn svg {
  fill: #0F9B8E;
}
.view-details-btn:hover {
  background: #f0fdfa;
}

  /* ===== Responsive (keep filters usable) ===== */
  @media (max-width: 640px) {
    .filters { gap: .75rem; }
    .filter-select select { font-size: 13px; }
    th, td { padding: 8px 10px; }
  }
</style>