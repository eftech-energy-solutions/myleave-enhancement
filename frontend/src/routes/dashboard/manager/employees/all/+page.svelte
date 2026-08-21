<script>
  import { onMount } from "svelte";
  import { PUBLIC_VITE_API_BASE } from '$env/static/public';

  let manager = null;
  let managerDept = null;

  let employees = [];
  let detailsById = {};
  let pendingRequests = [];

  let detailsOpen = false;
  let selectedEmp = null;

  const DEPTS = [
    "Director",
    "Operations Support",
    "Technical Data",
    "Operations",
    "Sales & Technical Excellence",
    "Business Development",
    "Technical Data - Consultant"
  ];

  let deptFilter = "All";
  const deptOptions = ["All", ...Array.from(new Set(DEPTS)).sort()];

  const formatDate = (dbDate) => {
    if (!dbDate) return "";
    const d = new Date(dbDate);
    d.setHours(d.getHours() + 8); // Malaysia timezone fix
    return d.toISOString().split("T")[0];
  };

  onMount(async () => {
    try {
      // 🔒 BOUNCER GATE: Double check it's Luqman
      const userRes = await fetch(`${PUBLIC_VITE_API_BASE}/api/me/photo`, { credentials: "include" });
      const userData = await userRes.json();
      manager = userData;
      managerDept = userData?.department;

      if (!(manager?.role === "Manager" && managerDept === "Director")) {
        alert("Access Denied: This tab is exclusively reserved for the Director Manager.");
        window.location.href = "/dashboard/manager/employees"; 
        return;
      }

      // Fetch all employees in the company (Admin Power)
        const empRes = await fetch(`${PUBLIC_VITE_API_BASE}/api/employee?viewMode=all`, { 
        credentials: "include" 
      });
      const data = await empRes.json();

if (empRes.ok) {
        detailsById = {};
        employees = data.map((emp) => {
          const url = emp.photourl
            ? emp.photourl.startsWith("http")
              ? emp.photourl
              : `${PUBLIC_VITE_API_BASE}${emp.photourl}`
            : "";

          const profile = {
            id: emp.staff_id,
            empId: emp.staff_id,
            name: emp.full_name,
            position: emp.position,
            role: emp.role,
            department: emp.department || "",
            email: emp.email,
            photoUrl: url,
            employmentDate: formatDate(emp.employment_date),
            confirmationDate: formatDate(emp.confirmation_date),
            terminationDate: formatDate(emp.termination_date),
            gender: emp.gender,
            annualLeave: emp.leave_entitlement_annual_original,
            medicalLeave: emp.leave_entitlement_medical_original,
            notes: emp.notes
          };

          detailsById[emp.staff_id] = profile;
          return profile;
        });
      }
    } catch (err) {
      console.error("❌ Error loading company registry:", err);
    }
  });

  $: filteredEmployees = (
    deptFilter === "All"
      ? employees
      : employees.filter((e) => e.department?.split(",").includes(deptFilter))
  )
  .slice()
  .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

  function openDetails(id) {
    if (detailsById[id]) {
      selectedEmp = structuredClone(detailsById[id]);
      detailsOpen = true;
    }
  }

  function handleKey(e) {
    if (e.key === "Escape") detailsOpen = false;
  }
</script>

<svelte:window on:keydown={handleKey} />

