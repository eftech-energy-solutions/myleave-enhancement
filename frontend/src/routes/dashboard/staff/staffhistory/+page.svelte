<script>
  // ===== Base Dummy Data (current year) =====
  const baseLeaves = [
    {
      uuid: crypto.randomUUID(),
      id: "EMP001",
      name: "Afiq Mikail",
      dateFrom: "2025-01-05",
      dateTo: "2025-01-06",
      totalDays: 2,
      type: "Annual",
      status: "Approved"
    },
    {
      uuid: crypto.randomUUID(),
      id: "EMP001",
      name: "Afiq Mikail",
      dateFrom: "2025-02-10",
      dateTo: "2025-02-10",
      totalDays: 1,
      type: "Emergency",
      status: "Pending"
    },
    {
      uuid: crypto.randomUUID(),
      id: "EMP001",
      name: "Afiq Mikail",
      dateFrom: "2025-03-20",
      dateTo: "2025-03-22",
      totalDays: 3,
      type: "Medical",
      status: "Rejected"
    }
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

  // Duplicate base leaves for the past N years by swapping the year portion.
  const currentYear = new Date().getFullYear();
  function extendWithPastYears(base = [], yearsBack = 9) {
    const out = [...base.map(x => ({ ...x, _year: yearOf(x.dateFrom) }))];
    for (let k = 1; k <= yearsBack; k++) {
      const y = currentYear - k;
      for (const it of base) {
        const df = String(it.dateFrom);
        const dt = String(it.dateTo ?? it.dateFrom);
        const newDf = y + df.slice(4); // replace YYYY
        const newDt = y + dt.slice(4);
        out.push({
          ...it,
          uuid: crypto.randomUUID(), // Give each duplicated entry a new unique ID
          dateFrom: newDf,
          dateTo: newDt,
          _year: y
        });
      }
    }
    return out;
  }

  // Build the working dataset: current + past 9 years
  let leaves = extendWithPastYears(baseLeaves, 9);

  // ===== Filters =====
  const statuses = ["All", "Approved", "Pending", "Rejected", "Cancellation Pending"];
  const months = [
    "All", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const years = ["All", ...Array.from({ length: 10 }, (_, i) => currentYear - i)];

  let selectedStatus = "All";
  let selectedMonth = "All";
  let selectedYear = "All";
  
  $: filteredLeaves = leaves.filter((l) => {
    const m = monthName(l.dateFrom);
    const y = yearOf(l.dateFrom);

    const matchStatus = selectedStatus === "All" || l.status === selectedStatus;
    const matchMonth = selectedMonth === "All" || m === selectedMonth;
    const matchYear = selectedYear === "All" || y === Number(selectedYear);

    return matchStatus && matchMonth && matchYear;
  }).sort((a, b) => (a.dateFrom < b.dateFrom ? 1 : -1));


  // ===== Deletion/Cancellation Logic =====
  let showConfirmationModal = false;
  let leaveToCancel = null;

  function requestCancellation(leaveItem) {
    leaveToCancel = leaveItem;
    showConfirmationModal = true;
  }

  function closeConfirmationModal() {
    leaveToCancel = null;
    showConfirmationModal = false;
  }

  function confirmCancellation() {
    if (!leaveToCancel) return;

    const targetUuid = leaveToCancel.uuid;
    
    if (leaveToCancel.status === 'Pending') {
      // Directly remove the leave application if it's still pending
      leaves = leaves.filter(l => l.uuid !== targetUuid);
    } else if (leaveToCancel.status === 'Approved') {
      // Change status to 'Cancellation Pending' if it was already approved
      const index = leaves.findIndex(l => l.uuid === targetUuid);
      if (index !== -1) {
        leaves[index].status = 'Cancellation Pending';
        leaves = [...leaves]; // Trigger reactivity
      }
    }
    
    closeConfirmationModal();
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
        <td>{l.type}</td>
        <td>
          <span class="badge {l.status.toLowerCase().replace(' ', '-')}">{l.status}</span>
        </td>
        <td class="center">
          {#if l.status === 'Approved' || l.status === 'Pending'}
            <button class="delete-btn" on:click={() => requestCancellation(l)} title="Cancel Application">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.22-2.365.468a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd" />
              </svg>
            </button>
          {/if}
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
  .badge.approved { background: #dcfce7; color: #166534; }
  .badge.pending  { background: #fef9c3; color: #92400e; }
  .badge.rejected { background: #fee2e2; color: #991b1b; }
  .badge.cancellation-pending { background: #fef08a; color: #854d0e; }

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

  /* ===== Responsive (keep filters usable) ===== */
  @media (max-width: 640px) {
    .filters { gap: .75rem; }
    .filter select { font-size: 13px; }
    th, td { padding: 8px 10px; }
  }
</style>

