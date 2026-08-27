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

  let viewMode = "restricted";
  let showModeMenu = false;

  let view = "flat";
  let monthFilter = "All";
  let deptFilter = "";
  let typeFilter = "";
  let statusFilter = "";
  let searchQuery = "";

  let showExportPanel = false;

  async function loadHistory() {
    const res = await fetch(
      `${PUBLIC_VITE_API_BASE}/api/leave-requests/history/all?viewMode=${encodeURIComponent(viewMode)}`,
      { credentials: "include" }
    );
    const data = await res.json();
    let filteredData = data;

    if (me?.role === "Manager") {
      if (viewMode === "all") {
        filteredData = data;
      } else {
        if (me.department === "Director") {
          filteredData = data.filter(
            (r) =>
              r.requester_role === "Manager" ||
              r.department === "Director"
          );
        } else {
          const managerDepartments = me.department
            .split(",")
            .map((d) => d.trim());
          filteredData = data.filter((r) =>
            managerDepartments.includes(r.department?.trim())
          );
        }
      }
    }

    rawRecords = filteredData.map(makeEmployeeRecord);
    allDepartments = Array.from(
      new Set(rawRecords.map((e) => e.department).filter(Boolean))
    ).sort();
  }

  onMount(async () => {
    const meRes = await fetch(`${PUBLIC_VITE_API_BASE}/api/me`, {
      credentials: "include",
    });
    me = await meRes.json();
    await loadHistory();
  });

  async function switchViewMode(newMode) {
    viewMode = newMode;
    showModeMenu = false;
    resetFilters();
    await loadHistory();
  }

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

<svelte:window
  on:keydown={(e) => {
    if (e.key === "Escape") showModeMenu = false;
  }}
/>

<div class="page">
  <!-- <div class="page-header"> -->
    <!-- <div>
      <h1 class="page-title">Leave history</h1>
      <p class="page-subtitle">Browse leave records for your team.</p>
    </div> -->
    <!-- <div class="header-right">
      {#if me}
        <div class="profile-badge">
          <span class="profile-name">{me.full_name}</span>
          <span class="profile-role">{me.role}</span>
        </div>
      {/if}
    </div>
  </div> -->

  {#if me?.role === "Manager" && me?.department === "Director"}
    <div class="fab-container">
      <button
        class="fab"
        on:click={() => (showModeMenu = !showModeMenu)}
        aria-label="Change view mode"
      >
        <svg class="fab-icon" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="6" width="18" height="2" />
          <rect x="3" y="11" width="18" height="2" />
          <rect x="3" y="16" width="18" height="2" />
        </svg>
      </button>

      {#if showModeMenu}
        <div class="fab-menu">
          <button
            class:active={viewMode === "restricted"}
            on:click={() => switchViewMode("restricted")}
          >
            <svg class="mode-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z"
              />
            </svg>
            <span>Manager View</span>
          </button>
          <button
            class:active={viewMode === "all"}
            on:click={() => switchViewMode("all")}
          >
            <svg class="mode-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="8" cy="9" r="4" />
              <path
                d="M2 21c0-3 3.5-5 6-5s6 2 6 5v1H2v-1z"
              />
              <circle cx="16" cy="9" r="5" />
              <path
                d="M8 21c0-3.5 4-5.5 8-5.5s8 2 8 5.5v1H8v-1z"
              />
            </svg>
            <span>All View</span>
          </button>
        </div>
      {/if}
    </div>
  {/if}

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

  /* FAB */
  .fab-container {
    position: fixed;
    right: 16px;
    top: 115px;
    z-index: 999;
  }

  .fab {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: #fef08a;
    cursor: pointer;
    box-shadow: 0 6px 16px rgba(15, 155, 142, 0.45);
  }

  .fab-icon {
    width: 22px;
    height: 22px;
    margin-top: 4px;
    margin-left: -0.5px;
    color: #0f766e;
  }

  .fab-menu {
    position: absolute;
    top: 44px;
    right: 0;
    background: #ffffff;
    border-radius: 12px;
    padding: 6px;
    min-width: 180px;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.18);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .fab-menu button {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: none;
    background: transparent;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: #0c4a6e;
    text-align: left;
    font-family: inherit;
  }

  .fab-menu button:hover {
    background: #f1f5f9;
  }

  .fab-menu button.active {
    background: #e6f7f5;
    color: #0f766e;
    font-weight: 500;
  }

  .fab-menu button.active::after {
    content: "";
    margin-left: auto;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #0F9B8E;
  }

  .mode-icon {
    width: 18px;
    height: 18px;
    fill: #217859;
    flex-shrink: 0;
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
