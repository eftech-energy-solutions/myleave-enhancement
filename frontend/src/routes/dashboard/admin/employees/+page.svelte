<script>
  // Profile
  let profileMenuOpen = false;
  const user = { name: "Afiq Mikail", role: "Human Resources", staffId: "E8505" };

  function clickOutside(node) {
    const onClick = (e) => { if (!node.contains(e.target)) profileMenuOpen = false; };
    document.addEventListener('click', onClick);
    return { destroy: () => document.removeEventListener('click', onClick) };
  }

  // Keyboard ESC closes things
  function handleKey(e) {
    if (e.key === 'Escape') {
      if (sidebarOpen) sidebarOpen = false;
      if (profileMenuOpen) profileMenuOpen = false;
      if (addModalOpen) addModalOpen = false;
    }
  }

  // Dummy employees
  const NAMES = [
    "Afiq Mikail","Nur Aisyah","Daniel Tan","Sophia Lim","Muhammad Shamsul","Ariana Wong","John Lee","Farah Zahra",
    "Hafiz Rahman","Amirul Hakim","Nabila Rahman","Jason Ong","Puteri Balqis","Christopher Yap","Mira Izzati","Iqbal Zain",
    "Syafiqah Noor","Faizal Aziz","Hannah Cho","Kelvin Teo","Rina Hashim","Zara Kamal","Ridzuan Salleh","Mei Yee",
    "Irfan Danial","Aisyah Humaira","Adam Firdaus","Noraishah Ismail","Kevin Chan","Lydia Goh","Wan Aiman","Diyana Ahmad",
    "Hakim Roslan","Zul Hilmi","Nurul Auni","Faris Zulkifli","Melissa Chong","Zaid Hakimi"
  ];
  const ROLES = ["Human Resources","Manager","Engineer","Executive","Analyst","Technician","Team Lead","Coordinator"];
  const DEPTS = ["Administrator","Operations Support","Technical Data","Opeerations - RTOC","Sales & Technical Excellence","Director"];
  const IDS   = ["HR","MN","EN","EX","AN","TC","TL","CO"];
  const makeId = (prefix, i) => `${prefix}${String(i+1).padStart(3,"0")}`;

  let employees = NAMES.map((name, i) => ({
    id: makeId(IDS[i % IDS.length], i),
    name,
    role: ROLES[i % ROLES.length],
    department: DEPTS[i % DEPTS.length]
  }));

  // Pending example
  let pending = [{ id:"MN002", name:"Nur Aisyah", role:"Manager", department:"Operations" }];
  employees = employees.filter(e => e.id !== "MN002");

  // Move to pending (simulate backend)
  export function requestCameIn(empId) {
    const idx = employees.findIndex(e => e.id === empId);
    if (idx === -1) return;
    pending = [employees[idx], ...pending];
    employees = [...employees.slice(0, idx), ...employees.slice(idx + 1)];
    sidebarOpen = true;
  }

  // Approve / reject
  function approveLeave(emp) {
    const idx = pending.findIndex(e => e.id === emp.id);
    if (idx === -1) return;
    employees = [pending[idx], ...employees];
    pending = [...pending.slice(0, idx), ...pending.slice(idx + 1)];
  }
  const rejectLeave = approveLeave;

  // Sidebar state
  let sidebarOpen = false;
  const toggleSidebar = () => (sidebarOpen = !sidebarOpen);
  const pendingCount = () => pending.length;

  // ---------- Add New Employee Modal (dummy wire-up) ----------
  let addModalOpen = false;

  // Form model
  let newEmp = {
    empId: "",
    name: "",
    email: "",
    position: "",
    employmentDate: "",
    terminationDate: "",
    confirmationDate: "",
    gender: "Male",
    annualLeave: "14.0",
    medicalLeave: "14.0",
    department: "Technical Data"
  };

  function openAddModal() {
    addModalOpen = true;
    // optional defaults
    newEmp = {
      empId: "",
      name: "",
      email: "",
      position: "",
      employmentDate: "",
      terminationDate: "",
      confirmationDate: "",
      gender: "Male",
      annualLeave: "14.0",
      medicalLeave: "14.0",
      department: "Technical Data"
    };
  }

  function submitNewEmployee(e) {
    e.preventDefault();

    // simple required checks
    if (!newEmp.name || !newEmp.email || !newEmp.position) {
      alert("Please fill Name, Email, and Position.");
      return;
    }

    // create an ID if user didn't set one
    const randPrefix = IDS[Math.floor(Math.random()*IDS.length)];
    const newId = newEmp.empId?.trim() || `${randPrefix}${String(employees.length + 101).padStart(3,'0')}`;

    // push to list (DUMMY; replace with API later)
    employees = [
      {
        id: newId,
        name: newEmp.name,
        role: newEmp.position || "Employee",
        department: newEmp.department || "General"
      },
      ...employees
    ];

    // TODO: integrate with backend
    // await fetch('/api/employees', { method: 'POST', body: JSON.stringify(newEmp) })

    addModalOpen = false;
    alert(`Employee "${newEmp.name}" added (dummy).`);
  }
