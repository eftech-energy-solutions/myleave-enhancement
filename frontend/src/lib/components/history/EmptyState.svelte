<script>
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();
</script>

<div class="empty-state">
  <svg class="empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="13" y2="16" />
  </svg>
  <p class="empty-title">No leave records match your filters.</p>
  <button class="empty-action" on:click={() => dispatch("clear")}>Clear filters</button>
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 3rem 1rem;
    color: #64748b;
  }

  .empty-icon {
    opacity: 0.5;
  }

  .empty-title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 500;
  }

  .empty-action {
    padding: 0.45rem 1rem;
    border-radius: 8px;
    border: 1px solid var(--brand, #0F9B8E);
    background: transparent;
    color: var(--brand, #0F9B8E);
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s ease;
  }

  .empty-action:hover {
    background: var(--brand, #0F9B8E);
    color: #fff;
  }
</style>
