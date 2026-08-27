<script>
  import { onMount } from "svelte";
  import { PUBLIC_VITE_API_BASE } from "$env/static/public";
  import StatCardsRow from "$lib/components/history/StatCardsRow.svelte";
  import FilterBar from "$lib/components/history/FilterBar.svelte";
  import ViewToggle from "$lib/components/history/ViewToggle.svelte";
  import LeaveTable from "$lib/components/history/LeaveTable.svelte";
  import MonthGroup from "$lib/components/history/MonthGroup.svelte";
  import EmptyState from "$lib/components/history/EmptyState.svelte";
  import ExportPanel from "$lib/components/history/ExportPanel.svelte";
  import { makeEmployeeRecord, MONTHS } from "$lib/components/history/utils.js";
  import { exportCSV } from "$lib/components/history/exportCSV.js";
  import { exportPDF } from "$lib/components/history/exportPDF.js";

  let me = null;
  let rawRecords = [];
  let allDepartments = [];

  let view = "flat";
  let monthFilter = "All";
  let deptFilter = "";
  let typeFilter = "";
  let statusFilter = "";
  let searchQuery = "";

  let showExportPanel = false;

  async function loadHistory() {
    const res = await fetch(`${PUBLIC_VITE_API_BASE}/api/leave-requests/history/all`, {
      credentials: "include"
    });
    const data = await res.json();
    rawRecords = data.map(makeEmployeeRecord);
    allDepartments = Array.from(
      new Set(rawRecords.map((e) => e.department).filter(Boolean))
    ).sort();
  }

  onMount(async () => {
    const meRes = await fetch(`${PUBLIC_VITE_API_BASE}/api/me`, {
      credentials: "include"
    });
    me = await meRes.json();
    await loadHistory();
  });

  function resetFilters() {
    monthFilter = "All";
    deptFilter = "";
    typeFilter = "";
    statusFilter = "";
    searchQuery = "";
  }

  function handleFilterChange(e) {
    const update = e.detail;
    if ("monthFilter" in update) monthFilter = update.monthFilter;
    if ("deptFilter" in update) deptFilter = update.deptFilter;
    if ("typeFilter" in update) typeFilter = update.typeFilter;
    if ("statusFilter" in update) statusFilter = update.statusFilter;
    if ("searchQuery" in update) searchQuery = update.searchQuery;
  }

  function handleClearFilters() {
    resetFilters();
  }

  $: filteredRecords = (() => {
    let out = rawRecords;

    if (monthFilter !== "All") {
      out = out.filter((r) => {
        const startMonth = new Date(r.dateFrom).getMonth();
        const endMonth = new Date(r.dateTo).getMonth();
        const targetIdx = MONTHS.indexOf(monthFilter);
        return startMonth <= targetIdx && endMonth >= targetIdx;
      });
    }

    if (deptFilter) {
      out = out.filter((r) => r.department === deptFilter);
    }

    if (typeFilter) {
      out = out.filter((r) => r.leaveType === typeFilter);
    }

    if (statusFilter) {
      out = out.filter(
        (r) => r.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const term = searchQuery.trim().toLowerCase();
      out = out.filter(
        (r) =>
          r.name.toLowerCase().includes(term) ||
          r.id.toLowerCase().includes(term)
      );
    }

    return out;
  })();

  $: monthGroups = (() => {
    const groups = MONTHS.map((m) => ({ month: m, records: [] }));

    filteredRecords.forEach((r) => {
      const startMonth = new Date(r.dateFrom).getMonth();
      const endMonth = new Date(r.dateTo).getMonth();
      for (let m = startMonth; m <= endMonth; m++) {
        groups[m].records.push({ ...r, _month: MONTHS[m] });
      }
    });

    groups.forEach((g) =>
      g.records.sort(
        (a, b) => new Date(a.dateFrom) - new Date(b.dateFrom)
      )
    );

    return groups;
  })();

  $: hasActiveFilters =
    monthFilter !== "All" ||
    deptFilter !== "" ||
    typeFilter !== "" ||
    statusFilter !== "" ||
    searchQuery !== "";

  $: visibleMonthGroups = monthGroups.filter(
    (g) => g.records.length > 0 || (!hasActiveFilters && monthFilter === "All")
  );

  $: expandedMonth = (() => {
    const currentMonthIdx = new Date().getMonth();
    const candidate = monthGroups[currentMonthIdx];
    if (candidate && candidate.records.length > 0) {
      return candidate.month;
    }
    for (const g of monthGroups) {
      if (g.records.length > 0) return g.month;
    }
    return null;
  })();

  $: flatRecords = filteredRecords.map((r) => ({
    ...r,
    _month: new Date(r.dateFrom).toLocaleDateString("en-US", { month: "long" })
  }));

  $: stats = {
    total: filteredRecords.length,
    approved: filteredRecords.filter((r) => r.status === "Approved").length,
    pending: filteredRecords.filter((r) => r.status === "Pending" || r.status === "Cancellation pending").length,
    cancelled: filteredRecords.filter((r) => r.status === "Cancelled" || r.status === "Rejected" || r.status === "Invalid").length
  };

  async function handleExport(e) {
    const { format, scope, includeCancelled } = e.detail;
    let records = scope === "filtered" ? filteredRecords : rawRecords;

    if (!includeCancelled) {
      records = records.filter(
        (r) => r.status !== "Cancelled" && r.status !== "Rejected" && r.status !== "Invalid"
      );
    }

    const exportFilters = {
      deptFilter: scope === "filtered" ? deptFilter : "",
      typeFilter: scope === "filtered" ? typeFilter : "",
      statusFilter: scope === "filtered" ? statusFilter : "",
      monthFilter: scope === "filtered" ? monthFilter : "All",
      searchQuery: scope === "filtered" ? searchQuery : "",
      scope
    };

    if (format === "csv") {
      exportCSV(records, { deptFilter: exportFilters.deptFilter, includeAll: scope === "all" });
    } else {
      const allStats = {
        total: records.length,
        approved: records.filter((r) => r.status === "Approved").length,
        pending: records.filter((r) => r.status === "Pending" || r.status === "Cancellation pending").length,
        cancelled: records.filter((r) => r.status === "Cancelled" || r.status === "Rejected" || r.status === "Invalid").length
      };
      await exportPDF(records, exportFilters, allStats);
    }

    showExportPanel = false;
  }
</script>

<div class="page">
  <!-- <div class="page-header">
    <div>
      <h1 class="page-title">Leave history</h1>
      <p class="page-subtitle">Browse leave records for your team.</p>
    </div>
    <div class="header-right">
      {#if me}
        <div class="profile-badge">
          <span class="profile-name">{me.full_name}</span>
          <span class="profile-role">{me.role}</span>
        </div>
      {/if}
    </div>
  </div> -->

  <StatCardsRow records={filteredRecords} />

  <div class="controls-row">
    <FilterBar
      departments={allDepartments}
      bind:monthFilter
      bind:deptFilter
      bind:typeFilter
      bind:statusFilter
      bind:searchQuery
      on:change={handleFilterChange}
      on:clear={handleClearFilters}
    />
    <div class="controls-right">
      <ViewToggle bind:value={view} />
      <button class="export-btn" on:click={() => (showExportPanel = true)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Export
      </button>
    </div>
  </div>

  {#if view === "flat"}
    {#if filteredRecords.length === 0}
      <EmptyState on:clear={handleClearFilters} />
    {:else}
      <LeaveTable records={flatRecords} showMonthColumn={monthFilter === "All"} />
    {/if}
  {:else}
    {#if filteredRecords.length === 0}
      <EmptyState on:clear={handleClearFilters} />
    {:else}
      <div class="month-groups">
        {#each visibleMonthGroups as group}
          <MonthGroup
            month={group.month}
            records={group.records}
            expanded={expandedMonth === group.month}
            empty={group.records.length === 0}
            emptyOpacity={group.records.length === 0 && !hasActiveFilters}
          />
        {/each}
      </div>
    {/if}
  {/if}
</div>

<ExportPanel
  visible={showExportPanel}
  filteredCount={filteredRecords.length}
  allCount={rawRecords.length}
  on:generate={handleExport}
  on:close={() => (showExportPanel = false)}
/>

<style>
  .page {
    padding: 1.5rem;
    max-width: 1500px;
    margin: auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.25rem;
  }

  .page-title {
    margin: 0;
    font-size: var(--fs-page-title, 24px);
    font-weight: 800;
    color: var(--ink, #1F2937);
  }

  .page-subtitle {
    margin: 0.2rem 0 0;
    font-size: 0.9rem;
    color: #64748b;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .profile-badge {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.1rem;
  }

  .profile-name {
    font-weight: 700;
    font-size: 0.88rem;
    color: #1F2937;
  }

  .profile-role {
    font-size: 0.75rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .controls-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0;
  }

  .controls-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
    padding-top: 0.1rem;
  }

  .export-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.45rem 0.85rem;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
    background: #fff;
    color: #475569;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }

  .export-btn:hover {
    border-color: var(--brand, #0F9B8E);
    color: var(--brand, #0F9B8E);
    background: #f0fdf9;
  }

  .month-groups {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  @media (max-width: 900px) {
    .controls-row {
      flex-direction: column;
    }
    .controls-right {
      align-self: flex-start;
    }
  }

  @media (max-width: 860px) {
    .page {
      padding: 1rem;
    }
  }
</style>
