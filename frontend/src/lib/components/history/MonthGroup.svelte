<script>
  import { createEventDispatcher } from "svelte";
  import LeaveTable from "./LeaveTable.svelte";

  export let month = "";
  export let records = [];
  export let expanded = false;
  export let empty = false;
  export let emptyOpacity = false;

  const dispatch = createEventDispatcher();

  function toggle() {
    if (empty) return;
    expanded = !expanded;
  }

  $: totalDays = records.reduce((sum, r) => sum + Number(r.totalDays || 0), 0);
  $: pendingCount = records.filter(r => r.status === "Pending" || r.status === "Cancellation pending").length;
  $: appCount = records.length;
</script>

<div class="month-group" class:empty class:empty-opacity={emptyOpacity} class:expanded>
  <button class="month-header" on:click={toggle} disabled={empty}>
    {#if !empty}
      <svg class="chevron" class:rotated={expanded} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    {:else}
      <span class="chevron-placeholder"></span>
    {/if}

    <span class="month-label">{month}</span>
    <span class="month-summary">
      {#if empty}
        0 applications
      {:else}
        {appCount} application{appCount !== 1 ? 's' : ''}, {totalDays} day{totalDays !== 1 ? 's' : ''}
      {/if}
    </span>

    {#if !empty && pendingCount > 0}
      <span class="pending-badge">{pendingCount} pending</span>
    {/if}
  </button>

  {#if expanded && !empty}
    <div class="month-body">
      <LeaveTable {records} compact={true} on:detail />
    </div>
  {/if}
</div>

<style>
  .month-group {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
    transition: box-shadow 0.15s ease;
  }

  .month-group:not(.empty):hover {
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
  }

  .month-group.expanded {
    box-shadow: 0 2px 12px rgba(15, 23, 42, 0.08);
  }

  .month-group.empty-opacity {
    opacity: 0.55;
  }

  .month-group.empty {
    cursor: default;
  }

  .month-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.85rem 1rem;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: background 0.12s ease;
  }

  .month-header:hover:not(:disabled) {
    background: #f8fafc;
  }

  .month-header:disabled {
    cursor: default;
  }

  .chevron {
    flex-shrink: 0;
    color: #64748b;
    transition: transform 0.2s ease;
  }

  .chevron.rotated {
    transform: rotate(90deg);
  }

  .chevron-placeholder {
    width: 16px;
    flex-shrink: 0;
  }

  .month-label {
    font-weight: 700;
    font-size: 0.95rem;
    color: #1F2937;
  }

  .month-summary {
    font-size: 0.82rem;
    color: #64748b;
    margin-left: 0.15rem;
  }

  .pending-badge {
    margin-left: auto;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    background: #fff8e7;
    color: #8a5b00;
    border: 1px solid #f5e1b7;
    white-space: nowrap;
  }

  .month-body {
    padding: 0 1rem 1rem;
  }
</style>
