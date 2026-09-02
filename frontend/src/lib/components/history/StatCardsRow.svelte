<script>
  export let records = [];

  $: year = records.length > 0
    ? new Date(records[0].dateFrom || records[0].date_from).getFullYear()
    : new Date().getFullYear();

  $: total = records.length;
  $: approved = records.filter(r => r.status === "Approved").length;
  $: pending = records.filter(r => r.status === "Pending" || r.status === "Cancellation pending").length;
  $: cancelled = records.filter(r => r.status === "Cancelled" || r.status === "Rejected" || r.status === "Invalid").length;
</script>

<div class="stat-row">
  <div class="stat-card stat-total">
    <span class="stat-label">Total Leave Applications ({year})</span>
    <span class="stat-value">{total}</span>
  </div>
  <div class="stat-card stat-approved">
    <span class="stat-label">Approved Leave</span>
    <span class="stat-value">{approved}</span>
  </div>
  <div class="stat-card stat-pending">
    <span class="stat-label">Pending Leave</span>
    <span class="stat-value">{pending}</span>
  </div>
  <div class="stat-card stat-cancelled">
    <span class="stat-label">Cancelled Leave</span>
    <span class="stat-value">{cancelled}</span>
  </div>
</div>

<style>
  .stat-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .stat-card {
    background: #fff;
    border-radius: 12px;
    padding: 1.15rem 1.25rem;
    border: 1px solid #e5e7eb;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .stat-label {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #64748b;
  }

  .stat-value {
    font-size: 1.85rem;
    font-weight: 800;
    line-height: 1.1;
  }

  .stat-total .stat-value { color: var(--brand, #0F9B8E); }
  .stat-approved .stat-value { color: var(--success, #16A34A); }
  .stat-pending .stat-value { color: #D97706; }
  .stat-cancelled .stat-value { color: var(--muted, #6B7280); }

  .stat-total { border-left: 4px solid var(--brand, #0F9B8E); }
  .stat-approved { border-left: 4px solid var(--success, #16A34A); }
  .stat-pending { border-left: 4px solid #D97706; }
  .stat-cancelled { border-left: 4px solid var(--muted, #6B7280); }

  @media (max-width: 860px) {
    .stat-row { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 480px) {
    .stat-row { grid-template-columns: 1fr; }
  }
</style>