<div class="main">
  <div class="toprow">
    <div class="title-label" style="color: var(--ink, #1F2937); font-size: 16px; font-weight: 600; margin-top: 10px;">All Employee Details</div>

    <div class="rightcol filter-wrap">
      <svg class="filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px; color: var(--muted, #6B7280);">
        <path d="M3 4h18l-7 8v6l-4 2v-8l-7-8z"/>
      </svg>
      <label class="filter-label" for="dept-filter" style="margin: 0 6px; font-weight: 600; font-size: 14px; color: var(--ink, #1F2937);">Department</label>
      <div class="filter-select">
        <select id="dept-filter" bind:value={deptFilter}>
          {#each deptOptions as d}<option value={d}>{d}</option>{/each}
        </select>
      </div>
    </div>
  </div>

  <div class="employees-grid">
    {#each filteredEmployees as emp (emp.id)}
      <div class="emp-box">
        <div class="emp-top">
          <div class="avatar-wrap">
            <div class="avatar-fallback">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="4" fill="#9ca3af"/>
                <path d="M4 20c0-4.2 4.2-6.5 8-6.5s8 2.3 8 6.5" fill="#9ca3af"/>
              </svg>
            </div>
            {#if emp.photoUrl}
              <img src={emp.photoUrl} alt="profile" on:error={(e) => (e.currentTarget.style.display = 'none')} />
            {/if}
          </div>
          <h3>{emp.name}</h3>
          <p>{emp.position}</p>
          <p>Staff ID: {emp.id}</p>
          <p>Department: {emp.department?.split(',').join(', ')}</p>
        </div>
        <div class="emp-spacer"></div>
        <div class="emp-actions">
          <button class="btn details" on:click={() => openDetails(emp.id)}>Details</button>
        </div>
      </div>
    {/each}
    {#if filteredEmployees.length === 0}
      <div class="empty-state">
        <strong>No employees for {deptFilter}</strong>
        Try selecting a different department.
      </div>
    {/if}
  </div>
</div>

{#if detailsOpen && selectedEmp}
  <div class="modal-wrap" role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-hd">
        <div class="modal-ttl">Employee Details (View Only)</div>
        <button class="modal-x" on:click={() => { detailsOpen = false; }}>✕</button>
      </div>
      <div class="modal-bd">
        <div class="details-layout">
          <div class="details-grid-form">
            <div class="form">
              <div class="row">
                <div>
                  <label>Full Name</label>
                  <div class="ctl pill disabled"><input value={selectedEmp.name} disabled /></div>
                </div>
                <div>
                  <label>Staff ID</label>
                  <div class="ctl pill disabled"><input value={selectedEmp.empId} disabled /></div>
                </div>
              </div>
              <div class="row">
                <div>
                  <label>Position</label>
                  <div class="ctl pill disabled"><input value={selectedEmp.position} disabled /></div>
                </div>
                <div>
                  <label>Department</label>
                  <div class="ctl pill disabled"><input value={selectedEmp.department} disabled /></div>
                </div>
              </div>
              <div class="row">
                <div>
                  <label>Email</label>
                  <div class="ctl pill disabled"><input value={selectedEmp.email} disabled /></div>
                </div>
                <div>
                  <label>Gender</label>
                  <div class="ctl pill disabled"><input value={selectedEmp.gender} disabled /></div>
                </div>
              </div>
              <div class="row">
                <div>
                  <label>Employment Date</label>
                  <div class="ctl pill disabled"><input value={selectedEmp.employmentDate} disabled /></div>
                </div>
                <div>
                  <label>Confirmation Date</label>
                  <div class="ctl pill disabled"><input value={selectedEmp.confirmationDate} disabled /></div>
                </div>
              </div>
              <div class="row three">
                <div>
                  <label>Role</label>
                  <div class="ctl pill disabled"><input value={selectedEmp.role} disabled /></div>
                </div>
                <div>
                  <label>Annual Leave</label>
                  <div class="ctl pill disabled"><input value={selectedEmp.annualLeave} disabled /></div>
                </div>
                <div>
                  <label>Medical Leave</label>
                  <div class="ctl pill disabled"><input value={selectedEmp.medicalLeave} disabled /></div>
                </div>
              </div>
              <div class="row single">
                <div>
                  <label>Notes</label>
                  <div class="ctl disabled"><textarea value={selectedEmp.notes} disabled></textarea></div>
                </div>
              </div>
              <div class="form-ft">
                <button class="btn-ghost" on:click={() => { detailsOpen = false; }}>Close</button>
              </div>
            </div>
            <div class="photo-card">
              {#if selectedEmp.photoUrl}
                <div class="photo-preview"><img src={selectedEmp.photoUrl} alt="Profile" /></div>
              {:else}
                <div class="muted">No Photo</div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .main{ padding:1.5rem; }
  .toprow{ display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
  .rightcol{ display:flex; align-items:center; gap:6px; }

  .employees-grid{ display:grid; gap:1rem; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));}
  .emp-box{ background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:1rem; color:#111827; box-shadow:0 2px 10px rgba(15,23,42,.06); display:flex; flex-direction:column; min-height:240px; }
  .emp-top{ text-align:center; }
  .emp-box h3{ margin:0; font-size:15px; color:#217859; }
  .emp-box p{ margin:2px 0; font-size:12px; color:#334155; }
  .emp-spacer{ flex:1 1 auto; }
  .emp-actions{ margin-top:auto; display:flex; justify-content:center; }
  .btn{ border:none; border-radius:8px; padding:.42rem .75rem; font-size:12px; cursor:pointer; font-weight:700; }
  .btn.details{ background:#e0f2fe; color:#000; }

  .avatar-wrap{ position:relative; width:64px; height:64px; margin:0 auto .5rem; border-radius:9999px; overflow:hidden; background:#e5e7eb; border:1px solid #e5e7eb; }
  .avatar-wrap img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block; }
  .avatar-fallback{ position:absolute; inset:0; display:grid; place-items:center; }
  .avatar-fallback svg{ width:60%; height:60%; }

  .modal-wrap{ position:fixed; inset:0; display:grid; place-items:center; background:rgba(0,0,0,.35); z-index:80; }
  .modal{ width:min(900px, 96vw); background:#fff; border-radius:18px; box-shadow:0 14px 40px rgba(0,0,0,.25); overflow:hidden; }
  .modal-hd{ padding:14px 18px; border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:space-between; }
  .modal-ttl{ font-weight:700; font-size:22px; color:#0F9B8E; }
  .modal-x{ border:none; background:transparent; font-size:22px; cursor:pointer; color:#475569; }
  .modal-bd{ padding:0; max-height:72vh; overflow:auto; }

  .details-layout{ padding:22px; }
  .details-grid-form{ display:grid; grid-template-columns: 1fr 220px; gap:20px; }
  .photo-card{ align-self:flex-start; justify-self:end; width:180px; height:180px; border-radius:20px; background:linear-gradient(180deg,#fff,#f3f4f6); border:1px dashed #d1d5db; display:grid; place-items:center; position:relative; }
  .photo-preview{ position:absolute; inset:0; overflow:hidden; border-radius:20px; }
  .photo-preview img{ width:100%; height:100%; object-fit:cover; display:block; }

  .form{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:18px; }
  .row{ display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:12px; }
  .row.three{ grid-template-columns:2.1fr 1fr 1fr; }
  .row.single{ grid-template-columns:1fr; }
  label{ font-size:12px; color:#374151; font-weight:700; margin:0 0 6px; display:block; }
  .ctl{ display:flex; align-items:center; background:#fff; border:1px solid var(--line); border-radius:12px; padding:10px 12px; }
  .ctl input, .ctl select, .ctl textarea{ border:none; outline:none; width:100%; font-size:14px; color:#111827; background:transparent; }
  .ctl textarea{ min-height:90px; resize:vertical; }
  .ctl.disabled{ background:#f8fafc; }
  .ctl :disabled{ color:#6b7280; }
  .form-ft{ display:flex; justify-content:flex-end; gap:10px; padding-top:10px; margin-top:8px; }
  .btn-ghost{ background:#fff; color:var(--ink,#1F2937); border:1px solid var(--line,#e5e7eb); border-radius:10px; padding:.7rem 1rem; font-weight:600; cursor:pointer; }
  .filter-wrap { display:flex; align-items:center; gap:6px; }
  .filter-label { margin: 0 6px; font-weight: 600; font-size: 14px; color: var(--ink, #1F2937); }
  .filter-icon { width: 16px; height: 16px; color: var(--muted, #6B7280); }
  .filter-select { min-width:210px; }
  .filter-select select {
    appearance:none; -webkit-appearance:none;
    background:#fff url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b7280' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 10px center;
    border:1px solid var(--line,#e5e7eb); border-radius:10px; padding:.5rem 2rem .5rem .8rem;
    font-size:14px; font-weight:600; color:var(--ink,#1F2937); cursor:pointer;
    width:100%;
  }
  .filter-select select:focus{ outline:none; border-color:#0F9B8E; box-shadow:0 0 0 3px rgba(15,155,142,.15); }
  .empty-state{ background:#fff; border:1px dashed #cbd5e1; border-radius:12px; padding:36px 20px; text-align:center; color:#64748b; grid-column:1/-1; }
  .empty-state strong{ display:block; font-size:16px; color:var(--ink,#1F2937); margin-bottom:4px; }
</style>