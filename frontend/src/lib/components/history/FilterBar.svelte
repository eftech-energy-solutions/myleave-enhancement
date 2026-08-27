<script>
  import { createEventDispatcher } from "svelte";
  import { getLeaveFullName } from "./utils.js";

  export let departments = [];
  export let monthFilter = "All";
  export let deptFilter = "";
  export let typeFilter = "";
  export let statusFilter = "";
  export let searchQuery = "";

  const dispatch = createEventDispatcher();

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const LEAVE_TYPES = ["AL", "MC", "MAT", "PAT", "COMP_A", "COMP_B", "MAR", "HOSP", "UNPAID"];
  const STATUSES = ["Approved", "Pending", "Rejected", "Cancelled", "Cancellation pending", "Invalid"];

  let searchDebounce = null;
  let localSearch = searchQuery;

  function handleSearch(e) {
    localSearch = e.target.value;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      dispatch("change", { searchQuery: localSearch });
    }, 250);
  }

  function handleChange(key, value) {
    dispatch("change", { [key]: value });
  }

  function handleClear() {
    monthFilter = "All";
    deptFilter = "";
    typeFilter = "";
    statusFilter = "";
    localSearch = "";
    dispatch("clear");
  }

  $: hasActiveFilters = monthFilter !== "All" || deptFilter !== "" || typeFilter !== "" || statusFilter !== "" || localSearch !== "";
</script>

<div class="filter-bar">
  <div class="filters">
    <label class="filter-control">
      <span>Month</span>
      <select value={monthFilter} on:change={(e) => handleChange("monthFilter", e.target.value)}>
        <option value="All">All months</option>
        {#each MONTHS as m}
          <option value={m}>{m}</option>
        {/each}
      </select>
    </label>

    <label class="filter-control">
      <span>Department</span>
      <select value={deptFilter} on:change={(e) => handleChange("deptFilter", e.target.value)}>
        <option value="">All departments</option>
        {#each departments as d}
          <option value={d}>{d}</option>
        {/each}
      </select>
    </label>

    <label class="filter-control">
      <span>Leave type</span>
      <select value={typeFilter} on:change={(e) => handleChange("typeFilter", e.target.value)}>
        <option value="">All types</option>
        {#each LEAVE_TYPES as t}
          <option value={t}>{getLeaveFullName(t)}</option>
        {/each}
      </select>
    </label>

    <label class="filter-control">
      <span>Status</span>
      <select value={statusFilter} on:change={(e) => handleChange("statusFilter", e.target.value)}>
        <option value="">All statuses</option>
        {#each STATUSES as s}
          <option value={s}>{s}</option>
        {/each}
      </select>
    </label>

    <label class="filter-control search-control">
      <span>Search</span>
      <input
        type="text"
        placeholder="Name or staff ID…"
        value={localSearch}
        on:input={handleSearch}
      />
    </label>

    {#if hasActiveFilters}
      <button class="clear-btn" on:click={handleClear}>Clear filters</button>
    {/if}
  </div>
</div>

<style>
  .filter-bar {
    margin-bottom: 1.25rem;
  }

  .filters {
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
    flex-wrap: wrap;
  }

  .filter-control {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .filter-control span {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #64748b;
  }

  .filter-control select,
  .filter-control input {
    padding: 0.5rem 0.65rem;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    background: #fff;
    color: #1F2937;
    font-size: 0.82rem;
    min-width: 145px;
    font-family: inherit;
  }

  .filter-control select:focus,
  .filter-control input:focus {
    outline: none;
    border-color: var(--brand, #0F9B8E);
    box-shadow: 0 0 0 3px rgba(15, 155, 142, 0.12);
  }

  .search-control {
    flex: 1;
    min-width: 180px;
  }

  .search-control input {
    width: 100%;
  }

  .clear-btn {
    padding: 0.5rem 0.85rem;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    background: #f8fafc;
    color: #475569;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
  }

  .clear-btn:hover {
    border-color: var(--danger, #DC2626);
    color: var(--danger, #DC2626);
    background: #fef2f2;
  }

  @media (max-width: 900px) {
    .filters { flex-wrap: wrap; }
    .filter-control select,
    .filter-control input { min-width: 130px; }
  }
</style>
