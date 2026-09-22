<script>
  import { onMount } from "svelte";
  import { createEventDispatcher } from "svelte";
  import { PUBLIC_VITE_API_BASE } from "$env/static/public";
  import { fmt, getLeaveFullName } from "./utils.js";

  export let item = null;

  const dispatch = createEventDispatcher();

  const fmt2 = (v) => (v ? fmt(v) : "-");

  let currentUser = null;
  let withdrawing = false;
  let confirmWithdraw = false;
  let withdrawError = "";
  let withdrawDone = false;

  $: isMedical = (item?.leave_type || item?.leaveType || "").toUpperCase() === "MC";
  $: isAnnual = (item?.leave_type || item?.leaveType || "").toUpperCase() === "AL";
  $: isAdmin = (currentUser?.role || "").toLowerCase() === "admin";
  $: isApproved = String(item?.status || "").toLowerCase() === "approved";
  $: canWithdraw = isAdmin && isApproved && !withdrawing;

  onMount(async () => {
    try {
      const res = await fetch(`${PUBLIC_VITE_API_BASE}/api/me`, {
        credentials: "include"
      });
      if (res.ok) {
        currentUser = await res.json();
      }
    } catch (err) {
      console.error("LeaveDetailModal: failed to load current user", err);
    }
  });

  function attachmentUrl(path) {
    if (!path) return "";
    return `${PUBLIC_VITE_API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  function handleKeydown(e) {
    if (e.key === "Escape" && item) {
      item = null;
    }
  }

  function startWithdraw() {
    withdrawError = "";
    confirmWithdraw = true;
  }

  async function confirmWithdrawLeave() {
    const leaveId = item?.leave_id ?? item?.id;
    if (!leaveId) return;

    withdrawing = true;
    withdrawError = "";

    try {
      const res = await fetch(
        `${PUBLIC_VITE_API_BASE}/api/leave-requests/${leaveId}/withdraw`,
        {
          method: "PATCH",
          credentials: "include"
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to withdraw leave");
      }

      if (item) {
        item.status = "Cancelled";
      }
      withdrawDone = true;
      confirmWithdraw = false;
      dispatch("refresh");
    } catch (err) {
      withdrawError = err.message || "Failed to withdraw leave";
    } finally {
      withdrawing = false;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if item}
  <div class="modal-overlay" role="dialog" aria-modal="true" on:click|self={() => (item = null)}>
    <div class="modal">
      <div class="modal-header">
        <h3>Leave Request Details</h3>
        <button class="close-btn" on:click={() => (item = null)} aria-label="Close">✕</button>
      </div>

      <div class="modal-body">
        <div class="detail-top">
          <div>
            <div class="detail-name">{item.profile_name || item.staff_name || item.name}</div>
            <div class="detail-sub">
              {item.requester_position || ""} • {item.staff_id || item.id}
              {#if item.profile_department || item.department}
                • {item.profile_department || item.department}
              {/if}
            </div>
          </div>
          <span class="status-pill status-{(item.status || '').toLowerCase().replace(/\s+/g, '-')}">{item.status}</span>
        </div>

        <div class="detail-grid">
          <div class="field">
            <span class="field-label">Leave Type</span>
            <span class="field-value">{getLeaveFullName(item.leave_type || item.leaveType)}</span>
          </div>
          <div class="field">
            <span class="field-label">Duration</span>
            <span class="field-value">{item.total_days ?? item.totalDays ?? "-"} day(s)</span>
          </div>
          <div class="field">
            <span class="field-label">Requested On</span>
            <span class="field-value">{fmt2(item.created_at || item.createdAt)}</span>
          </div>
          <div class="field">
            <span class="field-label">From</span>
            <span class="field-value">{fmt2(item.date_from || item.dateFrom)}</span>
          </div>
          <div class="field">
            <span class="field-label">To</span>
            <span class="field-value">{fmt2(item.date_until || item.dateTo)}</span>
          </div>
          <div class="field">
            <span class="field-label">Remaining Annual</span>
            <span class="field-value">{item.leave_entitlement_annual ?? "-"} day(s)</span>
          </div>
          <div class="field">
            <span class="field-label">Remaining Medical</span>
            <span class="field-value">{item.leave_entitlement_medical ?? "-"} day(s)</span>
          </div>
          {#if item.requester_role}
            <div class="field">
              <span class="field-label">Role</span>
              <span class="field-value">{item.requester_role}</span>
            </div>
          {/if}
        </div>

        {#if item.reason}
          <div class="detail-section">
            <span class="section-label">Reason</span>
            <div class="section-text">{item.reason}</div>
          </div>
        {/if}

        {#if item.cancellation_reason}
          <div class="detail-section">
            <span class="section-label">Cancellation Reason</span>
            <div class="section-text">{item.cancellation_reason}</div>
          </div>
        {/if}

        <div class="detail-section">
          <span class="section-label">Attachment</span>
          {#if item.attachment_path}
            <a class="attach-link" href={attachmentUrl(item.attachment_path)} target="_blank" rel="noopener">
              View Attachment
            </a>
          {:else}
            <div class="no-attach">No attachment</div>
          {/if}
        </div>

        {#if canWithdraw}
          <div class="withdraw-section">
            {#if withdrawDone}
              <div class="withdraw-success">
                Leave withdrawn successfully. The employee's leave balance has been restored.
              </div>
            {:else if confirmWithdraw}
              <div class="withdraw-confirm">
                <p>Are you sure you want to withdraw this approved leave? The balance of
                  <strong>{item.total_days ?? item.totalDays ?? 0} day(s)</strong> will be returned to the employee.</p>
                {#if withdrawError}
                  <div class="withdraw-error">{withdrawError}</div>
                {/if}
                <div class="withdraw-actions">
                  <button class="btn-cancel" disabled={withdrawing} on:click={() => (confirmWithdraw = false)}>Back</button>
                  <button class="btn-danger" disabled={withdrawing} on:click={confirmWithdrawLeave}>
                    {withdrawing ? "Withdrawing..." : "Confirm Withdraw"}
                  </button>
                </div>
              </div>
            {:else}
              {#if withdrawError}
                <div class="withdraw-error">{withdrawError}</div>
              {/if}
              <button class="btn-danger" on:click={startWithdraw}>Withdraw Leave</button>
            {/if}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn-close" on:click={() => (item = null)}>Close</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.35);
    z-index: 80;
    animation: fadeIn 0.15s ease;
  }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

  .modal {
    width: min(560px, 96vw);
    background: #fff;
    border-radius: 18px;
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.25);
    overflow: hidden;
  }

  .modal-header {
    padding: 14px 18px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-header h3 {
    margin: 0;
    font-weight: 700;
    font-size: 20px;
    color: #0F9B8E;
  }

  .close-btn {
    border: none;
    background: transparent;
    font-size: 22px;
    cursor: pointer;
    color: #475569;
  }

  .modal-body {
    padding: 22px;
    max-height: 72vh;
    overflow: auto;
  }

  .detail-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 16px;
  }

  .detail-name {
    font-size: 18px;
    font-weight: 800;
    color: #000;
    margin: 0;
  }

  .detail-sub {
    font-size: 13px;
    color: #64748b;
    margin: 2px 0 0;
  }

  .status-pill {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .status-approved { background: #e8f8f3; color: #116a51; }
  .status-pending { background: #fff8e7; color: #8a5b00; }
  .status-rejected { background: #fdecec; color: #9b1c1c; }
  .status-cancelled { background: #f1f5f9; color: #475569; }
  .status-cancellation-pending { background: #fef08a; color: #854d0e; }
  .status-invalid { background: #a5a5a7; color: #fff; }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px 18px;
    margin-bottom: 14px;
  }

  .field-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    font-weight: 800;
    color: #64748b;
    display: block;
  }

  .field-value {
    font-size: 14px;
    color: #0f172a;
    font-weight: 600;
  }

  .detail-section {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px;
    margin-top: 12px;
  }

  .section-label {
    display: block;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    font-weight: 800;
    color: #64748b;
  }

  .section-text {
    margin-top: 4px;
    color: #334155;
    font-size: 13px;
  }

  .attach-link {
    display: inline-block;
    margin-top: 4px;
    color: #2563eb;
    text-decoration: underline;
    font-size: 12px;
  }

  .no-attach {
    margin-top: 4px;
    color: #64748b;
    font-size: 12px;
  }

  .modal-footer {
    padding: 14px 18px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
    background: #f9fafb;
  }

  .btn-close {
    background: #fff;
    color: #1F2937;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 0.6rem 1rem;
    font-weight: 600;
    cursor: pointer;
  }

  .withdraw-section {
    margin-top: 14px;
    border-top: 1px dashed #e2e8f0;
    padding-top: 14px;
  }

  .btn-danger {
    width: 100%;
    background: #fff;
    color: #b91c1c;
    border: 1px solid #fecaca;
    border-radius: 10px;
    padding: 0.6rem 1rem;
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }

  .btn-danger:hover:not(:disabled) {
    background: #fef2f2;
    border-color: #ef4444;
  }

  .btn-danger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .withdraw-confirm {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 10px;
    padding: 12px;
  }

  .withdraw-confirm p {
    margin: 0 0 10px;
    color: #7f1d1d;
    font-size: 13px;
  }

  .withdraw-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .withdraw-actions .btn-danger {
    width: auto;
  }

  .btn-cancel {
    background: #fff;
    color: #1F2937;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 0.5rem 1rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }

  .btn-cancel:hover:not(:disabled) {
    border-color: #94a3b8;
  }

  .btn-cancel:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .withdraw-error {
    margin-bottom: 10px;
    background: #fee2e2;
    color: #991b1b;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 12px;
  }

  .withdraw-success {
    background: #e8f8f3;
    border: 1px solid #cbeee3;
    color: #116a51;
    border-radius: 10px;
    padding: 12px;
    font-size: 13px;
    font-weight: 600;
  }

  @media (max-width: 480px) {
    .detail-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