</script>

<svelte:window on:keydown={handleKey} />

<style>
  :global(html, body){ height:100%; margin:0; }
  :global(body){
    font-family: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans";
    background:url('/images/bg.png') no-repeat center center fixed;
    background-size:cover;
    overflow-y:auto;
  }

  /* Profile (normal inline style, not floating) */
  .profile{ display:flex; align-items:center; gap:12px; color:#fff; position:relative; }
  .icon-btn{ border:none; background:transparent; cursor:pointer; font-size:18px; line-height:1; padding:6px; border-radius:8px; color:#fff; }
  .icon-btn:hover{ background:rgba(255,255,255,.12); }
  .profile-info{ display:flex; align-items:center; gap:10px; }
  .avatar-img{ height:70px; width:70px; border-radius:9999px; display:block; box-shadow:0 0 0 2px rgba(255,255,255,.25); }
  .who .name{ font-size:16px; font-weight:700; }
  .who .sub{ font-size:12px; opacity:.95; color:#fff; }
  .caret{ font-size:16px; color:#fff; cursor:pointer; background:none; border:none; }

  .profile .menu{
    position:absolute; right:0; top:calc(100% + 8px);
    background:#fff; border:1px solid #e5e7eb; border-radius:10px; box-shadow:0 10px 26px rgba(0,0,0,.18);
    min-width:180px; padding:6px; z-index:50;
  }
  .profile .menu a{ display:block; padding:8px 10px; border-radius:8px; color:#111827; font-weight:600; text-decoration:none; }
  .profile .menu a:hover{ background:#f3f4f6; }

  /* Employees grid */
  .main{ padding:1rem; }
  .employees-header {
    display:flex;
    justify-content:space-between;
    align-items:center;
    margin-bottom:1rem;
    color:#fff;
  }
  /* Bigger Employees title */
  .employees-title { font-size:32px; font-weight:800; margin:0; }

  /* Add New Employee link with underline */
  .add-employee-link {
    color:#fff;
    text-decoration: underline;
    font-size:16px;
    font-weight:600;
    cursor:pointer;
  }
  .add-employee-link:hover { opacity:.85; }

  .employees-grid{ display:grid; gap:1rem; grid-template-columns: repeat(auto-fill, minmax(170px, 0.5fr)); }

  .emp-box{ background:#fff; border-radius:12px; padding:1rem; text-align:center; color:#111; box-shadow:0 1px 3px rgba(0,0,0,.08); }
  .emp-box img{ width:64px; height:64px; border-radius:9999px; margin-bottom:.5rem; }
  .emp-box h3{ margin:0; font-size:15px; color:#217859; }
  .emp-box p{ margin:2px 0; font-size:12px; }
  .emp-actions{ margin-top:.6rem; }
  .btn{ border:none; border-radius:8px; padding:.38rem .7rem; font-size:12px; cursor:pointer; font-weight:700; }
  .btn.details{ background:#e0f2fe; color:#0c4a6e; }

  /* Overlay + Sidebar */
  .overlay{
    position:fixed; inset:0; background:rgba(0,0,0,.25);
    opacity:0; pointer-events:none; transition:opacity .2s ease; z-index:40;
  }
  .overlay.show{ opacity:1; pointer-events:auto; }

  .sidebar{
    position:fixed; right:0; top:0; height:100vh; width:380px; max-width:92vw;
    background:#fff; box-shadow:-14px 0 32px rgba(0,0,0,.18);
    transform:translateX(100%); transition:transform .25s ease;
    z-index:60; display:flex; flex-direction:column;
  }
  .sidebar.open{ transform:translateX(0); }

  .sidebar-header{ display:flex; justify-content:space-between; align-items:center; padding:14px 16px; border-bottom:1px solid #e5e7eb; }
  .sidebar-title{ font-size:18px; font-weight:800; color:#0f172a; }
  .close-btn{ border:none; background:transparent; font-size:22px; cursor:pointer; color:#475569; }

  .sidebar-body{ padding:14px 16px; overflow:auto; flex:1; }
  .sidebar-footer{ padding:12px 16px; border-top:1px solid #e5e7eb; display:flex; justify-content:flex-end; }
  .cancel-btn{ border:1px solid #e5e7eb; background:#fff; color:#111827; border-radius:8px; padding:.45rem .8rem; font-weight:700; cursor:pointer; }

  .toprow{ display:flex; padding:12px 20px; }
  .toprow .profile{ margin-left:auto; }

  .pending-card{ background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:12px; margin-bottom:12px; text-align:center; }
  .pending-card h3{ margin:0; font-size:15px; color:#7c3aed; }
  .pending-card p{ margin:2px 0; font-size:12px; color:#334155; }
  .approve-btn{ border:none; border-radius:8px; padding:.38rem .7rem; font-size:12px; cursor:pointer; font-weight:800; background:#22c55e; color:#064e3b; }
  .reject-btn{ border:none; border-radius:8px; padding:.38rem .7rem; font-size:12px; cursor:pointer; font-weight:800; background:#fca5a5; color:#7f1d1d; margin-left:.5rem; }

  /* Sidebar tab */
  .sidebar-tab{
    position:fixed; right:0; top:40%; transform:translateY(-50%);
    display:flex; align-items:center; gap:8px;
    background:#111827; color:#fff; padding:.6rem .95rem .6rem 1rem;
    border-top-left-radius:9999px; border-bottom-left-radius:9999px;
    cursor:pointer; user-select:none; z-index:50; box-shadow:0 8px 20px rgba(0,0,0,.25);
  }
  .sidebar-tab .label{ font-weight:800; font-size:14px; }
  .badge{ min-width:22px; height:22px; display:inline-grid; place-items:center; background:#ef4444; color:#fff; font-weight:800; border-radius:9999px; font-size:12px; padding:0 6px; }

  @media (max-width:640px){
    .main{ padding:1rem; }
    .employees-grid{ grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
  }

  /* ---------- Add Modal Styles ---------- */
  .modal-wrap{
    position:fixed; inset:0; display:grid; place-items:center;
    background:rgba(0,0,0,.35);
    z-index:80; /* above sidebar */
    animation:fadeIn .15s ease;
  }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }

  .modal{
    width:min(720px, 94vw);
    background:#fff; border-radius:14px; box-shadow:0 14px 40px rgba(0,0,0,.25);
    overflow:hidden;
  }
  .modal-hd{
    padding:14px 18px; border-bottom:1px solid #e5e7eb; display:flex; align-items:center; justify-content:space-between;
  }
  .modal-ttl{ font-weight:700; font-size:22px; color:#49bdb3; }
  .modal-x{ border:none; background:transparent; font-size:22px; cursor:pointer; color:#475569; }

  .modal-bd{ padding:16px 18px; max-height:70vh; overflow:auto; }
  .form-grid{ display:grid; grid-template-columns:1fr 1fr; gap:12px 16px; }
  .form-row.full{ grid-column:1 / -1; }
  label{ display:block; font-size:12px; color:#374151; margin-bottom:6px; font-weight:600; }
  input, select{
    width:100%; padding:10px 12px; border:1px solid #e5e7eb; border-radius:10px; font-size:14px;
    outline:none;
  }
  input:focus, select:focus{ border-color:#cbd5e1; box-shadow:0 0 0 3px rgba(72,189,179,.15); }

  .modal-ft{
    padding:14px 18px; border-top:1px solid #e5e7eb;
    display:flex; gap:10px; justify-content:flex-end;
  }
  .btn-primary{
    background:#49bdb3; color:#fff; border:none; border-radius:10px; padding:.6rem 1rem; font-weight:800; cursor:pointer;
  }
  .btn-primary:hover{ background:#40b1a7; }
  .btn-ghost{
    background:#fff; color:#111827; border:1px solid #e5e7eb; border-radius:10px; padding:.6rem 1rem; font-weight:700; cursor:pointer;
  }
</style>

<!-- Normal Profile -->
<div class="toprow">
  <div class="profile" use:clickOutside>
    <button class="icon-btn bell" aria-label="Notifications">🔔</button>
    <div class="profile-info">
      <img src="/images/icontest1.png" alt="" class="avatar-img"
           on:error={(e)=> e.currentTarget.style.display='none'} />
      <div class="who">
        <div class="name">{user?.name || 'Admin'}</div>
        <div class="sub">{user?.role || 'admin'}</div>
        <div class="sub">#{user?.staffId || 'E8505'}</div>
      </div>
    </div>
    <button class="caret" on:click={() => (profileMenuOpen = !profileMenuOpen)}>▾</button>
    {#if profileMenuOpen}
      <div class="menu" role="menu">
        <a role="menuitem" href="/dashboard/admin/profile">Update Profile Picture</a>
        <a role="menuitem" href="/dashboard/admin/profile">Update Password</a>
      </div>
    {/if}
  </div>
</div>

<!-- Employees -->
<div class="main">
  <div class="topbar">
    <div class="employees-header">
      <h2 class="employees-title">Employees</h2>
      <a class="add-employee-link" on:click={openAddModal}>Add New Employee</a>
    </div>

    <div class="employees-grid">
      {#each employees as emp (emp.id)}
        <div class="emp-box">
          <img src="https://via.placeholder.com/64" alt="profile" />
          <h3>{emp.name}</h3>
          <p>{emp.role}</p>
          <p>ID: {emp.id}</p>
          <p>Department: {emp.department}</p>
          <div class="emp-actions">
            <button class="btn details" on:click={() => alert(`Details for ${emp.name}`)}>Details</button>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<!-- Overlay for sidebar -->
<div class:show={sidebarOpen} class="overlay" on:click={toggleSidebar}></div>

<!-- Sidebar -->
<div class:open={sidebarOpen} class="sidebar" aria-hidden={!sidebarOpen}>
  <div class="sidebar-header">
    <div class="sidebar-title">Pending Approval{pendingCount() ? ` (${pendingCount()})` : ''}</div>
    <button class="close-btn" on:click={toggleSidebar}>✕</button>
  </div>
  <div class="sidebar-body">
    {#if pending.length === 0}
      <p style="color:#64748b; text-align:center;">No pending requests.</p>
    {:else}
      {#each pending as emp (emp.id)}
        <div class="pending-card">
          <h3>{emp.name}</h3>
          <p>{emp.role}</p>
          <p>ID: {emp.id}</p>
          <p>Department: {emp.department}</p>
          <div>
            <button class="approve-btn" on:click={() => approveLeave(emp)}>Approve</button>
            <button class="reject-btn" on:click={() => rejectLeave(emp)}>Reject</button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
  <div class="sidebar-footer">
    <button class="cancel-btn" on:click={() => (sidebarOpen = false)}>Cancel</button>
  </div>
</div>

<!-- Sidebar tab -->
<div class="sidebar-tab" on:click={toggleSidebar}>
  <span class="label">Pending Approval</span>
  {#if pendingCount() > 0}
    <span class="badge">{pendingCount()}</span>
  {/if}
</div>

<!-- -------------- Add New Employee Modal -------------- -->
{#if addModalOpen}
  <div class="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="add-emp-title">
    <div class="modal">
      <div class="modal-hd">
        <div id="add-emp-title" class="modal-ttl">Add New Employee</div>
        <button class="modal-x" on:click={() => (addModalOpen = false)}>✕</button>
      </div>

      <form class="modal-bd" on:submit={submitNewEmployee}>
        <div class="form-grid">
          <div class="form-row">
            <label>Employee ID</label>
            <input placeholder="EDS041" bind:value={newEmp.empId} />
          </div>

          <div class="form-row">
            <label>Name</label>
            <input placeholder="Full name" bind:value={newEmp.name} required />
          </div>

          <div class="form-row full">
            <label>Email</label>
            <input type="email" placeholder="name@company.com" bind:value={newEmp.email} required />
          </div>

          <div class="form-row">
            <label>Position</label>
            <input placeholder="e.g., Drilling Data QC Engineer" bind:value={newEmp.position} required />
          </div>

          <div class="form-row">
            <label>Department</label>
            <select bind:value={newEmp.department}>
              {#each DEPTS as d}<option value={d}>{d}</option>{/each}
            </select>
          </div>

          <div class="form-row">
            <label>Employment Date</label>
            <input type="date" bind:value={newEmp.employmentDate} />
          </div>

          <div class="form-row">
            <label>Termination Date</label>
            <input type="date" bind:value={newEmp.terminationDate} />
          </div>

          <div class="form-row">
            <label>Confirmation Date</label>
            <input type="date" bind:value={newEmp.confirmationDate} />
          </div>

          <div class="form-row">
            <label>Gender</label>
            <select bind:value={newEmp.gender}>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </div>

          <div class="form-row">
            <label>Total Annual Leave (Per Year)</label>
            <input type="number" step="0.5" min="0" bind:value={newEmp.annualLeave} />
          </div>

          <div class="form-row">
            <label>Total Medical Leave (Per Year)</label>
            <input type="number" step="0.5" min="0" bind:value={newEmp.medicalLeave} />
          </div>

          <!-- stretch area to mimic screenshot spacing -->
          <div class="form-row full"></div>
        </div>

        <div class="modal-ft">
          <button type="button" class="btn-ghost" on:click={() => (addModalOpen = false)}>Cancel</button>
          <button type="submit" class="btn-primary">Submit</button>
        </div>
      </form>
    </div>
  </div>
{/if}
