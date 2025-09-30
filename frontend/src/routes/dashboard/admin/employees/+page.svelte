<script>
  // ------- Profile -------
  let profileMenuOpen = false;
  const user = { name: "Afiq Mikail", role: "Human Resources", staffId: "E8505" };

  function clickOutside(node) {
    const onClick = (e) => { if (!node.contains(e.target)) profileMenuOpen = false; };
    document.addEventListener('click', onClick);
    return { destroy: () => document.removeEventListener('click', onClick) };
  }

  // ESC closes things
  function handleKey(e) {
    if (e.key === 'Escape') {
      if (sidebarOpen) sidebarOpen = false;
      if (profileMenuOpen) profileMenuOpen = false;
      if (addModalOpen) addModalOpen = false;
      if (detailsOpen) { detailsOpen = false; editMode = false; }
    }
  }

  // ------- Dummy data -------
  const NAMES = [
    "Afiq Mikail","Nur Aisyah","Daniel Tan","Sophia Lim","Muhammad Shamsul","Ariana Wong","John Lee","Farah Zahra",
    "Hafiz Rahman","Amirul Hakim","Nabila Rahman","Jason Ong","Puteri Balqis","Christopher Yap","Mira Izzati","Iqbal Zain",
    "Syafiqah Noor","Faizal Aziz","Hannah Cho","Kelvin Teo","Rina Hashim","Zara Kamal","Ridzuan Salleh","Mei Yee",
    "Irfan Danial","Aisyah Humaira","Adam Firdaus","Noraishah Ismail","Kevin Chan","Lydia Goh","Wan Aiman","Diyana Ahmad",
    "Hakim Roslan","Zul Hilmi","Nurul Auni","Faris Zulkifli","Melissa Chong","Zaid Hakimi"
  ];
  const ROLES = ["Human Resources","Manager","Engineer","Executive","Analyst","Technician","Team Lead","Coordinator"];
  const DEPTS = ["Administrator","Operations Support","Technical Data","Operations - RTOC","Sales & Technical Excellence","Director"];
  const IDS   = ["HR","MN","EN","EX","AN","TC","TL","CO"];
  const makeId = (prefix, i) => `${prefix}${String(i+1).padStart(3,"0")}`;

  // Employees (cards)
  let employees = NAMES.map((name, i) => ({
    id: makeId(IDS[i % IDS.length], i),
    name,
    role: ROLES[i % ROLES.length],
    department: DEPTS[i % DEPTS.length]
  }));

  // --- Department filter ---
  let deptFilter = 'All';
  const deptOptions = ['All', ...Array.from(new Set(DEPTS))];

  $: filteredEmployees = deptFilter === 'All'
    ? employees
    : employees.filter(e => e.department === deptFilter);

  // Full details map
  /** @type {Record<string, any>} */
  let detailsById = {};
  for (const e of employees) {
    detailsById[e.id] = {
      photoUrl: "",
      empId: e.id,
      name: e.name,
      email: "",
      position: e.role,
      department: e.department,
      employmentDate: "",
      terminationDate: "",
      confirmationDate: "",
      gender: "",
      annualLeave: "14.0",
      medicalLeave: "14.0",
      notes: ""
    };
  }

  // Pending demo
  let pending = [{ id:"MN002", name:"Nur Aisyah", role:"Manager", department:"Operations" }];
  employees = employees.filter(e => e.id !== "MN002");

  function requestCameIn(empId) {
    const idx = employees.findIndex(e => e.id === empId);
    if (idx === -1) return;
    pending = [employees[idx], ...pending];
    employees = [...employees.slice(0, idx), ...employees.slice(idx + 1)];
    sidebarOpen = true;
  }

  function approveLeave(emp) {
    const idx = pending.findIndex(e => e.id === emp.id);
    if (idx === -1) return;
    employees = [pending[idx], ...employees];
    pending = [...pending.slice(0, idx), ...pending.slice(idx + 1)];
    if (!detailsById[emp.id]) {
      detailsById[emp.id] = {
        photoUrl: "",
        empId: emp.id, name: emp.name, email: "", position: emp.role,
        department: emp.department, employmentDate: "", terminationDate: "",
        confirmationDate: "", gender: "", annualLeave: "14.0", medicalLeave: "14.0", notes: ""
      };
    }
  }
  const rejectLeave = approveLeave;

  // ------- Sidebar -------
  let sidebarOpen = false;
  const toggleSidebar = () => (sidebarOpen = !sidebarOpen);
  const pendingCount = () => pending.length;

  // ------- Add New Employee (modal) -------
  let addModalOpen = false;

  let newEmp = {
    photoUrl: "",
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
    department: "Technical Data",
    notes: ""
  };

  function openAddModal() {
    addModalOpen = true;
    newEmp = {
      photoUrl: "",
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
      department: "Technical Data",
      notes: ""
    };
  }

  // Photo upload for ADD (PNG/JPG only)
  function handleNewPhotoFile(e) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg)$/i.test(file.type)) {
      alert("Please choose a PNG or JPG image.");
      e.currentTarget.value = "";
      return;
    }
    newEmp.photoUrl = URL.createObjectURL(file); // preview
  }

  let employmentDateEl; // ref to focus when missing

  function submitNewEmployee(e) {
    e.preventDefault();

    if (!newEmp.name || !newEmp.email || !newEmp.position) {
      alert("Please fill Name, Email, and Position.");
      return;
    }

    if (!newEmp.employmentDate) {
      alert("Please select the Employment Date.");
      employmentDateEl?.focus();
      return;
    }

    const randPrefix = IDS[Math.floor(Math.random()*IDS.length)];
    const newId = newEmp.empId?.trim() || `${randPrefix}${String(employees.length + 101).padStart(3,'0')}`;

    // Add card
    const card = {
      id: newId,
      name: newEmp.name,
      role: newEmp.position || "Employee",
      department: newEmp.department || "General"
    };
    employees = [card, ...employees];

    // Save details
    detailsById[newId] = {
      photoUrl: newEmp.photoUrl || "",
      empId: newId,
      name: newEmp.name,
      email: newEmp.email,
      position: newEmp.position,
      department: newEmp.department,
      employmentDate: newEmp.employmentDate,
      terminationDate: newEmp.terminationDate,
      confirmationDate: newEmp.confirmationDate,
      gender: newEmp.gender,
      annualLeave: String(newEmp.annualLeave ?? "14.0"),
      medicalLeave: String(newEmp.medicalLeave ?? "14.0"),
      notes: newEmp.notes
    };

    addModalOpen = false;
    alert(`Employee "${newEmp.name}" added (dummy).`);
  }

  // ------- Details Modal (Update Profile) -------
  let detailsOpen = false;
  let selectedEmp = null;
  let editMode = false;       // Edit text fields only
  let detailsForm = null;     // always a working copy

  function openDetails(empId) {
    const base = detailsById[empId] ?? null;
    selectedEmp = base ? structuredClone(base) : null;
    detailsForm = base ? structuredClone(base) : null;  // keep a buffer always
    editMode = false;
    detailsOpen = !!selectedEmp;
  }

  const safe = (v) => (v && String(v).trim().length ? v : "-");

  function toggleEditSave() {
    if (!selectedEmp) return;

    if (editMode) {
      if (!detailsForm.name || !detailsForm.position) {
        alert("Name and Position are required.");
        return;
      }
      // keep original photoUrl (no editing here)
      detailsForm.photoUrl = selectedEmp.photoUrl;

      detailsById[selectedEmp.empId] = structuredClone(detailsForm);
      selectedEmp = structuredClone(detailsForm);

      const idx = employees.findIndex(e => e.id === selectedEmp.empId);
      if (idx !== -1) {
        employees[idx] = {
          ...employees[idx],
          name: detailsForm.name,
          role: detailsForm.position,
          department: detailsForm.department
        };
        employees = [...employees];
      }

      editMode = false;
      return;
    }

    editMode = true;
  }
