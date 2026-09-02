<script>
  import { createEventDispatcher } from "svelte";

  export let value = "flat";

  const dispatch = createEventDispatcher();

  function toggle(val) {
    value = val;
    dispatch("toggle", val);
  }
</script>

<div class="view-toggle">
  <button
    class="toggle-btn"
    class:active={value === "flat"}
    on:click={() => toggle("flat")}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
    </svg>
    Flat
  </button>
  <button
    class="toggle-btn"
    class:active={value === "byMonth"}
    on:click={() => toggle("byMonth")}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="5" rx="1" />
      <rect x="3" y="11" width="18" height="5" rx="1" />
    </svg>
    By month
  </button>
</div>

<style>
  .view-toggle {
    display: inline-flex;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    overflow: hidden;
    background: #f8fafc;
  }

  .toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.85rem;
    border: none;
    background: transparent;
    color: #64748b;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
  }

  .toggle-btn:not(:last-child) {
    border-right: 1px solid #e5e7eb;
  }

  .toggle-btn:hover {
    color: #334155;
    background: #f1f5f9;
  }

  .toggle-btn.active {
    background: var(--brand, #0F9B8E);
    color: #fff;
  }

  .toggle-btn.active:hover {
    background: var(--brand-dark, #0C8075);
  }
</style>
