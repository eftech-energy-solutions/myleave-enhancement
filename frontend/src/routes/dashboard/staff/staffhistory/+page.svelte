<script>
  // ----- Dummy Data -----
  const leaves = [
    {
      id: "EMP001",
      name: "Afiq Mikail",
      dateFrom: "2025-01-05",
      dateTo: "2025-01-06",
      totalDays: 2,
      type: "Annual",
      status: "Approved"
    },
    {
      id: "EMP001",
      name: "Afiq Mikail",
      dateFrom: "2025-02-10",
      dateTo: "2025-02-10",
      totalDays: 1,
      type: "Emergency",
      status: "Pending"
    },
    {
      id: "EMP001",
      name: "Afiq Mikail",
      dateFrom: "2025-03-20",
      dateTo: "2025-03-22",
      totalDays: 3,
      type: "Medical",
      status: "Rejected"
    }
  ];

  // ----- Filters -----
  let selectedStatus = "All";
  let selectedMonth = "All";

  const months = [
    "All", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const statuses = ["All", "Approved", "Pending", "Rejected"];

  // ----- Filtering -----
  function filterLeaves() {
    return leaves.filter(l => {
      const month = new Date(l.dateFrom).toLocaleString("default", { month: "long" });
      const matchStatus = selectedStatus === "All" || l.status === selectedStatus;
      const matchMonth = selectedMonth === "All" || month === selectedMonth;
      return matchStatus && matchMonth;
    });
  }

  const fmt = (iso) =>
    new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
</script>

<!-- FILTER BAR -->
<div class="filter-bar">
  <div class="filters">
    <div class="filter">
      <label>STATUS</label>
      <select bind:value={selectedStatus}>
        {#each statuses as s}
          <option value={s}>{s}</option>
        {/each}
      </select>
    </div>

    <div class="filter">
      <label>MONTH</label>
      <select bind:value={selectedMonth}>
        {#each months as m}
          <option value={m}>{m}</option>
        {/each}
      </select>
    </div>
  </div>
</div>

<!-- TABLE -->
<table class="leave-table">
  <thead>
    <tr>
      <th>Staff ID</th>
      <th>Name</th>
      <th>Dates</th>
      <th>Total Days</th>
      <th>Leave Type</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    {#each filterLeaves() as l}
      <tr>
        <td>{l.id}</td>
        <td>{l.name}</td>
        <td>{fmt(l.dateFrom)}{#if l.dateTo !== l.dateFrom} – {fmt(l.dateTo)}{/if}</td>
        <td>{l.totalDays}</td>
        <td>{l.type}</td>
        <td>
          <span class="badge {l.status.toLowerCase()}">{l.status}</span>
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<style>
  /* ===== FILTER BAR ===== */
  .filter-bar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 1rem;
  }
  .filters {
    display: flex;
    gap: 1.5rem;
  }
  .filter label {
    display: block;
    font-size: 12px;
    font-weight: 700;
    color: white; /* white text as requested */
    margin-bottom: 4px;
  }
  .filter select {
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid #d1d5db;
    font-size: 14px;
  }

  /* ===== TABLE ===== */
  table.leave-table {
    width: 100%;
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
  }
  tbody tr:hover {
    background: #f3f4f6;
  }

  /* ===== STATUS BADGES ===== */
  .badge {
    padding: 4px 10px;
    border-radius: 9999px;
    font-weight: 600;
    font-size: 12px;
  }
  .badge.approved { background: #dcfce7; color: #166534; }
  .badge.pending  { background: #fef9c3; color: #92400e; }
  .badge.rejected { background: #fee2e2; color: #991b1b; }
</style>
