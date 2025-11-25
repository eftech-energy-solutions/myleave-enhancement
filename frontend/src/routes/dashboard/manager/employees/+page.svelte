<script>
  import { onMount } from "svelte";

  /* ================================
      1) MANAGER & EMPLOYEE STATE
     ================================ */

  let manager = null;
  let managerDept = null;

  let employees = [];
  let filteredEmployees = [];
  let detailsById = {};

  let detailsOpen = false;
  let selectedEmp = null;
  let detailsForm = null;
  let leaveDetailsOpen = {};

  const fmt = (iso) =>
    iso ? new Date(iso).toLocaleDateString() : "-";

  const formatDate = (dbDate) => {
    if (!dbDate) return "";
    const d = new Date(dbDate);
    return !isNaN(d) ? d.toISOString().split("T")[0] : "";
  };

  /* ================================
      2) LOAD MANAGER + EMPLOYEES
     ================================ */

  onMount(async () => {
    try {
      const userRes = await fetch("/api/me/photo", {
        credentials: "include",
      });
      const userData = await userRes.json();
      manager = userData;
      managerDept = userData?.department;

      await loadPendingRequests();
      await loadEmployees();
      await loadPending();
    } catch (err) {
      console.error(
        "❌ Error loading manager or employees:",
        err
      );
    }
  });

  /* ================================
      EMPLOYEES (FIXED STRUCTURE)
     ================================ */

  async function loadEmployees() {
    try {
      const res = await fetch(
        "http://localhost:5000/api/employee",
        {
          credentials: "include",
        }
      );
      const data = await res.json();

      if (!res.ok) {
        console.error(
          "❌ Failed to fetch employees:",
          data
        );
        return;
      }

      // Build full list
      const fullProfileList = data.map((e) => {
        const fixedPhotoUrl = e.photourl
          ? e.photourl.startsWith("http")
            ? e.photourl
            : `http://localhost:5000${e.photourl}`
          : "";

        return {
          id: e.staff_id,
          empId: e.staff_id,
          name: e.full_name,
          position: e.position, 
          role: e.role,
          department: e.department,
          email: e.email,
          photoUrl: fixedPhotoUrl,
          employmentDate: formatDate(e.employment_date),
          confirmationDate: formatDate(e.confirmation_date),
          terminationDate: formatDate(e.termination_date),
          gender: e.gender,
          annualLeave: e.leave_entitlement_annual,
          medicalLeave: e.leave_entitlement_medical,
          notes: e.notes,
        };
      });

  // Build detailsById for ALL staff, muncul di employee grid
detailsById = {};
fullProfileList.forEach((emp) => {
  detailsById[emp.id] = structuredClone(emp);
});

// === PENTING: Cari staff yang MASIH ada request pending ===
const pendingIds = new Set(
  pendingRequests
    .filter(
      (r) =>
        r.status === "pending" ||
        r.status === "cancellation_pending" // kalau ada status ni
    )
    .map((r) => r.staff_id)
);

// 1) Filter ONLY employees in manager's department (kalau manager)
let deptFiltered =
  manager?.role === "Manager"
    ? fullProfileList.filter((e) => e.department === managerDept)
    : fullProfileList;

// 2) Buang semua staff yang ada dalam pendingIds
employees = deptFiltered.filter((emp) => !pendingIds.has(emp.empId));

    } catch (err) {
      console.error("⚠️ Error in loadEmployees():", err);
    }
  }

  /* ================================
      3) FILTER BY DEPT
     ================================ */

  $: filteredEmployees = employees;

  /* ================================
      4) PENDING APPROVAL
     ================================ */

  let pending = [];
  let pendingLeave = [];
  let pendingCancel = [];
  let pendingRequests = [];
  let sidebarOpen = false;

  const toggleSidebar = () =>
    (sidebarOpen = !sidebarOpen);

  $: pendingCount = pendingLeave.length + pendingCancel.length;

  async function loadPendingRequests() {
    const res = await fetch("/api/leave-requests",
      { credentials: "include" }
    );
    const all = await res.json();

    const view =
  manager?.role === "Manager"
    ? all.filter((r) => {
        const dept =
          r.profile_department ||
          r.staff_department ||   // ← tambahkan ini
          r.department ||
          "";

        return (
          r.requester_role !== "Manager" &&
          dept === managerDept
        );
      })
    : all;
pendingRequests = view;

  }

  async function loadPending() {
  const res = await fetch("/api/leave-requests", {
    credentials: "include"
  });

  const all = await res.json();

 const view =
  manager?.role === "Manager"
    ? all.filter((r) => {
        const dept =
          r.profile_department ||
          r.staff_department ||   // ← tambahkan ini
          r.department ||
          "";

        return (
          r.requester_role !== "Manager" &&
          dept === managerDept
        );
      })
    : all;



  pending = view;
  pendingRequests = view.filter(
  (r) =>
    r.status === "pending" ||
    r.status === "cancellation_pending"
);
pendingLeave = view.filter(
  r => r.status === "pending"
);

pendingCancel = view.filter(
  r => r.status === "cancellation_pending"
);

}


  /* ================================
      5) openDetails (STRUCTURE FIXED)
     ================================ */

  function openDetails(item) {
    let profile = {};
    let leave = {};

    // From grid
    if (
      typeof item === "string" &&
      detailsById[item]
    ) {
      profile = structuredClone(detailsById[item]);
    }

    // From pending
    if (item && item.leave_id) {
      leave = structuredClone(item);
      const staffId = leave.staff_id;

      if (detailsById[staffId]) {
        profile = structuredClone(
          detailsById[staffId]
        );
      }
    }

    const merged = {
      ...profile,

      leave_id: leave.leave_id,
      leave_type: leave.leave_type,
      request_type: leave.request_type,
      reason: leave.reason,
      date_from: leave.date_from,
      date_until: leave.date_until,
      created_at: leave.created_at,
      status: leave.status,
      attachment_path: leave.attachment_path,

      empId: profile.empId || leave.staff_id,
      name:
        profile.name ||
        leave.profile_name ||
        leave.staff_name ||
        "",
      department:
        profile.department ||
        leave.profile_department ||
        leave.department ||
        "",
      email: profile.email || leave.email || "",
      role:
        profile.role ||
        leave.requester_role ||
        "",

      employmentDate:
        profile.employmentDate || "",
      confirmationDate:
        profile.confirmationDate || "",
      terminationDate:
        profile.terminationDate || "",

      gender: profile.gender || leave.gender || "",

      photoUrl:
        profile.photoUrl ||
        leave.photo_url ||
        "",
      annualLeave:
        profile.annualLeave ||
        leave.leave_entitlement_annual ||
        "",
      medicalLeave:
        profile.medicalLeave ||
        leave.leave_entitlement_medical ||
        "",
      notes: profile.notes || leave.notes || "",
    };

    selectedEmp = merged;
    detailsForm = structuredClone(merged);
    detailsOpen = true;
  }

  /* ================================
      6) APPROVE / REJECT
     ================================ */

  async function approve(id) {
    await fetch(`/api/leave-requests/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "approved",
      }),
    });

    await loadPendingRequests();
    await loadPending();
    await loadEmployees();
  }

  async function reject(id) {
    await fetch(`/api/leave-requests/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "rejected",
      }),
    });

    await loadPendingRequests();
    await loadPending();
    await loadEmployees();
  }
  async function approveCancellation(item) {
  const id = item.leave_id;

  await fetch(`/api/leave-requests/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "cancelled" })
  });

  await loadPendingRequests();
  await loadPending();
  await loadEmployees();
}

async function rejectCancellation(item) {
  const id = item.leave_id;

  await fetch(`/api/leave-requests/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "approved" }) // revert
  });

  await loadPendingRequests();
  await loadPending();
  await loadEmployees();
}


  function approveRequest(item) {
    const id =
      item.leave_id ??
      item.leaveid ??
      item.id;
    approve(id);
  }

  function rejectRequest(item) {
    const id =
      item.leave_id ??
      item.leaveid ??
      item.id;
    reject(id);
  }
