<script>
  import { onMount } from "svelte";
  import { PUBLIC_VITE_API_BASE } from '$env/static/public';

  // 'admin' | 'manager' | 'director'
  export let role = "admin";

  const leaveTypeShortName = {
    AL: "Annual / Emergency",
    MC: "Medical",
    MAT: "Maternity",
    PAT: "Paternity",
    COMP_A: "Compassionate A",
    COMP_B: "Compassionate B",
    MAR: "Marriage",
    HOSP: "Hospitalization",
    UNPAID: "Unpaid"
  };

  const getLeaveShortName = (code) => leaveTypeShortName[code] || code;
  const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString() : "-");

  let me = null;
  let meDept = null;
  let loading = true;

  let pendingLeave = [];
  let pendingCancel = [];

  let deptFilter = "All";

  $: parsedDepts = (meDept || "")
    .split(",")
    .map(d => d.trim())
    .filter(Boolean);

  $: hasMultipleDepts = parsedDepts.length > 1;

  $: deptOptions = ["All", ...Array.from(new Set(parsedDepts)).sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" })
  )];

  const deptList = (v) =>
    String(v || "").split(",").map((d) => d.trim());

  $: visibleLeave =
    deptFilter === "All"
      ? pendingLeave
      : pendingLeave.filter((i) =>
          deptList(i.profile_department || i.department).includes(deptFilter)
        );

  $: visibleCancel =
    deptFilter === "All"
      ? pendingCancel
      : pendingCancel.filter((i) =>
          deptList(i.profile_department || i.department).includes(deptFilter)
        );

  let leaveDetailsOpen = {};

  // Confirmation step state: { kind: 'leave'|'cancel', verb: 'approve'|'reject', item }
  let confirmState = null;
  let busy = false;

  // Full detail modal for a specific request
  let detailItem = null;

  let toast = {
    show: false,
    type: "success",
    title: "",
    message: "",
    closing: false
  };

  function showToast(message, type = "success", title = "", duration = 3000) {
    toast = {
      show: true,
      type,
      title: title || type.charAt(0).toUpperCase() + type.slice(1),
      message,
      closing: false
    };

    setTimeout(() => {
      toast.closing = true;
      setTimeout(() => {
        toast.show = false;
        toast.closing = false;
      }, 300);
    }, duration);
  }

  function canApprove(item) {
    if (role === "admin") return true;

    if (role === "manager") {
      // A user can NEVER approve their own application
      const myId = String(me?.staff_id || me?.id || "").trim();
      const recordId = String(item.staff_id || "").trim();
      if (myId && recordId === myId) return false;

      // Only lock to "View only" if the target request role is literally "Director"
      const myRole = String(me?.role || "").toLowerCase().trim();
      const myDept = String(meDept || me?.department || "").toLowerCase().trim();
      const targetRole = String(item.requester_role || "").toLowerCase().trim();

      if (myRole === "manager" && myDept === "director" && targetRole === "director") {
        return false;
      }

      return true;
    }

    if (role === "director") {
      if (me?.role === "Director") {
        return item.staff_id === me.staffId;
      }
      return true;
    }

    return false;
  }

  async function loadRequests() {
    try {
      const res = await fetch(`${PUBLIC_VITE_API_BASE}/api/leave-requests`, {
        credentials: "include"
      });

      if (!res.ok) {
        console.error("Failed to fetch leave requests:", res.status);
        return;
      }

      const all = await res.json();
      let view = all;

      if (role === "manager" && me?.role === "Manager") {
        view = all.filter((r) => {
          // Hide my own requests from myself
          const myId = String(me?.staff_id || me?.id || "").trim();
          const recordId = String(r.staff_id || "").trim();
          if (myId && recordId === myId) return false;

          const currentManagerDept = String(meDept || me?.department || "").toLowerCase().trim();
          const employeeDept = String(
            r.profile_department || r.staff_department || r.department || ""
          ).toLowerCase().trim();
          const employeeRole = String(r.requester_role || "").toLowerCase().trim();

          // Manager of the Director dept sees Director staff + all Managers
          if (currentManagerDept === "director") {
            return employeeDept === "director" || employeeRole === "manager";
          }

          // Normal manager rule (supports multiple comma-separated departments)
          const managerDepartmentsArray = currentManagerDept.split(",").map((d) => d.trim());
          const employeeDepartmentsArray = employeeDept.split(",").map((d) => d.trim());

          return (
            employeeDepartmentsArray.some((d) => managerDepartmentsArray.includes(d)) &&
            employeeRole === "staff"
          );
        });
      } else if (role === "director" && me?.role === "Director") {
        view = all.filter((r) => {
          // Own requests (any status)
          if (r.staff_id === me.staffId) return true;

          // All managers (any department)
          if (r.requester_role === "Manager") return true;

          return false;
        });
      }

      pendingLeave = view.filter(
        (p) => String(p.status || "").toLowerCase().trim() === "pending"
      );

      pendingCancel = view.filter((p) => {
        const stat = String(p.status || "").toLowerCase().trim();
        return stat === "cancellation_pending" || stat === "cancellation pending";
      });
    } catch (err) {
      console.error("Error loading leave requests:", err);
    }
  }

  onMount(async () => {
    try {
      if (role !== "admin") {
        const res = await fetch(`${PUBLIC_VITE_API_BASE}/api/me/photo`, {
          credentials: "include"
        });
        if (res.ok) {
          me = await res.json();
          meDept = me?.department;
        }
      }

      await loadRequests();
    } catch (err) {
      console.error("Error initialising leave approvals:", err);
    }

    loading = false;
  });

  function askConfirm(item, verb, kind) {
    confirmState = { item, verb, kind };
  }

  function closeConfirm() {
    if (busy) return;
    confirmState = null;
  }

  async function patchStatus(id, status) {
    const res = await fetch(`${PUBLIC_VITE_API_BASE}/api/leave-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Server failed to process the request");
    }
  }

  async function performConfirm() {
    if (!confirmState || busy) return;

    const { item, verb, kind } = confirmState;
    const id = item.leave_id ?? item.leaveid ?? item.id;

    const statusMatrix = {
      leave: { approve: "approved", reject: "rejected" },
      cancel: {
        approve: "cancelled",
        reject: role === "admin" ? "cancellation_rejected" : "approved"
      }
    };

    busy = true;

    try {
      await patchStatus(id, statusMatrix[kind][verb]);

      if (kind === "leave") {
        showToast(
          verb === "approve"
            ? "Leave request approved successfully."
            : "Leave request rejected.",
          "success"
        );
      } else {
        showToast(
          verb === "approve"
            ? "Leave cancellation approved."
            : "Cancellation request rejected.",
          "success"
        );
      }

      confirmState = null;
      await loadRequests();
      window.dispatchEvent(new Event("pending-updated"));
    } catch (err) {
      console.error("Approval action error:", err);
      showToast(err.message || "Failed to process the request.", "error");
    }

    busy = false;
  }

  function openDetails(item) {
    detailItem = item;
  }

  function closeDetails() {
    detailItem = null;
  }

  function attachmentUrl(path) {
    if (!path) return "";
    return `${PUBLIC_VITE_API_BASE}${path?.startsWith("/") ? "" : "/"}${path}`;
  }

  function handleKey(e) {
    if (e.key === "Escape") {
      if (confirmState && !busy) confirmState = null;
      if (detailItem) detailItem = null;
    }
  }
</script>

<svelte:window on:keydown={handleKey} />

<style>
  :root { --primary:#0F9B8E; --ink:#0c4a6e; --muted:#64748b; --line:#e5e7eb; --soft:#f8fafc; }

  /* ===== Layout ===== */
  .main{ padding:1.5rem; }
  .page-head{ display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:18px; flex-wrap:wrap; }

  /* ===== Sections ===== */
  .sub-ttl{ margin:0 0 12px; font-weight:600; font-size:var(--fs-section-heading, 16px); letter-spacing:.2px; color:var(--ink, #1F2937); }

  /* ===== Department filter ===== */
  .dept-toolbar{ display:flex; align-items:center; gap:10px; margin:0 0 18px; }
  .filter-icon{ width:16px; height:16px; color:var(--muted, #6B7280); flex-shrink:0; }
  .filter-label{ font-size:14px; font-weight:600; color:var(--ink, #1F2937); white-space:nowrap; }
  .filter-select select{
    appearance:none; -webkit-appearance:none;
    background:#fff url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b7280' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 10px center;
    border:1px solid var(--line,#e5e7eb); border-radius:10px; padding:.5rem 2rem .5rem .8rem;
    font-size:14px; font-weight:600; color:var(--ink,#1F2937); cursor:pointer;
    min-width:210px;
  }
  .filter-select select:focus{ outline:none; border-color:#0F9B8E; box-shadow:0 0 0 3px rgba(15,155,142,.15); }

  /* ===== Cards grid ===== */
  .cards-grid{ display:grid; gap:14px; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); }

  /* ===== Pending card ===== */
  .pending-card{ background:#fff; border:1px solid var(--line,#e5e7eb); border-radius:12px; padding:14px 16px; box-shadow:0 2px 10px rgba(15,23,42,.06); display:flex; flex-direction:column; }
  .pending-card .row1{ display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
  .pending-card .name{ font-weight:800; color:#000; font-size:16px; }
  .pending-card .sub{ font-size:12px; color:#64748b; margin-top:2px; }
  .pill.type{ background:#eef2ff; color:#0f172a; border:1px solid #e5e7eb; padding:4px 10px; border-radius:9999px; font-size:12px; font-weight:700; white-space:nowrap; }
  .unpaid-pill{
    background-color: rgba(239, 68, 68, 0.18) !important;
    color: #b91c1c !important;
    border: 1px solid rgba(239, 68, 68, 0.35) !important;
  }
  .cancel-pill{ background:#fee2e2; color:#b91c1c; }
  .kv{ display:grid; grid-template-columns:repeat(2,1fr); gap:6px 14px; margin:10px 0 6px; font-size:12px; }
  .kv .k{ font-weight:700; color:#334155; }
  .kv .v{ color:#0f172a; margin-left:6px; }
  .actions{ display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:10px; }
  .actions .left{ display:flex; gap:8px; align-items:center; }
  .actions .right-links{ display:flex; align-items:center; gap:10px; }
  .link{ background:none; border:none; padding:0; font:inherit; text-decoration:underline; cursor:pointer; color:#0c4a6e; font-size:12px; }
  .view-only{ font-size:12px; color:#64748b; font-style:italic; }
  .btn-approve, .btn-reject, .btn-details{ border:none; border-radius:8px; padding:.55rem .9rem; font-weight:700; cursor:pointer; min-width:50px; line-height:1; font-size:12px; }
  .btn-approve{ background:#16a34a; color:#fff; }
  .btn-reject{ background:#dc2626; color:#fff; }
  .btn-details{ background:#f1f5f9; color:#334155; }
  .btn-approve:hover, .btn-reject:hover, .btn-details:hover{ filter:brightness(.97); }
  .btn-approve:disabled, .btn-reject:disabled{ opacity:.6; cursor:not-allowed; }

  /* ===== Expanded details box ===== */
  .expand-box{ background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:8px; margin-top:10px; }
  .expand-box .lbl{ color:#0c4a6e; font-size:13px; font-weight:700; }
  .expand-box .txt{ margin-top:4px; color:#334155; font-size:12px; }
  .attach-link{ color:#2563eb; text-decoration:underline; font-size:12px; }
  .no-attach{ margin-top:4px; color:#64748b; font-size:12px; }

  /* ===== Empty / loading states ===== */
  .empty-state{ background:#fff; border:1px dashed #cbd5e1; border-radius:14px; padding:36px 20px; text-align:center; color:#64748b; }
  .empty-state strong{ display:block; font-size:16px; color:#0c4a6e; margin-bottom:4px; }
  .loading{ color:var(--muted, #6B7280); text-align:center; padding:30px 0; font-weight:600; }

  /* ===== Modals ===== */
  .modal-wrap{ position:fixed; inset:0; display:grid; place-items:center; background:rgba(0,0,0,.35); z-index:80; animation:fadeIn .15s ease; }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  .modal{ width:min(560px, 96vw); background:#fff; border-radius:18px; box-shadow:0 14px 40px rgba(0,0,0,.25); overflow:hidden; }
  .modal-hd{ padding:14px 18px; border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:space-between; position:relative; }
  .modal-ttl{ font-weight:700; font-size:20px; color:#0F9B8E; width:100%; text-align:center; }
  .modal-x{ border:none; background:transparent; font-size:22px; cursor:pointer; color:#475569; position:absolute; right:18px; }
  .modal-bd{ padding:22px; max-height:72vh; overflow:auto; }
  .muted{ font-size:13px; color:#64748b; }
  .form-ft{ display:flex; justify-content:flex-end; gap:10px; padding-top:10px; }
  .btn-ghost{ background:#fff; color:var(--ink,#1F2937); border:1px solid var(--line,#e5e7eb); border-radius:10px; padding:.7rem 1rem; font-weight:600; cursor:pointer; }
  .btn-ghost:disabled{ opacity:.6; cursor:not-allowed; }
  .btn-confirm-approve{ background:var(--success,#16A34A); color:#fff; border:none; border-radius:10px; padding:.7rem 1.2rem; font-weight:600; cursor:pointer; }
  .btn-confirm-reject{ background:var(--danger,#DC2626); color:#fff; border:none; border-radius:10px; padding:.7rem 1.2rem; font-weight:600; cursor:pointer; }
  .btn-confirm-approve:hover, .btn-confirm-reject:hover{ filter:brightness(.96); }
  .btn-confirm-approve:disabled, .btn-confirm-reject:disabled{ opacity:.6; cursor:not-allowed; }

  /* ===== Detail modal ===== */
  .detail-name{ font-size:18px; font-weight:800; color:#000; margin:0; }
  .detail-sub{ font-size:13px; color:#64748b; margin:2px 0 14px; }
  .detail-kv{ display:grid; grid-template-columns:repeat(2,1fr); gap:10px 18px; margin-bottom:14px; }
  .detail-kv .k{ font-size:11px; text-transform:uppercase; letter-spacing:.4px; font-weight:800; color:#64748b; display:block; }
  .detail-kv .v{ font-size:14px; color:#0f172a; font-weight:600; }
  .detail-section{ background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-top:12px; }
  .status-pill{ display:inline-block; padding:4px 12px; border-radius:9999px; font-size:12px; font-weight:800; background:#fef3c7; color:#92400e; }

  /* ===== Toast ===== */
  .toast-stack{ position:fixed; top:20px; right:20px; z-index:9999; }
  .toast-item{ display:flex; align-items:flex-start; background:#fff; border-radius:8px; min-width:340px; max-width:400px; padding:12px 14px; box-shadow:0 10px 25px rgba(0,0,0,.15); animation:slideIn .25s ease; border-left:5px solid; }
  .toast-icon{ width:28px; height:28px; border-radius:999px; display:flex; align-items:center; justify-content:center; margin-right:12px; margin-top:2px; }
  .toast-svg{ width:20px; height:20px; fill:#fff; }
  .toast-body{ flex:1; }
  .toast-body strong{ display:block; font-size:14px; color:#111827; margin-bottom:2px; }
  .toast-body p{ margin:0; font-size:13px; color:#4b5563; }
  .toast-close{ background:transparent; border:none; font-size:18px; cursor:pointer; color:#9ca3af; margin-left:10px; }
  .toast-close:hover{ color:#111827; }
  .toast-item.success{ border-color:var(--success, #16A34A); }
  .toast-item.success .toast-icon{ background:var(--success, #16A34A); }
  .toast-item.error{ border-color:#DC2626; }
  .toast-item.error .toast-icon{ background:#DC2626; }
  .toast-item.info{ border-color:#3b82f6; }
  .toast-item.info .toast-icon{ background:#3b82f6; }
  .toast-item.warning{ border-color:#f59e0b; }
  .toast-item.warning .toast-icon{ background:#f59e0b; }
  @keyframes slideIn{ from{opacity:0; transform:translateX(24px)} to{opacity:1; transform:translateX(0)} }
  @keyframes fadeOut{ from{opacity:1; transform:translateX(0)} to{opacity:0; transform:translateX(24px)} }
  .toast-item.closing{ animation:fadeOut .25s ease forwards; }

  /* ===== Responsive ===== */
  @media (max-width:740px){
    .cards-grid{ grid-template-columns:1fr; }
    .page-head{ flex-direction:column; align-items:stretch; }
    .detail-kv{ grid-template-columns:1fr; }
    .filter-select select{ min-width:0; width:100%; }
    .dept-toolbar{ flex-wrap:wrap; }
  }
</style>

<div class="main">
  <div class="page-head">
    {#if hasMultipleDepts}
    <!-- Department filter -->
    <div class="dept-toolbar">
      <svg class="filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 4h18l-7 8v6l-4 2v-8l-7-8z"/>
      </svg>
      <label class="filter-label" for="approvals-dept-filter">Department</label>
      <div class="filter-select">
        <select id="approvals-dept-filter" bind:value={deptFilter} aria-label="Filter approvals by department">
          {#each deptOptions as d}<option value={d}>{d}</option>{/each}
        </select>
      </div>
    </div>
    {/if}
  </div>

  {#if loading}
    <div class="loading">Loading pending requests…</div>
  {:else}
    <!-- ======================== -->
    <!--   PENDING LEAVE APPROVAL -->
    <!-- ======================== -->
    <div class="section">
      {#if visibleLeave.length > 0}
        <h3 class="sub-ttl">Pending Leave Approval ({visibleLeave.length})</h3>
        <div class="cards-grid">
          {#each visibleLeave as item (item.leave_id)}
            <div class="pending-card">
              <div class="row1">
                <div class="who">
                  <div class="name">{item.profile_name || item.staff_name}</div>
                  <div class="sub">
                    {item.requester_position} • {item.staff_id} • {item.profile_department || item.department}
                  </div>
                </div>
                <span class={`pill type ${item.leave_type === "UNPAID" ? "unpaid-pill" : ""}`}>
                  {getLeaveShortName(item.leave_type)}
                </span>
              </div>

              <div class="kv">
                <div>
                  <span class="k">From:</span>
                  <span class="v">{fmt(item.date_from)}</span>
                </div>
                <div>
                  <span class="k">To:</span>
                  <span class="v">{fmt(item.date_until)}</span>
                </div>
                <div>
                  <span class="k">Requested:</span>
                  <span class="v">{fmt(item.created_at)}</span>
                </div>
                <div>
                  <span class="k">Remaining:</span>
                  <span class="v">{item.leave_entitlement_annual ?? "-"} day(s)</span>
                </div>
              </div>

              <div class="actions">
                <div class="left">
                  {#if canApprove(item)}
                    <button class="btn-approve" on:click={() => askConfirm(item, "approve", "leave")}>Approve</button>
                    <button class="btn-reject" on:click={() => askConfirm(item, "reject", "leave")}>Reject</button>
                  {:else}
                    <span class="view-only">View only</span>
                  {/if}
                </div>

                <div class="right-links">
                  <button
                    type="button"
                    class="link"
                    on:click={() => leaveDetailsOpen[item.leave_id] = !leaveDetailsOpen[item.leave_id]}
                  >
                    {leaveDetailsOpen[item.leave_id] ? "Hide Details" : "Leave Details"}
                  </button>

                  <button class="btn-details" on:click={() => openDetails(item)}>Details</button>
                </div>
              </div>

              {#if leaveDetailsOpen[item.leave_id]}
                <div class="expand-box">
                  <div>
                    <span class="lbl">Reason:</span>
                    <div class="txt">{item.reason}</div>
                  </div>

                  <div style="margin-top:8px;">
                    <span class="lbl">Attachment:</span>
                    {#if item.attachment_path}
                      <div style="margin-top:4px;">
                        <a class="attach-link" href={attachmentUrl(item.attachment_path)} target="_blank" rel="noopener">
                          View Attachment
                        </a>
                      </div>
                    {:else}
                      <div class="no-attach">No attachment</div>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <!-- =============================== -->
      <!--  PENDING CANCELLATION APPROVAL -->
      <!-- =============================== -->
      <div class="section" style={visibleLeave.length > 0 ? "margin-top:24px;" : ""}>
        {#if visibleCancel.length > 0}
          <h3 class="sub-ttl">Pending Cancellation Approval ({visibleCancel.length})</h3>
          <div class="cards-grid">
            {#each visibleCancel as item (item.leave_id)}
              <div class="pending-card">
                <div class="row1">
                  <div class="who">
                    <div class="name">{item.profile_name || item.staff_name}</div>
                    <div class="sub">
                      {item.requester_position} • {item.staff_id} • {item.profile_department || item.department}
                    </div>
                  </div>
                  <span class="pill type cancel-pill">
                    Cancellation: {getLeaveShortName(item.leave_type)}
                  </span>
                </div>

                <div class="kv">
                  <div>
                    <span class="k">From:</span>
                    <span class="v">{fmt(item.date_from)}</span>
                  </div>
                  <div>
                    <span class="k">To:</span>
                    <span class="v">{fmt(item.date_until)}</span>
                  </div>
                  <div>
                    <span class="k">Requested:</span>
                    <span class="v">{fmt(item.created_at)}</span>
                  </div>
                  <div>
                    <span class="k">Remaining:</span>
                    <span class="v">{item.leave_entitlement_annual ?? "-"} day(s)</span>
                  </div>
                </div>

                <div class="actions">
                  <div class="left">
                    {#if canApprove(item)}
                      <button class="btn-approve" on:click={() => askConfirm(item, "approve", "cancel")}>Approve</button>
                      <button class="btn-reject" on:click={() => askConfirm(item, "reject", "cancel")}>Reject</button>
                    {:else}
                      <span class="view-only">View only</span>
                    {/if}
                  </div>

                  <div class="right-links">
                    <button
                      type="button"
                      class="link"
                      on:click={() => leaveDetailsOpen[item.leave_id] = !leaveDetailsOpen[item.leave_id]}
                    >
                      {leaveDetailsOpen[item.leave_id] ? "Hide Details" : "Leave Details"}
                    </button>

                    <button class="btn-details" on:click={() => openDetails(item)}>Details</button>
                  </div>
                </div>

                {#if leaveDetailsOpen[item.leave_id]}
                  <div class="expand-box">
                    <div>
                      <span class="lbl">Cancellation Reason:</span>
                      <div class="txt">{item.cancellation_reason || "-"}</div>
                    </div>

                    <div style="margin-top:8px;">
                      <span class="lbl">Attachment:</span>
                      {#if item.attachment_path}
                        <div style="margin-top:4px;">
                          <a class="attach-link" href={attachmentUrl(item.attachment_path)} target="_blank" rel="noopener">
                            View Attachment
                          </a>
                        </div>
                      {:else}
                        <div class="no-attach">No attachment</div>
                      {/if}
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      {#if visibleLeave.length === 0 && visibleCancel.length === 0}
        {#if pendingLeave.length > 0 || pendingCancel.length > 0}
          <div class="empty-state">
            <strong>No requests for {deptFilter}</strong>
            Try selecting a different department.
          </div>
        {:else}
          <div class="empty-state">
            <strong>No pending requests</strong>
            You're all caught up. New leave requests will appear here.
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<!-- ======================= -->
<!-- CONFIRM ACTION MODAL    -->
<!-- ======================= -->
{#if confirmState}
  <div class="modal-wrap" style="z-index:90;" role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-hd">
        <div class="modal-ttl">
          {confirmState.verb === "approve" ? "Confirm Approval" : "Confirm Rejection"}
        </div>
        <button class="modal-x" on:click={closeConfirm} disabled={busy}>✕</button>
      </div>
      <div class="modal-bd" style="text-align:center;">
        <p style="margin:0 0 6px;">
          Are you sure you want to
          <strong>{confirmState.verb}</strong>
          {#if confirmState.kind === "cancel"}the cancellation request{:else}the leave request{/if}
          from
          <strong>{confirmState.item.profile_name || confirmState.item.staff_name}</strong>?
        </p>
        <p class="muted">This action is final and will be recorded.</p>

        <div class="form-ft" style="margin-top:20px; justify-content:center;">
          <button class="btn-ghost" on:click={closeConfirm} disabled={busy}>Cancel</button>
          <button
            class={confirmState.verb === "approve" ? "btn-confirm-approve" : "btn-confirm-reject"}
            on:click={performConfirm}
            disabled={busy}
          >
            {busy ? "Processing…" : confirmState.verb === "approve" ? "Yes, Approve" : "Yes, Reject"}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- ======================= -->
<!-- REQUEST DETAIL MODAL    -->
<!-- ======================= -->
{#if detailItem}
  <div class="modal-wrap" role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-hd">
        <div class="modal-ttl">Leave Request Details</div>
        <button class="modal-x" on:click={closeDetails}>✕</button>
      </div>
      <div class="modal-bd">
        <h3 class="detail-name">{detailItem.profile_name || detailItem.staff_name}</h3>
        <p class="detail-sub">
          {detailItem.requester_position} • Staff ID: {detailItem.staff_id} • {detailItem.profile_department || detailItem.department}
        </p>

        <div class="detail-kv">
          <div>
            <span class="k">Request Type</span>
            <span class="v">
              {String(detailItem.status || "").toLowerCase().includes("cancel") ? "Cancellation" : "New Leave Request"}
            </span>
          </div>
          <div>
            <span class="k">Status</span>
            <span class="v"><span class="status-pill">{detailItem.status}</span></span>
          </div>
          <div>
            <span class="k">Leave Type</span>
            <span class="v">{getLeaveShortName(detailItem.leave_type)}</span>
          </div>
          <div>
            <span class="k">Remaining Annual</span>
            <span class="v">{detailItem.leave_entitlement_annual ?? "-"} day(s)</span>
          </div>
          <div>
            <span class="k">From</span>
            <span class="v">{fmt(detailItem.date_from)}</span>
          </div>
          <div>
            <span class="k">To</span>
            <span class="v">{fmt(detailItem.date_until)}</span>
          </div>
          <div>
            <span class="k">Requested On</span>
            <span class="v">{fmt(detailItem.created_at)}</span>
          </div>
          <div>
            <span class="k">Role</span>
            <span class="v">{detailItem.requester_role || "-"}</span>
          </div>
        </div>

        {#if String(detailItem.status || "").toLowerCase().includes("cancel")}
          <div class="detail-section">
            <span class="k" style="display:block; font-size:11px; text-transform:uppercase; letter-spacing:.4px; font-weight:800; color:#64748b;">Cancellation Reason</span>
            <div style="margin-top:4px; color:#334155; font-size:13px;">{detailItem.cancellation_reason || "-"}</div>
          </div>
        {:else}
          <div class="detail-section">
            <span class="k" style="display:block; font-size:11px; text-transform:uppercase; letter-spacing:.4px; font-weight:800; color:#64748b;">Reason</span>
            <div style="margin-top:4px; color:#334155; font-size:13px;">{detailItem.reason || "-"}</div>
          </div>
        {/if}

        <div class="detail-section">
          <span class="k" style="display:block; font-size:11px; text-transform:uppercase; letter-spacing:.4px; font-weight:800; color:#64748b;">Attachment</span>
          {#if detailItem.attachment_path}
            <div style="margin-top:4px;">
              <a class="attach-link" href={attachmentUrl(detailItem.attachment_path)} target="_blank" rel="noopener">
                View Attachment
              </a>
            </div>
          {:else}
            <div class="no-attach">No attachment</div>
          {/if}
        </div>

        <div class="form-ft">
          <button class="btn-ghost" on:click={closeDetails}>Close</button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if toast.show}
  <div class="toast-stack">
    <div class="toast-item {toast.type} {toast.closing ? 'closing' : ''}">
      <div class="toast-icon">
        {#if toast.type === 'success'}
          <svg viewBox="0 0 24 24" class="toast-svg">
            <path d="M9.5 16.2L4.8 11.5l1.4-1.4 3.3 3.3 8.1-8.1 1.4 1.4z"/>
          </svg>
        {/if}

        {#if toast.type === 'error'}
          <svg viewBox="0 0 24 24" class="toast-svg">
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm3.5 13.1-1.4 1.4L12 13.4l-2.1 2.1-1.4-1.4L10.6 12 8.5 9.9l1.4-1.4 2.1 2.1 2.1-2.1 1.4 1.4L13.4 12z"/>
          </svg>
        {/if}

        {#if toast.type === 'info'}
          <svg viewBox="0 0 24 24" class="toast-svg">
            <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/>
          </svg>
        {/if}

        {#if toast.type === 'warning'}
          <svg viewBox="0 0 24 24" class="toast-svg">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
        {/if}
      </div>

      <div class="toast-body">
        <strong>{toast.title}</strong>
        <p>{toast.message}</p>
      </div>

      <button class="toast-close" on:click={() => (toast.show = false)}>×</button>
    </div>
  </div>
{/if}
