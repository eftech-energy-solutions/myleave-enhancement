<script>
  import { createEventDispatcher } from "svelte";

  export let filteredCount = 0;
  export let allCount = 0;
  export let visible = false;

  const dispatch = createEventDispatcher();

  let format = "csv";
  let scope = "filtered";
  let includeCancelled = true;
  let generating = false;

  $: recordCount = scope === "filtered" ? filteredCount : allCount;

  async function handleGenerate() {
    generating = true;
    try {
      dispatch("generate", { format, scope, includeCancelled });
    } finally {
      setTimeout(() => { generating = false; }, 300);
    }
  }

  function handleKeydown(e) {
    if (e.key === "Escape") dispatch("close");
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if visible}
  <div class="export-backdrop" on:click|self={() => dispatch("close")}>
    <div class="export-panel" role="dialog" aria-label="Export options">
      <div class="panel-head">
        <h3>Export data</h3>
        <button class="close-btn" on:click={() => dispatch("close")} aria-label="Close">✕</button>
      </div>

      <div class="panel-body">
        <fieldset class="field-group">
          <legend>Format</legend>
          <label class="radio-row">
            <input type="radio" bind:group={format} value="csv" />
            <span class="radio-label">CSV</span>
            <span class="radio-desc">Raw data rows for Excel/Sheets</span>
          </label>
          <label class="radio-row">
            <input type="radio" bind:group={format} value="pdf" />
            <span class="radio-label">PDF report</span>
            <span class="radio-desc">Formatted with summary and monthly groups</span>
          </label>
        </fieldset>

        <fieldset class="field-group">
          <legend>Scope</legend>
          <label class="radio-row">
            <input type="radio" bind:group={scope} value="filtered" />
            <span class="radio-label">Current filtered view</span>
            <span class="radio-desc">{filteredCount} record{filteredCount !== 1 ? "s" : ""} on screen</span>
          </label>
          <label class="radio-row">
            <input type="radio" bind:group={scope} value="all" />
            <span class="radio-label">Full year, all departments</span>
            <span class="radio-desc">{allCount} record{allCount !== 1 ? "s" : ""} total</span>
          </label>
        </fieldset>

        <label class="checkbox-row">
          <input type="checkbox" bind:checked={includeCancelled} />
          <span>Include cancelled leave</span>
        </label>
      </div>

      <div class="panel-foot">
        <span class="record-preview">{recordCount} record{recordCount !== 1 ? "s" : ""} will be exported</span>
        <button
          class="generate-btn"
          on:click={handleGenerate}
          disabled={generating || recordCount === 0}
        >
          {#if generating}
            Generating…
          {:else}
            Generate {format.toUpperCase()}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .export-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.3);
    display: grid;
    place-items: center;
  }

  .export-panel {
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
    width: min(440px, 92vw);
    overflow: hidden;
  }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .panel-head h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: #1F2937;
  }

  .close-btn {
    background: transparent;
    border: none;
    font-size: 1.1rem;
    cursor: pointer;
    color: #64748b;
    padding: 0.25rem;
    line-height: 1;
  }

  .close-btn:hover {
    color: #1F2937;
  }

  .panel-body {
    padding: 1.15rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field-group {
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 0.75rem 1rem;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .field-group legend {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
    padding: 0 0.35rem;
  }

  .radio-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    padding: 0.35rem 0.5rem;
    border-radius: 8px;
    transition: background 0.12s;
  }

  .radio-row:hover {
    background: #f8fafc;
  }

  .radio-row input[type="radio"] {
    accent-color: var(--brand, #0F9B8E);
    width: 16px;
    height: 16px;
  }

  .radio-label {
    font-weight: 600;
    font-size: 0.88rem;
    color: #1F2937;
  }

  .radio-desc {
    font-size: 0.78rem;
    color: #64748b;
    margin-left: 0.15rem;
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.88rem;
    font-weight: 500;
    color: #374151;
  }

  .checkbox-row input[type="checkbox"] {
    accent-color: var(--brand, #0F9B8E);
    width: 16px;
    height: 16px;
  }

  .panel-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 1.25rem;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .record-preview {
    font-size: 0.8rem;
    color: #64748b;
  }

  .generate-btn {
    padding: 0.5rem 1.1rem;
    border-radius: 8px;
    border: none;
    background: var(--brand, #0F9B8E);
    color: #fff;
    font-weight: 700;
    font-size: 0.88rem;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }

  .generate-btn:hover:not(:disabled) {
    background: var(--brand-dark, #0C8075);
  }

  .generate-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
</style>
