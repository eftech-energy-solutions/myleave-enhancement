<script>
  // ===== Base Dummy Data (current year) =====
  const baseLeaves = [
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
          // If you need unique IDs per year, uncomment the next line:
          // id: `${it.id}-${y}`,
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
  const statuses = ["All", "Approved", "Pending", "Rejected"];
  const months = [
    "All", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const years = ["All", ...Array.from({ length: 10 }, (_, i) => currentYear - i)];

  let selectedStatus = "All";
  let selectedMonth = "All";
  let selectedYear = "All";

  // ===== Filtering =====
  function filterLeaves() {
    const filtered = leaves.filter((l) => {
      const m = monthName(l.dateFrom);
      const y = yearOf(l.dateFrom);

      const matchStatus = selectedStatus === "All" || l.status === selectedStatus;
      const matchMonth = selectedMonth === "All" || m === selectedMonth;
      const matchYear = selectedYear === "All" || y === Number(selectedYear);

      return matchStatus && matchMonth && matchYear;
    });

    // (Optional) sort latest first by start date
    filtered.sort((a, b) => (a.dateFrom < b.dateFrom ? 1 : -1));
    return filtered;
  }
</script>

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
    </tr>
  </thead>
  <tbody>
    {#each filterLeaves() as l, i}
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
    vertical-align: middle;
  }
  tbody tr:hover {
    background: #f3f4f6;
  }
  .center {
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

  /* ===== Responsive (keep filters usable) ===== */
  @media (max-width: 640px) {
    .filters { gap: .75rem; }
    .filter select { font-size: 13px; }
    th, td { padding: 8px 10px; }
  }
</style>
