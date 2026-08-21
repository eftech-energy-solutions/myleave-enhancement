<script>
  import { onMount } from "svelte";
  import { PUBLIC_VITE_API_BASE } from '$env/static/public';

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
          const userRes = await fetch(
            `${PUBLIC_VITE_API_BASE}/api/me/photo`,
            {
              credentials: "include",
            }
          );
          const userData = await userRes.json();
          manager = userData;
          managerDept = userData?.department;

          // 🌟 ONLY run these two back-to-back cleanly
          await loadEmployees();

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
        `${PUBLIC_VITE_API_BASE}/api/employee`,  // ✅ Correct - matching backticks
        {
          credentials: "include",
        }
      );
      const data = await res.json();

      console.log("========== API RESPONSE ==========");
      console.log(data);

      data.forEach((e) => {
        console.log(
          e.full_name,
          "|",
          e.department,
          "|",
          e.role
        );
      });

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
      : `${PUBLIC_VITE_API_BASE}${e.photourl}`
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
          annualLeave: e.leave_entitlement_annual_original,
          medicalLeave: e.leave_entitlement_medical_original,
          notes: e.notes,
        };
      });


  // Build detailsById for ALL staff, muncul di employee grid
detailsById = {};
fullProfileList.forEach((emp) => {
  detailsById[emp.id] = structuredClone(emp);
});

// 1) Filter ONLY employees in manager's department (kalau manager)
// let deptFiltered;

// if (manager?.role === "Manager" && managerDept === "Director") {
//   // 🔥 Manager Director:
//   // - Staff Director
//   // - Semua Manager
//   deptFiltered = fullProfileList.filter(
//     (e) => e.department === "Director" || e.role === "Manager"
//   );
// } else if (manager?.role === "Manager") {
//   // Manager biasa → dept sendiri
//   deptFiltered = fullProfileList.filter(
//     (e) => e.department === managerDept
//   );
// } else {
//   // Admin
//   deptFiltered = fullProfileList;
// }

// // 2) Buang semua staff yang ada dalam pendingIds
// employees = deptFiltered.filter(
//   (emp) => !pendingIds.has(emp.empId)
// );

// 1) Filter ONLY employees in manager's department (kalau manager)
let deptFiltered;

if (manager?.role === "Manager" && managerDept === "Director") {
  // 🔥 Manager Director:
  // - Staff Director
  // - Semua Manager
  deptFiltered = fullProfileList.filter(
    (e) => e.department === "Director" || e.role === "Manager"
  );

// } else if (manager?.role === "Manager") {

//   // Convert manager departments into array
//   const managerDepartments = (managerDept || "")
//     .split(",")
//     .map(d => d.trim());

//   deptFiltered = fullProfileList.filter((e) => {

//     // Convert employee departments into array
//     const employeeDepartments = (e.department || "")
//       .split(",")
//       .map(d => d.trim());

//     // Return true if at least one department matches
//     return employeeDepartments.some(dep =>
//       managerDepartments.includes(dep)
//     );
//   });

// } else {
//   // Admin
//   deptFiltered = fullProfileList;
// }

} else if (manager?.role === "Manager") {

  // Convert manager departments into array
  const managerDepartments = (managerDept || "")
    .split(",")
    .map(d => d.trim());

  console.log("========== DEBUG ==========");
  console.log("Manager Dept:", managerDept);
  console.log("Manager Departments:", managerDepartments);

  fullProfileList.forEach((e) => {
    console.log(
      "Employee:",
      e.name,
      "| Department:",
      e.department
    );
  });

  deptFiltered = fullProfileList.filter((e) => {

    // Convert employee departments into array
    const employeeDepartments = (e.department || "")
      .split(",")
      .map(d => d.trim());

    const matched = employeeDepartments.some(dep =>
      managerDepartments.includes(dep)
    );

    console.log(
      e.name,
      "=>",
      employeeDepartments,
      "Matched:",
      matched
    );

    return matched;
  });

} else {
  // Admin
  deptFiltered = fullProfileList;
}

employees = deptFiltered;

console.log("========== FINAL EMPLOYEES ==========");

