<script>
  import { dateRange, getLeaveFullName } from "./utils.js";

  export let records = [];
  export let showMonthColumn = false;
  export let pageSize = 20;
  export let compact = false;

  let sortCol = "dateFrom";
  let sortDir = "desc";
  let page = 1;

  function toggleSort(col) {
    if (sortCol === col) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortCol = col;
      sortDir = col === "status" ? "asc" : "desc";
    }
    page = 1;
  }

  function sortIcon(col) {
    if (sortCol !== col) return "";
    return sortDir === "asc" ? "\u25B2" : "\u25BC";
  }

  function statusClass(s) {
    return s.toLowerCase().replace(/\s+/g, "-");
  }

  $: sorted = [...records].sort((a, b) => {
    let va, vb;
    switch (sortCol) {
      case "dateFrom":
        va = new Date(a.dateFrom);
        vb = new Date(b.dateFrom);
        break;
      case "status":
        va = a.status.toLowerCase();
        vb = b.status.toLowerCase();
        break;
      case "totalDays":
        va = Number(a.totalDays);
        vb = Number(b.totalDays);
        break;
      case "name":
        va = a.name.toLowerCase();
        vb = b.name.toLowerCase();
        break;
      case "department":
        va = (a.department || "").toLowerCase();
        vb = (b.department || "").toLowerCase();
        break;
      case "leaveType":
        va = a.leaveType.toLowerCase();
        vb = b.leaveType.toLowerCase();
        break;
      default:
        va = a.dateFrom;
        vb = b.dateFrom;
    }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  $: totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  $: paged = sorted.slice((page - 1) * pageSize, page * pageSize);
  $: pageStart = sorted.length > 0 ? (page - 1) * pageSize + 1 : 0;
  $: pageEnd = Math.min(page * pageSize, sorted.length);

  function goPage(p) {
    page = Math.max(1, Math.min(p, totalPages));
  }

  $: {
    records;
    sortCol;
    sortDir;
    page = 1;
  }
</script>

{#if records.length === 0}
  <slot name="empty" />
{:else}
  <div class="table-container" class:compact>
    <table class="leave-table">
      <thead>
        <tr>
          {#if showMonthColumn}
            <th class="sortable" on:click={() => toggleSort("_month")}>Month {sortIcon("_month")}</th>
          {/if}
          <th class="sortable" on:click={() => toggleSort("name")}>Staff {sortIcon("name")}</th>
          <th class="sortable" on:click={() => toggleSort("department")}>Department {sortIcon("department")}</th>
          <th class="sortable" on:click={() => toggleSort("dateFrom")}>Dates {sortIcon("dateFrom")}</th>
          <th class="sortable center" on:click={() => toggleSort("totalDays")}>Days {sortIcon("totalDays")}</th>
          <th class="sortable" on:click={() => toggleSort("leaveType")}>Type {sortIcon("leaveType")}</th>
          <th class="sortable" on:click={() => toggleSort("status")}>Status {sortIcon("status")}</th>
        </tr>
      </thead>
      <tbody>
        {#each paged as row, i}
          <tr>
            {#if showMonthColumn}
              <td class="muted">{row._month}</td>
            {/if}
            <td>
              <div class="staff-cell">
                <span class="staff-name">{row.name}</span>
                <span class="staff-id">{row.id}</span>
              </div>
            </td>
            <td>{row.department}</td>
            <td>{dateRange(row.dateFrom, row.dateTo)}</td>
            <td class="center">{row.totalDays}</td>
            <td>{getLeaveFullName(row.leaveType)}</td>
            <td>
              <span class="status-badge {statusClass(row.status)}">{row.status}</span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="pagination">
    <span class="page-info">Showing {pageStart}–{pageEnd} of {sorted.length}</span>
    {#if totalPages > 1}
      <div class="page-btns">
        <button class="pagebtn" disabled={page === 1} on:click={() => goPage(page - 1)}>Prev</button>
        {#each Array(totalPages) as _, p}
          {#if totalPages <= 7 || p === 0 || p === totalPages - 1 || (p >= page - 2 && p <= page)}
            <button class="pagebtn" class:on={page === p + 1} on:click={() => goPage(p + 1)}>{p + 1}</button>
          {:else if p === page - 3 || p === page + 1}
            <span class="page-ellipsis">…</span>
          {/if}
        {/each}
        <button class="pagebtn" disabled={page === totalPages} on:click={() => goPage(page + 1)}>Next</button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .table-container {
    overflow-x: auto;
  }

  .leave-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 0.875rem;
  }

  .leave-table thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: #f6fbfb;
    text-align: left;
    padding: 0.65rem 0.75rem;
    font-weight: 700;
    color: #285a6d;
    border-bottom: 2px solid #e5f2f1;
    white-space: nowrap;
    user-select: none;
  }

  .sortable {
    cursor: pointer;
  }

  .sortable:hover {
    background: #edf7f5 !important;
  }

  .leave-table tbody td {
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid #f0f4f7;
    color: #1b3342;
    vertical-align: middle;
  }

  .leave-table tbody tr:nth-child(even) td {
    background: #f8fbfb;
  }

  .leave-table tbody tr:hover td {
    background: #ecf7f5;
  }

  .center {
    text-align: center;
  }

  .staff-cell {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .staff-name {
    font-weight: 600;
    color: #1F2937;
  }

  .staff-id {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .muted {
    color: #64748b;
    font-size: 0.82rem;
  }

  .status-badge {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    font-weight: 700;
    font-size: 0.72rem;
    border: 1px solid transparent;
    white-space: nowrap;
  }

  .status-badge.approved {
    background: #e8f8f3;
    color: #116a51;
    border-color: #cbeee3;
  }

  .status-badge.pending {
    background: #fff8e7;
    color: #8a5b00;
    border-color: #f5e1b7;
  }

  .status-badge.rejected {
    background: #fdecec;
    color: #9b1c1c;
    border-color: #f3c2c2;
  }

  .status-badge.cancelled {
    background: #f1f5f9;
    color: #475569;
    border-color: #e2e8f0;
  }

  .status-badge.cancellation-pending {
    background: #fef08a;
    color: #854d0e;
    border-color: #fddc63;
    white-space: nowrap;
  }

  .status-badge.invalid {
    background: #a5a5a7;
    color: #ffffff;
    border-color: #cbd5e1;
  }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    padding: 0.65rem 0.25rem 0.25rem;
    flex-wrap: wrap;
  }

  .page-info {
    font-size: 0.78rem;
    color: #64748b;
  }

  .page-btns {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .pagebtn {
    min-width: 30px;
    height: 28px;
    padding: 0 0.55rem;
    border: 1px solid #e5e7eb;
    background: #fff;
    border-radius: 8px;
    font-size: 0.78rem;
    font-weight: 600;
    color: #334155;
    cursor: pointer;
    font-family: inherit;
  }

  .pagebtn:hover:not(:disabled):not(.on) {
    border-color: var(--brand, #0F9B8E);
    color: var(--brand, #0F9B8E);
  }

  .pagebtn.on {
    background: var(--brand, #0F9B8E);
    border-color: var(--brand, #0F9B8E);
    color: #fff;
  }

  .pagebtn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .page-ellipsis {
    color: #94a3b8;
    font-size: 0.82rem;
    padding: 0 0.25rem;
  }

  .compact .leave-table thead th,
  .compact .leave-table tbody td {
    padding: 0.5rem 0.6rem;
    font-size: 0.82rem;
  }
</style>