</script>



<style>
  :global(html, body){ height:100%; margin:0; }
  :root { --primary:#49bdb3; --ink:#0c4a6e ; --muted:#64748b; --line:#e5e7eb; --soft:#f8fafc; }
  :global(body){ font-family: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans"; background:url('/images/bg.png') no-repeat center center fixed; background-size:cover; overflow-y:auto; }

  /* ===== Layout ===== */
  .main{ padding:1.5rem; }
  .toprow{ display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
  .rightcol{ display:flex; align-items:center; gap:6px; }

  /* ===== Employees grid & card ===== */
  .employees-grid{ display:grid; gap:1rem; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
  .emp-box{ background:#fff; border-radius:12px; padding:1rem; color:#111; box-shadow:0 1px 3px rgba(0,0,0,.08); display:flex; flex-direction:column; min-height:240px; }
  .emp-top{ text-align:center; }
  .emp-box h3{ margin:0; font-size:15px; color:#217859; }
  .emp-box p{ margin:2px 0; font-size:12px; color:#334155; }
  .emp-spacer{ flex:1 1 auto; }
  .emp-actions{ margin-top:auto; display:flex; justify-content:center; }
  .btn{ border:none; border-radius:8px; padding:.42rem .75rem; font-size:12px; cursor:pointer; font-weight:700; }
  .btn.details{ background:#e0f2fe; color:#000; }

  /* ===== Avatar ===== */
  .avatar-wrap, .details-avatar-wrap{ position:relative; width:64px; height:64px; margin:0 auto .5rem; border-radius:9999px; overflow:hidden; background:#e5e7eb; border:1px solid #e5e7eb; }
  .details-avatar-wrap{ width:72px; height:72px; margin:0; }
  .avatar-wrap img, .details-avatar-wrap img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block; border-radius:9999px; }
  .avatar-fallback, .details-avatar-fallback{ position:absolute; inset:0; display:grid; place-items:center; }
  .avatar-fallback svg, .details-avatar-fallback svg{ width:60%; height:60%; }

  /* ===== Sidebar ===== */
  .overlay{ position:fixed; inset:0; background:rgba(0,0,0,.25); opacity:0; pointer-events:none; transition:opacity .2s; z-index:40; }
  .overlay.show{ opacity:1; pointer-events:auto; }
  .sidebar{ position:fixed; right:0; top:0; height:100vh; width:420px; max-width:92vw; background:#fff; box-shadow:-14px 0 32px rgba(0,0,0,.18); transform:translateX(100%); transition:transform .25s ease; z-index:60; display:flex; flex-direction:column; }
  .sidebar.open{ transform:translateX(0); }
  .sidebar-header{ display:flex; justify-content:space-between; align-items:center; padding:14px 16px; border-bottom:1px solid var(--line); }
  .sidebar-title{ font-size:18px; font-weight:700; color:#000; }
  .close-btn{ border:none; background:transparent; font-size:22px; cursor:pointer; color:#475569; }
  .sidebar-body{ padding:14px 16px; overflow:auto; flex:1; }
  .sidebar-footer{ padding:12px 16px; border-top:1px solid var(--line); display:flex; justify-content:flex-end; }
  .cancel-btn{ border:1px solid var(--line); background:#fff; color:#000; border-radius:8px; padding:.45rem .8rem; font-weight:700; cursor:pointer; }
  .sub-ttl{ margin: 0 0 10px; font-weight: 800; font-size: 14px; letter-spacing:.2px; color: var(--ink); }

  .sidebar-tab{ position:fixed; right:0; top:40%; transform:translateY(-50%); display:flex; align-items:center; gap:8px; background:#0c4a6e; color:#fff; padding:.6rem .95rem .6rem 1rem; border-top-left-radius:9999px; border-bottom-left-radius:9999px; cursor:pointer; user-select:none; z-index:50; box-shadow:0 8px 20px rgba(0,0,0,.25); }
  .sidebar-tab .label{ font-weight:700; font-size:14px; }
  .badge{ min-width:22px; height:22px; display:inline-grid; place-items:center; background:#e30707; color:#fff; font-weight:800; border-radius:9999px; font-size:12px; padding:0 6px; }

  /* ===== Pending card ===== */
  .pending-card{ background:#fff; border:1px solid var(--line); border-radius:14px; padding:12px 14px; margin-bottom:12px; box-shadow:0 8px 20px rgba(0,0,0,.06); }
  .pending-card .row1{ display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
  .pending-card .name{ font-weight:800; color:#000; font-size:16px; }
  .pending-card .sub{ font-size:12px; color:#64748b; }
  .pill.type{ background:#eef2ff; color:#0f172a; border:1px solid #e5e7eb; padding:4px 10px; border-radius:9999px; font-size:12px; font-weight:700; white-space:nowrap; }
  .kv{ display:grid; grid-template-columns:repeat(2,1fr); gap:6px 14px; margin:8px 0 6px; font-size:12px; }
  .kv .k{ font-weight:700; color:#334155;}
  .kv .v{ color:#0f172a; margin-left: 6px; }
  .actions{ display:flex; justify-content:space-between; align-items:center; margin-top:10px; }
  .actions .left{ display:flex; gap:8px; align-items:center; }
  .btn-approve, .btn-reject, .btn-details{ border:none; border-radius:8px; padding:.55rem .9rem; font-weight:700; cursor:pointer; min-width:50px; line-height:1; font-size: 12px; }
  .btn-approve{ background:#16a34a; color:#fff; }
  .btn-reject { background:#dc2626; color:#fff; }
  .btn-details{ background:#e0f2fe; color:#0c4a6e; }
  .btn-approve:hover, .btn-reject:hover, .btn-details:hover{ filter:brightness(.97); }

  /* ===== Modals (Add / Details) ===== */
  .modal-wrap{ position:fixed; inset:0; display:grid; place-items:center; background:rgba(0,0,0,.35); z-index:80; animation:fadeIn .15s ease; }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  .modal{ width:min(900px, 96vw); background:#fff; border-radius:18px; box-shadow:0 14px 40px rgba(0,0,0,.25); overflow:hidden; }
  .modal-hd{ padding:14px 18px; border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:space-between; }
  .modal-ttl{ font-weight:700; font-size:22px; color:#49bdb3; }
  .modal-x{ border:none; background:transparent; font-size:22px; cursor:pointer; color:#475569; }
  .modal-bd{ padding:0; max-height:72vh; overflow:auto; }

  .details-layout{ padding:22px; }
  .details-grid-form{ display:grid; grid-template-columns: 1fr 220px; gap:20px; }
  .photo-card{ align-self:flex-start; justify-self:end; width:180px; height:180px; border-radius:20px; background:linear-gradient(180deg,#fff,#f3f4f6); border:1px dashed #d1d5db; display:grid; place-items:center; position:relative; box-shadow:0 8px 20px rgba(0,0,0,.06); }
  .photo-card .cam{ width:48px; height:48px; border-radius:9999px; background:#49bdb3; display:grid; place-items:center; color:#fff; font-size:20px; box-shadow:0 6px 14px rgba(73,189,179,.35); }
  .photo-card .cam svg { width: 24px; height: 24px; }
  .photo-preview{ position:absolute; inset:0; overflow:hidden; border-radius:20px; }
  .photo-preview img{ width:100%; height:100%; object-fit:cover; display:block; }

  .form{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:18px; box-shadow:0 6px 18px rgba(0,0,0,.05); }
  .row{ display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:12px; }
  .row.single{ grid-template-columns:1fr; }
  label{ font-size:12px; color:#374151; font-weight:700; margin:0 0 6px; display:block; }
  .ctl{ display:flex; align-items:center; background:#fff; border:1px solid var(--line); border-radius:12px; padding:10px 12px; box-shadow: inset 0 1px 0 rgba(0,0,0,.02); }
  .ctl:focus-within{ border-color:#49bdb3; box-shadow:0 0 0 3px rgba(73,189,179,.15); }
  .ctl input, .ctl select, .ctl textarea{ border:none; outline:none; width:100%; font-size:14px; color:#111827; background:transparent; }
  .ctl textarea{ min-height:90px; resize:vertical; }
  .ctl.disabled{ background:#f8fafc; }
  .ctl :disabled{ color:#6b7280; }

  .ctl.date { position:relative; }
  .ctl.date::after{ content:""; position:absolute; right:12px; top:50%; transform:translateY(-50%); width:18px; height:18px; opacity:.7; background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" stroke="%2364748b" fill="none" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" ry="2" stroke-width="2"/><line x1="16" y1="3" x2="16" y2="7" stroke-width="2"/><line x1="8" y1="3" x2="8" y2="7" stroke-width="2"/><line x1="3" y1="11" x2="21" y2="11" stroke-width="2"/></svg>') no-repeat center / contain; pointer-events:none; }
  input[type="date"]{ padding-right:34px; }

  /* ===== Responsive ===== */
  @media (max-width:740px){
    .add-grid, .details-grid-form{ grid-template-columns:1fr; }
    .photo-card{ justify-self:stretch; width:100%; height:180px; }
  }
  @media (max-width:640px){
    .employees-grid{ grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
  }
</style>

<!-- ======================= -->
<!-- 9) TOP BAR + GRID       -->
<!-- ======================= -->
<div class="main">
  <div class="employees-grid">
    {#each filteredEmployees as emp (emp.id)}
      <div class="emp-box">
        <div class="emp-top" aria-label="Employee summary">
          <div class="avatar-wrap">
            <div class="avatar-fallback">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="4" fill="#9ca3af"/>
                <path d="M4 20c0-4.2 4.2-6.5 8-6.5s8 2.3 8 6.5" fill="#9ca3af"/>
              </svg>
            </div>
            {#if (detailsById[emp.id]?.photoUrl)}
              <img src={detailsById[emp.id]?.photoUrl || ""} alt="profile" on:error={(e)=> (e.currentTarget.style.display='none')} />
            {/if}
          </div>
          <h3>{emp.name}</h3>
          <p>{emp.position}</p>
          <p>Staff ID: {emp.id}</p>
          <p>Department: {emp.department}</p>
        </div>
        <div class="emp-spacer"></div>
        <div class="emp-actions">
          <button class="btn details" on:click={() => openDetails(emp.id)}>Details</button>
        </div>
      </div>
    {/each}
  </div>
</div>

<div class:show={sidebarOpen} class="overlay" on:click={toggleSidebar}></div>

<div class:open={sidebarOpen} class="sidebar" aria-hidden={!sidebarOpen}>
  <div class="sidebar-header">
    <div class="sidebar-title">
      Pending Approval{pendingCount > 0 ? ` (${pendingCount})` : ''}
    </div>
    <button class="close-btn" on:click={toggleSidebar}>✕</button>
  </div>

  <div class="sidebar-body">

    {#if pending.length === 0}
      <p style="color:#64748b; text-align:center;">No pending requests.</p>
    {:else}

      <!-- ================================================= -->
      <!--                 PENDING LEAVE APPROVAL           -->
      <!-- ================================================= -->
      {#if pendingLeave.length > 0}
        <h3 class="sub-ttl">Pending Leave Approval ({pendingLeave.length})</h3>

        {#each pendingLeave as item (item.leave_id)}
          <div class="pending-card">

            <!-- Header -->
            <div class="row1">
              <div class="who">
                <div class="name">{item.profile_name || item.staff_name}</div>
                <div class="sub">
                  {item.requester_position} • {item.staff_id} •
                  {item.profile_department || item.department}
                </div>
              </div>
              <span class="pill type">{item.leave_type}</span>
            </div>

            <!-- Dates -->
            <div class="kv">
              <div><span class="k">From:</span> <span class="v">{fmt(item.date_from)}</span></div>
              <div><span class="k">To:</span> <span class="v">{fmt(item.date_until)}</span></div>
              <div><span class="k">Requested:</span> <span class="v">{fmt(item.created_at)}</span></div>
            </div>

            <!-- Actions + Toggle -->
            <div class="actions">
              <div class="left">
                <button class="btn-approve" on:click={() => approveRequest(item)}>Approve</button>
                <button class="btn-reject" on:click={() => rejectRequest(item)}>Reject</button>
              </div>

              <div style="display:flex; align-items:center; gap:10px;">
                <span
                  style="text-decoration: underline; cursor:pointer; color:#0c4a6e; font-size:12px;"
                  on:click={() => leaveDetailsOpen[item.leave_id] = !leaveDetailsOpen[item.leave_id]}
                >
                  {leaveDetailsOpen[item.leave_id] ? "Hide Details" : "Leave Details"}
                </span>

                <button class="btn-details" on:click={() => openDetails(item)}>Details</button>
              </div>
            </div>

            <!-- Expanded Box -->
            {#if leaveDetailsOpen[item.leave_id]}
              <div
                style="
                  background:#f8fafc;
                  border:1px solid #e2e8f0;
                  padding:10px;
                  border-radius:8px;
                  margin-top:10px;
                "
              >
                <div>
                  <strong style="color:#0c4a6e; font-size:13px;">Reason:</strong>
                  <div style="margin-top:4px; color:#334155; font-size:12px;">{item.reason}</div>
                </div>

                <div style="margin-top:8px;">
                  <strong style="color:#0c4a6e; font-size:13px;">Attachment:</strong>

                  {#if item.attachment_path}
                    <div style="margin-top:4px;">
                      <a
                        href={"http://localhost:5000/" + item.attachment_path}
                        target="_blank"
                        style="color:#2563eb; text-decoration: underline; font-size:12px;"
                      >
                        View Attachment
                      </a>
                    </div>
                  {:else}
                    <div style="margin-top:4px; color:#64748b; font-size:12px;">No attachment</div>
                  {/if}
                </div>
              </div>
            {/if}

          </div>
        {/each}
      {/if}

      <!-- ================================================= -->
      <!--             PENDING CANCELLATION APPROVAL        -->
      <!-- ================================================= -->
      {#if pendingCancel.length > 0}
        <h3 class="sub-ttl" style="margin-top:20px;">
          Pending Cancellation Approval ({pendingCancel.length})
        </h3>

        {#each pendingCancel as item (item.leave_id)}
          <div class="pending-card">

            <!-- Header -->
            <div class="row1">
              <div class="who">
                <div class="name">{item.profile_name || item.staff_name}</div>
                <div class="sub">
                  {item.requester_position} • {item.staff_id} •
                  {item.profile_department || item.department}
                </div>
              </div>
              <span class="pill type" style="background:#fee2e2; color:#b91c1c;">
                Cancellation: {item.leave_type}
              </span>
            </div>

            <!-- Dates -->
            <div class="kv">
              <div><span class="k">Leave From:</span> <span class="v">{fmt(item.date_from)}</span></div>
              <div><span class="k">Leave To:</span> <span class="v">{fmt(item.date_until)}</span></div>
              <div><span class="k">Requested:</span> <span class="v">{fmt(item.created_at)}</span></div>
            </div>

            <!-- Actions + Toggle -->
            <div class="actions">
              <div class="left">
                <button class="btn-approve" on:click={() => approveCancellation(item)}>Approve</button>
                <button class="btn-reject" on:click={() => rejectCancellation(item)}>Reject</button>
              </div>

              <div style="display:flex; align-items:center; gap:10px;">
                <span
                  style="text-decoration: underline; cursor:pointer; color:#0c4a6e; font-size:12px;"
                  on:click={() => leaveDetailsOpen[item.leave_id] = !leaveDetailsOpen[item.leave_id]}
                >
                  {leaveDetailsOpen[item.leave_id] ? "Hide Details" : "Leave Details"}
                </span>

                <button class="btn-details" on:click={() => openDetails(item)}>Details</button>
              </div>
            </div>

            <!-- Expanded -->
            {#if leaveDetailsOpen[item.leave_id]}
              <div
                style="
                  background:#f8fafc;
                  border:1px solid #e2e8f0;
                  padding:10px;
                  border-radius:8px;
                  margin-top:10px;
                "
              >
                <div>
                  <strong style="color:#0c4a6e; font-size:13px;">Reason:</strong>
                  <div style="margin-top:4px; color:#334155; font-size:12px;">{item.reason}</div>
                </div>

                <div style="margin-top:8px;">
                  <strong style="color:#0c4a6e; font-size:13px;">Attachment:</strong>

                  {#if item.attachment_path}
                    <div style="margin-top:4px;">
                      <a
                        href={"http://localhost:5000/" + item.attachment_path}
                        target="_blank"
                        style="color:#2563eb; text-decoration: underline; font-size:12px;"
                      >
                        View Attachment
                      </a>
                    </div>
                  {:else}
                    <div style="margin-top:4px; color:#64748b; font-size:12px;">No attachment</div>
                  {/if}
                </div>
              </div>
            {/if}

          </div>
        {/each}
      {/if}
    {/if}

  </div>

  <div class="sidebar-footer">
    <button class="cancel-btn" on:click={() => (sidebarOpen = false)}>Cancel</button>
  </div>
</div>
<div class="sidebar-tab" on:click={toggleSidebar}>
  <span class="label">Pending Approval</span>
  {#if pendingCount > 0}
    <span class="badge">{pendingCount}</span>
  {/if}
</div> 

<!-- ======================= -->
<!-- 12) DETAILS MODAL (VIEW-ONLY) -->
<!-- ======================= -->
{#if detailsOpen && selectedEmp}
  <div class="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="emp-details-title">
    <div class="modal">
      <div class="modal-hd">
        <div id="emp-details-title" class="modal-ttl">Employee Details</div>
        <button class="modal-x" on:click={() => { detailsOpen = false; }}>✕</button>
      </div>
      <div class="modal-bd">
        <div class="details-layout">
          <div class="details-grid-form">
            <!-- Left form -->
            <div class="form">
              <div class="row">
                <div><label>Full Name</label><div class="ctl pill disabled"><input value={selectedEmp.name} disabled /></div></div>
                <div><label>Staff ID</label><div class="ctl pill disabled"><input value={selectedEmp.empId} disabled /></div></div>
              </div>
              <div class="row">
                <div><label>Position</label><div class="ctl pill disabled"><input value={selectedEmp.position} disabled /></div></div>
                <div><label>Department</label><div class="ctl pill disabled"><input value={selectedEmp.department} disabled /></div></div>
              </div>
              <div class="row">
                <div><label>Email</label><div class="ctl pill disabled"><input type="email" value={selectedEmp.email} disabled /></div></div>
                <div><label>Gender</label><div class="ctl pill disabled"><select value={selectedEmp.gender} disabled><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></div></div>
              </div>
              <div class="row">
                <div><label>Employment Date</label><div class="ctl pill date disabled"><input type="date" value={selectedEmp.employmentDate} disabled /></div></div>
                <div><label>Confirmation Date</label><div class="ctl pill date disabled"><input type="date" value={selectedEmp.confirmationDate} disabled /></div></div>
              </div>
              <div class="row">
                <div><label>Termination Date</label><div class="ctl pill date disabled"><input type="date" value={selectedEmp.terminationDate} disabled /></div></div>
                <div>
                  <label class="muted">Leave Entitlements (per year)</label>
                  <div class="row" style="gap:10px; margin:0;">
                    <div class="ctl pill disabled"><input type="number" value={selectedEmp.annualLeave} disabled /></div>
                    <div class="ctl pill disabled"><input type="number" value={selectedEmp.medicalLeave} disabled /></div>
                  </div>
                </div>
              </div>
              <div class="row">
                  <div><label>Role</label><div class="ctl pill disabled"><input value={selectedEmp.role} disabled /></div></div>
                </div>
              <div class="row single">
                <div><label>Notes</label><div class="ctl disabled"><textarea value={selectedEmp.notes} disabled /></div></div>
              </div>
            </div>
            <!-- Right: Photo (preview only) -->
            <div class="photo-card" title="Profile Photo">
              {#if selectedEmp.photoUrl}
                <div class="photo-preview"><img src={selectedEmp.photoUrl} alt="Profile" /></div>
              {:else}
                <div class="cam" aria-label="Profile photo">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>
                </div>
                <div class="muted" style="position:absolute; bottom:10px;">No Photo</div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