console.log(
  employees.map(e => ({
    name: e.name,
    id: e.empId,
    dept: e.department
  }))
);

    } catch (err) {
      console.error("⚠️ Error in loadEmployees():", err);
    }
  }

  /* ================================
      3) FILTER BY DEPT
     ================================ */

  $: filteredEmployees = employees;

  /* ================================
       4) openDetails (STRUCTURE FIXED)
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
</script>



<style>
  :global(html, body){ height:100%; margin:0; }
  :root { --primary:#0F9B8E; --ink:#0c4a6e ; --muted:#64748b; --line:#e5e7eb; --soft:#f8fafc; }
  :global(body){ font-family: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans"; background: var(--canvas, #F5F7FA); overflow-y:auto; }

  /* ===== Layout ===== */
  .main{ padding:1.5rem; }

  /* ===== Employees grid & card ===== */
  .employees-grid{ display:grid; gap:1rem; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
  .emp-box{ background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:1rem; color:#111827; box-shadow:0 2px 10px rgba(15,23,42,.06); display:flex; flex-direction:column; min-height:240px; }
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

  /* ===== Modals (Add / Details) ===== */
  .modal-wrap{ position:fixed; inset:0; display:grid; place-items:center; background:rgba(0,0,0,.35); z-index:80; animation:fadeIn .15s ease; }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  .modal{ width:min(900px, 96vw); background:#fff; border-radius:18px; box-shadow:0 14px 40px rgba(0,0,0,.25); overflow:hidden; }
  .modal-hd{ padding:14px 18px; border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:space-between; }
  .modal-ttl{ font-weight:700; font-size:22px; color:#0F9B8E; }
  .modal-x{ border:none; background:transparent; font-size:22px; cursor:pointer; color:#475569; }
  .modal-bd{ padding:0; max-height:72vh; overflow:auto; }

  .details-layout{ padding:22px; }
  .details-grid-form{ display:grid; grid-template-columns: 1fr 220px; gap:20px; }
  .photo-card{ align-self:flex-start; justify-self:end; width:180px; height:180px; border-radius:20px; background:linear-gradient(180deg,#fff,#f3f4f6); border:1px dashed #d1d5db; display:grid; place-items:center; position:relative; box-shadow:0 8px 20px rgba(0,0,0,.06); }
  .photo-card .cam{ width:48px; height:48px; border-radius:9999px; background:#0F9B8E; display:grid; place-items:center; color:#fff; font-size:20px; box-shadow:0 6px 14px rgba(15,155,142,.35); }
  .photo-card .cam svg { width: 24px; height: 24px; }
  .photo-preview{ position:absolute; inset:0; overflow:hidden; border-radius:20px; }
  .photo-preview img{ width:100%; height:100%; object-fit:cover; display:block; }

  .form{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:18px; box-shadow:0 6px 18px rgba(0,0,0,.05); }
  .row{ display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:12px; }
  .row.three{ grid-template-columns:2.1fr 1fr 1fr; }
  .row.single{ grid-template-columns:1fr; }
  label{ font-size:12px; color:#374151; font-weight:700; margin:0 0 6px; display:block; }
  .ctl{ display:flex; align-items:center; background:#fff; border:1px solid var(--line); border-radius:12px; padding:10px 12px; box-shadow: inset 0 1px 0 rgba(0,0,0,.02); }
  .ctl:focus-within{ border-color:#0F9B8E; box-shadow:0 0 0 3px rgba(15,155,142,.15); }
  .ctl input, .ctl select, .ctl textarea{ border:none; outline:none; width:100%; font-size:14px; color:#111827; background:transparent; }
  .ctl textarea{ min-height:90px; resize:vertical; }
  .ctl.disabled{ background:#f8fafc; }
  .ctl :disabled{ color:#6b7280; }

  .ctl.date { position:relative; }
  .ctl.date::after{ content:""; position:absolute; right:12px; top:50%; transform:translateY(-50%); width:18px; height:18px; opacity:.7; background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" stroke="%2364748b" fill="none" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" ry="2" stroke-width="2"/><line x1="16" y1="3" x2="16" y2="7" stroke-width="2"/><line x1="8" y1="3" x2="8" y2="7" stroke-width="2"/><line x1="3" y1="11" x2="21" y2="11" stroke-width="2"/></svg>') no-repeat center / contain; pointer-events:none; }
  input[type="date"]{ padding-right:34px; }

/* =========================
   TOAST NOTIFICATION
========================= */
/* ===== TOAST STACK ===== */
.toast-stack {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
}

/* ===== TOAST ITEM ===== */
.toast-item {
  display: flex;
  align-items: flex-start; 
  background: #fff;
  border-radius: 8px;
  min-width: 340px;
  max-width: 400px;
  padding: 12px 14px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.15);
  animation: slideIn 0.25s ease;
  border-left: 5px solid;
}

/* ICON */
.toast-icon {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  margin-top: 2px;
}

.toast-svg {
  width: 20px;
  height: 20px;
  fill: #fff;
}

/* BODY */
.toast-body {
  flex: 1;
}

.toast-body strong {
  display: block;
  font-size: 14px;
  color: #111827;
  margin-bottom: 2px;
}

.toast-body p {
  margin: 0;
  font-size: 13px;
  color: #4b5563;
}

/* CLOSE */
.toast-close {
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #9ca3af;
  margin-left: 10px;
}
.toast-close:hover {
  color: #111827;
}

/* ===== TYPES ===== */
.toast-item.success {
  border-color: #22c55e;
}
.toast-item.success .toast-icon {
  background: #22c55e;
}

.toast-item.error {
  border-color: #DC2626;
}
.toast-item.error .toast-icon {
  background: #DC2626;
}

.toast-item.info {
  border-color: #0F9B8E;
}
.toast-item.info .toast-icon {
  background: #3b82f6;
}

.toast-item.warning {
  border-color: #f59e0b;
}
.toast-item.warning .toast-icon {
  background: #f59e0b;
}

/* ===== ANIMATION ===== */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(24px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
@keyframes fadeOut {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(24px);
  }
}

.toast-item.closing {
  animation: fadeOut 0.25s ease forwards;
}
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
              <!-- FULL NAME + STAFF ID -->
              <div class="row">
                <div>
                  <label>Full Name</label>
                  <div class="ctl pill disabled">
                    <input value={selectedEmp.name} disabled />
                  </div>
                </div>
                <div>
                  <label>Staff ID</label>
                  <div class="ctl pill disabled">
                    <input value={selectedEmp.empId} disabled />
                  </div>
                </div>
              </div>

              <!-- POSITION + DEPARTMENT -->
              <div class="row">
                <div>
                  <label>Position</label>
                  <div class="ctl pill disabled">
                    <input value={selectedEmp.position} disabled />
                  </div>
                </div>
                <div>
                  <label>Department</label>
                  <div class="ctl pill disabled">
                    <input value={selectedEmp.department} disabled />
                  </div>
                </div>
              </div>

              <!-- EMAIL + GENDER -->
              <div class="row">
                <div>
                  <label>Email</label>
                  <div class="ctl pill disabled">
                    <input type="email" value={selectedEmp.email} disabled />
                  </div>
                </div>
                <div>
                  <label>Gender</label>
                  <div class="ctl pill disabled">
                    <select value={selectedEmp.gender} disabled>
                      <option value="">Select</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- EMPLOYMENT DATE + CONFIRMATION DATE -->
              <div class="row">
                <div>
                  <label>Employment Date</label>
                  <div class="ctl pill date disabled">
                    <input type="date" value={selectedEmp.employmentDate} disabled />
                  </div>
                </div>
                <div>
                  <label>Confirmation Date</label>
                  <div class="ctl pill date disabled">
                    <input type="date" value={selectedEmp.confirmationDate} disabled />
                  </div>
                </div>
              </div>

              <!-- TERMINATION DATE + ROLE -->
              <div class="row">
                <div>
                  <label>Termination Date</label>
                  <div class="ctl pill date disabled">
                    <input type="date" value={selectedEmp.terminationDate} disabled />
                  </div>
                </div>
                <div>
                  <label>Role</label>
                  <div class="ctl pill disabled">
                    <input value={selectedEmp.role} disabled />
                  </div>
                </div>
              </div>

              <!-- GENDER + ANNUAL LEAVE + MEDICAL LEAVE -->
              <div class="row three">
                <div>
                  <label>Gender</label>
                  <div class="ctl pill disabled">
                    <select value={selectedEmp.gender} disabled>
                      <option value="">Select</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label>Annual Leave</label>
                  <div class="ctl pill disabled">
                    <input type="number" value={selectedEmp.annualLeave} disabled />
                  </div>
                </div>
                <div>
                  <label>Medical Leave</label>
                  <div class="ctl pill disabled">
                    <input type="number" value={selectedEmp.medicalLeave} disabled />
                  </div>
                </div>
              </div>

              <!-- NOTES -->
              <div class="row single">
                <div>
                  <label>Notes</label>
                  <div class="ctl disabled">
                    <textarea value={selectedEmp.notes} disabled />
                  </div>
                </div>
              </div>
            </div>

            <!-- Right: Photo (preview only) -->
            <div class="photo-card" title="Profile Photo">
              {#if selectedEmp.photoUrl}
                <div class="photo-preview">
                  <img src={selectedEmp.photoUrl} alt="Profile" />
                </div>
              {:else}
                <div class="cam" aria-label="Profile photo">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/>
                  </svg>
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

{#if toast.show}
  <div class="toast-stack">
    <div
      class="toast-item"
      class:success={toast.type === 'success'}
      class:error={toast.type === 'error'}
      class:info={toast.type === 'info'}
      class:warning={toast.type === 'warning'}
      class:closing={toast.closing}
    >
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

      <button
        class="toast-close"
        on:click={() => (toast.show = false)}
      >
        ×
      </button>
    </div>
  </div>
{/if}