</script>

<svelte:window on:keydown={handleKey} />

<style>
  :global(html, body){ height:100%; margin:0; }
  :root { --primary:#49bdb3; --ink:#0c4a6e ; --muted:#64748b; --line:#e5e7eb; --soft:#f8fafc; }

  :global(body){
    font-family: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans";
    background:url('/images/bg.png') no-repeat center center fixed;
    background-size:cover;
    overflow-y:auto;
  }

  .add-employee-link { color:#fff; text-decoration: underline; font-size:16px; font-weight:600; cursor:pointer; white-space:nowrap; margin-top:10px; }
  .add-employee-link:hover { opacity:.85; }

  /* Grid & Card */
  .main{ padding:1.5rem; }
  .employees-grid{ display:grid; gap:1rem; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }

  .emp-box{ background:#fff; border-radius:12px; padding:1rem; color:#111; box-shadow:0 1px 3px rgba(0,0,0,.08);
    display:flex; flex-direction:column; min-height:240px; }
  .emp-top{ text-align:center; }

  /* Avatar fallback */
  .avatar-wrap, .details-avatar-wrap{
    position:relative; width:64px; height:64px; margin:0 auto .5rem; border-radius:9999px; overflow:hidden;
    background:#e5e7eb; border:1px solid #e5e7eb;
  }
  .details-avatar-wrap{ width:72px; height:72px; margin:0; }
  .avatar-wrap img, .details-avatar-wrap img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block; border-radius:9999px; }
  .avatar-fallback, .details-avatar-fallback{ position:absolute; inset:0; display:grid; place-items:center; }
  .avatar-fallback svg, .details-avatar-fallback svg{ width:60%; height:60%; }

  .emp-box h3{ margin:0; font-size:15px; color:#217859; }
  .emp-box p{ margin:2px 0; font-size:12px; color:#334155; }
  .emp-spacer{ flex:1 1 auto; }
  .emp-actions{ margin-top:auto; display:flex; justify-content:center; }
  .btn{ border:none; border-radius:8px; padding:.42rem .75rem; font-size:12px; cursor:pointer; font-weight:700; }
  .btn.details{ background:#e0f2fe; color:#000; }

  /* Sidebar */
  .overlay{ position:fixed; inset:0; background:rgba(0,0,0,.25); opacity:0; pointer-events:none; transition:opacity .2s; z-index:40; }
  .overlay.show{ opacity:1; pointer-events:auto; }
  .sidebar{
    position:fixed; right:0; top:0; height:100vh; width:380px; max-width:92vw;
    background:#fff; box-shadow:-14px 0 32px rgba(0,0,0,.18);
    transform:translateX(100%); transition:transform .25s ease;
    z-index:60; display:flex; flex-direction:column;
  }
  .sidebar.open{ transform:translateX(0); }
  .sidebar-header{ display:flex; justify-content:space-between; align-items:center; padding:14px 16px; border-bottom:1px solid var(--line); }
  .sidebar-title{ font-size:18px; font-weight:700; color:#000; }
  .close-btn{ border:none; background:transparent; font-size:22px; cursor:pointer; color:#475569; }
  .sidebar-body{ padding:14px 16px; overflow:auto; flex:1; }
  .sidebar-footer{ padding:12px 16px; border-top:1px solid var(--line); display:flex; justify-content:flex-end; }
  .cancel-btn{ border:1px solid var(--line); background:#fff; color:#000; border-radius:8px; padding:.45rem .8rem; font-weight:700; cursor:pointer; }

  .pending-card{ background:#fff; border:1px solid var(--line); border-radius:12px; padding:12px; margin-bottom:12px; text-align:center; }
  .pending-card h3{ margin:0; font-size:15px; color:#000; }
  .pending-card p{ margin:2px 0; font-size:12px; color:#334155; }
  .approve-btn{ border:none; border-radius:8px; padding:.38rem .7rem; font-size:12px; cursor:pointer; font-weight:700; background:#22c55e; color:#064e3b; }
  .reject-btn{ border:none; border-radius:8px; padding:.38rem .7rem; font-size:12px; cursor:pointer; font-weight:700; background:#e30707; color:#7f1d1d; margin-left:.5rem; }

  .sidebar-tab{
    position:fixed; right:0; top:40%; transform:translateY(-50%);
    display:flex; align-items:center; gap:8px; background:#0c4a6e; color:#fff; padding:.6rem .95rem .6rem 1rem;
    border-top-left-radius:9999px; border-bottom-left-radius:9999px; cursor:pointer; user-select:none; z-index:50; box-shadow:0 8px 20px rgba(0,0,0,.25);
  }
  .sidebar-tab .label{ font-weight:700; font-size:14px; }
  .badge{ min-width:22px; height:22px; display:inline-grid; place-items:center; background:#ef4444; color:#fff; font-weight:800; border-radius:9999px; font-size:12px; padding:0 6px; }

  /* Modal base */
  .modal-wrap{ position:fixed; inset:0; display:grid; place-items:center; background:rgba(0,0,0,.35); z-index:80; animation:fadeIn .15s ease; }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  .modal{ width:min(900px, 96vw); background:#fff; border-radius:18px; box-shadow:0 14px 40px rgba(0,0,0,.25); overflow:hidden; }
  .modal-hd{ padding:14px 18px; border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:space-between; }
  .modal-ttl{ font-weight:700; font-size:22px; color:#49bdb3; }
  .modal-x{ border:none; background:transparent; font-size:22px; cursor:pointer; color:#475569; }
  .modal-bd{ padding:0; max-height:72vh; overflow:auto; }

  .sub-ttl{
  margin: 0 0 10px;
  font-weight: 800;
  font-size: 14px;
  letter-spacing:.2px;
  color: var(--ink); /* 0c4a6e */
}


  /* Forms */
  .add-layout, .details-layout{ padding:22px; }
  .section-ttl{ font-weight:700; color:#0c4a6e; margin:0 0 14px; font-size:18px; }
  .add-grid, .details-grid-form{ display:grid; grid-template-columns: 1fr 220px; gap:20px; }
  .photo-card{
    align-self:flex-start; justify-self:end;
    width:180px; height:180px; border-radius:20px; background:linear-gradient(180deg,#fff,#f3f4f6);
    border:1px dashed #d1d5db; display:grid; place-items:center; position:relative;
    box-shadow:0 8px 20px rgba(0,0,0,.06);
  }
  .photo-card input{ position:absolute; inset:0; opacity:0; cursor:pointer; }
  .photo-card .cam{
    width:56px; height:56px; border-radius:9999px; background:var(--primary);
    display:grid; place-items:center; color:#fff; font-size:22px; box-shadow:0 8px 16px rgba(73,189,179,.35);
  }
  .photo-preview{ position:absolute; inset:0; overflow:hidden; border-radius:20px; }
  .photo-preview img{ width:100%; height:100%; object-fit:cover; display:block; }

  .form{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:18px; box-shadow:0 6px 18px rgba(0,0,0,.05); }
  .row{ display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:12px; }
  .row.three{ grid-template-columns: 1fr 1fr 1fr; }
  .row.single{ grid-template-columns:1fr; }
  label{ font-size:12px; color:#374151; font-weight:700; margin:0 0 6px; display:block; }
  .ctl{ display:flex; align-items:center; background:#fff; border:1px solid var(--line); border-radius:12px; padding:10px 12px; }
  .ctl input, .ctl select, .ctl textarea{ border:none; outline:none; width:100%; font-size:14px; color:#111827; background:transparent; }
  .ctl textarea{ min-height:90px; resize:vertical; }
  .pill{ border-radius:9999px; }
  .muted{ color:#64748b; font-size:12px; }

  .ctl.disabled{ background:#f8fafc; }
  .ctl :disabled{ color:#6b7280; }

  .form-ft{ display:flex; justify-content:flex-end; gap:10px; padding-top:10px; margin-top:8px; }
  .btn-ghost{ background:#fff; color:#0c4a6e; border:1px solid var(--line); border-radius:12px; padding:.7rem 1rem; font-weight:700; cursor:pointer; }
  .btn-primary{
    background:var(--primary); color:#fff; border:none; border-radius:10px; padding:.8rem 1.4rem; font-weight:700; cursor:pointer;
  }
  .btn-primary:hover{ filter:brightness(.96); }

  /* --- DETAILS (Update Profile) polish --- */
  .ctl{ box-shadow: inset 0 1px 0 rgba(0,0,0,.02); }
  .ctl:focus-within{ border-color:#49bdb3; box-shadow:0 0 0 3px rgba(73,189,179,.15); }

  /* Date inputs with calendar icon on the right */
  .ctl.date { position:relative; }
  .ctl.date::after{
    content:"";
    position:absolute; right:12px; top:50%; transform:translateY(-50%);
    width:18px; height:18px; opacity:.7;
    background:
      url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" stroke="%2364748b" fill="none" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" ry="2" stroke-width="2"/><line x1="16" y1="3" x2="16" y2="7" stroke-width="2"/><line x1="8" y1="3" x2="8" y2="7" stroke-width="2"/><line x1="3" y1="11" x2="21" y2="11" stroke-width="2"/></svg>')
      no-repeat center / contain;
    pointer-events:none;
  }
  input[type="date"]{ padding-right:34px; }

  /* Details modal buttons */
  .details-actions{ display:flex; gap:10px; justify-content:flex-end; padding:10px 18px 16px; }

  @media (max-width:740px){
    .add-grid, .details-grid-form{ grid-template-columns:1fr; }
    .photo-card{ justify-self:stretch; width:100%; height:180px; }
  }
  @media (max-width:640px){
    .toprow{ align-items:stretch; }
    .rightcol{ align-items:flex-start; min-width:unset; }
    .employees-grid{ grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
  }

  .photo-card .cam svg{ width: 28px; height: 28px; display: block; }

  /* Filter section */
  .filter-wrap { display:flex; align-items:center; gap:6px; }
  .filter-label { margin: 0 6px; font-weight: 600; font-size: 14px; color: #fff; }
  .filter-icon { width: 16px; height: 16px; color: #fff; opacity: 0.9; }

  /* Slimmer select box */
  .filter-select { padding:4px 8px; min-width:180px; }
  .filter-select select { font-size:13px; padding:4px 6px; height:28px; }
</style>

<!-- Employees grid -->
<div class="main">
  <div class="topbar">
    <div class="toprow" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <!-- Left: Add New Employee as underlined link -->
      <a href="#" class="add-employee-link" on:click|preventDefault={openAddModal}>
        Add New Employee
      </a>

      <!-- Right: Filter -->
      <div class="rightcol filter-wrap">
        <svg class="filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 4h18l-7 8v6l-4 2v-8l-7-8z"/>
        </svg>
        <label class="filter-label" for="dept-filter">Department</label>
        <div class="ctl pill filter-select">
          <select id="dept-filter" bind:value={deptFilter} aria-label="Filter by department">
            {#each deptOptions as d}<option value={d}>{d}</option>{/each}
          </select>
        </div>
      </div>
    </div>

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
                <img src={detailsById[emp.id].photoUrl} alt="profile" on:error={(e)=> (e.currentTarget.style.display='none')} />
              {/if}
            </div>

            <h3>{emp.name}</h3>
            <p>{emp.role}</p>
            <p>ID: {emp.id}</p>
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

<!-- Add New Employee -->
{#if addModalOpen}
  <div class="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="add-emp-title">
    <div class="modal">
      <div class="modal-hd">
        <div id="add-emp-title" class="modal-ttl">Add New Employee</div>
        <button class="modal-x" on:click={() => (addModalOpen = false)}>✕</button>
      </div>

      <div class="modal-bd">
        <div class="add-layout">
          <div class="add-grid">
            <!-- Left form -->
            <form class="form" on:submit={submitNewEmployee}>
              <div class="row">
                <div>
                  <label>Full Name</label>
                  <div class="ctl pill"><input placeholder="Enter full name" bind:value={newEmp.name} required /></div>
                </div>
                <div>
                  <label>Employee ID</label>
                  <div class="ctl pill"><input placeholder="e.g., HR123" bind:value={newEmp.empId} /></div>
                </div>
              </div>

              <div class="row">
                <div>
                  <label>Position</label>
                  <div class="ctl pill"><input placeholder="e.g., Data Engineer" bind:value={newEmp.position} required /></div>
                </div>
                <div>
                  <label>Department</label>
                  <div class="ctl pill">
                    <select bind:value={newEmp.department}>
                      {#each DEPTS as d}<option value={d}>{d}</option>{/each}
                    </select>
                  </div>
                </div>
              </div>

              <div class="row">
                <div>
                  <label>Email</label>
                  <div class="ctl pill"><input type="email" placeholder="name@company.com" bind:value={newEmp.email} required /></div>
                </div>
                <div>
                  <label>Employment Date</label>
                  <div class="ctl pill date">
                    <input type="date" bind:value={newEmp.employmentDate} required bind:this={employmentDateEl} />
                  </div>
                </div>
              </div>

              <div class="row">
                <div>
                  <label>Confirmation Date</label>
                  <div class="ctl pill date"><input type="date" bind:value={newEmp.confirmationDate} /></div>
                </div>
                <div>
                  <label>Termination Date</label>
                  <div class="ctl pill date"><input type="date" bind:value={newEmp.terminationDate} /></div>
                </div>
              </div>

              <div class="row">
                <div>
                  <label>Gender</label>
                  <div class="ctl pill">
                    <select bind:value={newEmp.gender}>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label class="muted">Leave Entitlements (per year)</label>
                  <div class="row" style="gap:10px; margin:0;">
                    <div class="ctl pill"><input type="number" step="0.5" min="0" bind:value={newEmp.annualLeave} placeholder="Annual Leave" /></div>
                    <div class="ctl pill"><input type="number" step="0.5" min="0" bind:value={newEmp.medicalLeave} placeholder="Medical Leave" /></div>
                  </div>
                </div>
              </div>

              <div class="row single">
                <div>
                  <label>Notes</label>
                  <div class="ctl"><textarea placeholder="Optional notes…" bind:value={newEmp.notes} /></div>
                </div>
              </div>

              <div class="form-ft">
                <button type="button" class="btn-ghost" on:click={() => (addModalOpen = false)}>Cancel</button>
                <button type="submit" class="btn-primary">Save &amp; Continue</button>
              </div>
            </form>

            <!-- Right: Photo uploader -->
            <div class="photo-card" title="Add Photo">
              {#if newEmp.photoUrl}
                <div class="photo-preview"><img src={newEmp.photoUrl} alt="Preview" /></div>
              {:else}
                <div class="cam" aria-label="Add photo (PNG/JPG)">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"
                          fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </div>
                <div class="muted" style="position:absolute; bottom:10px;">Add Photo</div>
              {/if}
              <input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" on:change={handleNewPhotoFile} />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Employee Details (Update Profile) -->
{#if detailsOpen && selectedEmp}
  <div class="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="emp-details-title">
    <div class="modal">
      <div class="modal-hd">
        <div id="emp-details-title" class="modal-ttl">Employee Details</div>
        <button class="modal-x" on:click={() => { detailsOpen = false; editMode = false; }}>✕</button>
      </div>

      <div class="modal-bd">
        <div class="details-layout">
          <div class="details-grid-form">
            <!-- Left form -->
            <div class="form">
              <div class="row">
                <div>
                  <label>Full Name</label>
                  <div class={"ctl pill " + (!editMode ? 'disabled' : '')}>
                    <input bind:value={detailsForm.name} disabled={!editMode} />
                  </div>
                </div>
                <div>
                  <label>Employee ID</label>
                  <div class={"ctl pill " + (!editMode ? 'disabled' : '')}>
                    <input bind:value={detailsForm.empId} disabled={!editMode} />
                  </div>
                </div>
              </div>

              <div class="row">
                <div>
                  <label>Position</label>
                  <div class={"ctl pill " + (!editMode ? 'disabled' : '')}>
                    <input bind:value={detailsForm.position} disabled={!editMode} />
                  </div>
                </div>
                <div>
                  <label>Department</label>
                  <div class={"ctl pill " + (!editMode ? 'disabled' : '')}>
                    <input bind:value={detailsForm.department} disabled={!editMode} />
                  </div>
                </div>
              </div>

              <div class="row">
                <div>
                  <label>Email</label>
                  <div class={"ctl pill " + (!editMode ? 'disabled' : '')}>
                    <input type="email" bind:value={detailsForm.email} disabled={!editMode} />
                  </div>
                </div>
                <div>
                  <label>Gender</label>
                  <div class={"ctl pill " + (!editMode ? 'disabled' : '')}>
                    <select bind:value={detailsForm.gender} disabled={!editMode}>
                      <option value="">Select</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="row">
                <div>
                  <label>Employment Date</label>
                  <div class={"ctl pill date " + (!editMode ? 'disabled' : '')}>
                    <input type="date" bind:value={detailsForm.employmentDate} disabled={!editMode} />
                  </div>
                </div>
                <div>
                  <label>Confirmation Date</label>
                  <div class={"ctl pill date " + (!editMode ? 'disabled' : '')}>
                    <input type="date" bind:value={detailsForm.confirmationDate} disabled={!editMode} />
                  </div>
                </div>
              </div>

              <div class="row">
                <div>
                  <label>Termination Date</label>
                  <div class={"ctl pill date " + (!editMode ? 'disabled' : '')}>
                    <input type="date" bind:value={detailsForm.terminationDate} disabled={!editMode} />
                  </div>
                </div>
                <div>
                  <label class="muted">Leave Entitlements (per year)</label>
                  <div class="row" style="gap:10px; margin:0;">
                    <div class={"ctl pill " + (!editMode ? 'disabled' : '')}>
                      <input type="number" step="0.5" min="0" bind:value={detailsForm.annualLeave} disabled={!editMode} placeholder="Annual Leave" />
                    </div>
                    <div class={"ctl pill " + (!editMode ? 'disabled' : '')}>
                      <input type="number" step="0.5" min="0" bind:value={detailsForm.medicalLeave} disabled={!editMode} placeholder="Medical Leave" />
                    </div>
                  </div>
                </div>
              </div>

              <div class="row single">
                <div>
                  <label>Notes</label>
                  <div class={"ctl " + (!editMode ? 'disabled' : '')}>
                    <textarea bind:value={detailsForm.notes} disabled={!editMode} placeholder="Optional notes…" />
                  </div>
                </div>
              </div>

              <div class="form-ft">
                {#if editMode}
                  <button class="btn-ghost" on:click={() => { editMode = false; detailsForm = structuredClone(selectedEmp); }}>
                    Cancel
                  </button>
                  <button class="btn-primary" on:click={toggleEditSave}>Save Changes</button>
                {:else}
                  <button class="btn-primary" on:click={toggleEditSave}>Edit Profile</button>
                {/if}
              </div>
            </div>

            <!-- Right: Photo (preview only) -->
            <div class="photo-card" title="Profile Photo">
              {#if selectedEmp.photoUrl}
                <div class="photo-preview"><img src={selectedEmp.photoUrl} alt="Profile" /></div>
              {:else}
                <div class="cam" aria-label="Profile photo">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"
                          fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </div>
                <div class="muted" style="position:absolute; bottom:10px;">No Photo</div>
              {/if}
              <!-- No input here (no photo editing in details) -->
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
