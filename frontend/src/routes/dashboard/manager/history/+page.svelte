
<link href="https://fonts.googleapis.com/css2?family=Bungee&display=swap" rel="stylesheet" />
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap" rel="stylesheet" />

<script>
  // ——— Demo data (with dateFrom/dateTo) ———
  const rows = [
    { month: 'January', employees: [
      { id: 'EMP001', name: 'Afiq Mikail',   department: 'Engineering', totalDays: 2, leaveType: 'Annual',    status: 'Approved', dateFrom: '2025-01-05', dateTo: '2025-01-06' },
      { id: 'EMP014', name: 'Nur Aisyah',    department: 'Finance',     totalDays: 1, leaveType: 'Emergency', status: 'Approved', dateFrom: '2025-01-12', dateTo: '2025-01-12' },
    ]},
    { month: 'February', employees: [
      { id: 'EMP006', name: 'Daniel Tan',    department: 'Sales',       totalDays: 2, leaveType: 'Annual',    status: 'Approved', dateFrom: '2025-02-03', dateTo: '2025-02-04' },
      { id: 'EMP007', name: 'Sophia Lim',    department: 'Marketing',   totalDays: 1, leaveType: 'Sick',      status: 'Pending',  dateFrom: '2025-02-18', dateTo: '2025-02-18' },
    ]},
    { month: 'March', employees: [
      { id: 'EMP009', name: 'Jason Ong',     department: 'Engineering', totalDays: 1, leaveType: 'Annual',    status: 'Cancelled', dateFrom: '2025-03-02', dateTo: '2025-03-02' }, // Example of a cancelled leave
      { id: 'EMP011', name: 'Puteri',        department: 'Operations',  totalDays: 2, leaveType: 'Annual',    status: 'Approved', dateFrom: '2025-03-10', dateTo: '2025-03-11' },
      { id: 'EMP012', name: 'Farah Zahra',   department: 'HR',          totalDays: 1, leaveType: 'Sick',      status: 'Rejected', dateFrom: '2025-03-15', dateTo: '2025-03-15' },
      { id: 'EMP015', name: 'Amirul Hakim',  department: 'Support',     totalDays: 3, leaveType: 'Annual',    status: 'Approved', dateFrom: '2025-03-25', dateTo: '2025-03-27' },
    ]},
    { month: 'April', employees: [
      { id: 'EMP017', name: 'Nabila Rahman', department: 'Design',      totalDays: 1, leaveType: 'Unpaid',    status: 'Approved', dateFrom: '2025-04-08', dateTo: '2025-04-08' },
      { id: 'EMP018', name: 'Hakim Rahman',  department: 'Engineering', totalDays: 2, leaveType: 'Annual',    status: 'Pending',  dateFrom: '2025-04-20', dateTo: '2025-04-21' },
    ]},
    { month: 'May', employees: [
      { id: 'EMP021', name: 'Ariana Wong',   department: 'Legal',       totalDays: 2, leaveType: 'Annual',    status: 'Approved', dateFrom: '2025-05-06', dateTo: '2025-05-07' },
      { id: 'EMP022', name: 'John Lee',      department: 'Finance',     totalDays: 1, leaveType: 'Sick',      status: 'Approved', dateFrom: '2025-05-16', dateTo: '2025-05-16' },
    ]},
    { month: 'June', employees: [] },
    { month: 'July', employees: [
      { id: 'EMP025', name: 'Hafiz Rahman',  department: 'Support',     totalDays: 2, leaveType: 'Annual',    status: 'Approved', dateFrom: '2025-07-03', dateTo: '2025-07-04' },
      { id: 'EMP014', name: 'Nur Aisyah',    department: 'Finance',     totalDays: 1, leaveType: 'Emergency', status: 'Approved', dateFrom: '2025-07-19', dateTo: '2025-07-19' },
    ]},
    { month: 'August', employees: [
      { id: 'EMP006', name: 'Daniel Tan',    department: 'Sales',       totalDays: 1, leaveType: 'Sick',      status: 'Approved', dateFrom: '2025-08-11', dateTo: '2025-08-11' },
      { id: 'EMP007', name: 'Sophia Lim',    department: 'Marketing',   totalDays: 2, leaveType: 'Annual',    status: 'Approved', dateFrom: '2025-08-24', dateTo: '2025-08-25' },
    ]},
    { month: 'September', employees: [
      { id: 'EMP001', name: 'Afiq Mikail',   department: 'Engineering', totalDays: 1, leaveType: 'Annual',    status: 'Approved', dateFrom: '2025-09-05', dateTo: '2025-09-05' },
      { id: 'EMP017', name: 'Nabila Rahman', department: 'Design',      totalDays: 2, leaveType: 'Unpaid',    status: 'Pending',  dateFrom: '2025-09-20', dateTo: '2025-09-21' },
    ]},
    { month: 'October', employees: [
      { id: 'EMP009', name: 'Jason Ong',     department: 'Engineering', totalDays: 1, leaveType: 'Annual',    status: 'Approved', dateFrom: '2025-10-09', dateTo: '2025-10-09' },
    ]},
    { month: 'November', employees: [
      { id: 'EMP011', name: 'Puteri',        department: 'Operations',  totalDays: 1, leaveType: 'Sick',      status: 'Approved', dateFrom: '2025-11-04', dateTo: '2025-11-04' },
      { id: 'EMP012', name: 'Farah Zahra',   department: 'HR',          totalDays: 2, leaveType: 'Annual',    status: 'Approved', dateFrom: '2025-11-18', dateTo: '2025-11-19' },
    ]},
    { month: 'December', employees: [
      { id: 'EMP001', name: 'Afiq Mikail',   department: 'Engineering', totalDays: 2, leaveType: 'Annual',    status: 'Approved', dateFrom: '2025-12-02', dateTo: '2025-12-03' },
      { id: 'EMP007', name: 'Sophia Lim',    department: 'Marketing',   totalDays: 1, leaveType: 'Sick',      status: 'Approved', dateFrom: '2025-12-12', dateTo: '2025-12-12' },
      { id: 'EMP022', name: 'John Lee',      department: 'Finance',     totalDays: 2, leaveType: 'Annual',    status: 'Approved', dateFrom: '2025-12-20', dateTo: '2025-12-21' },
    ]},
  ];

  // modal state
  let showModal = false;
  let selected = null;    // {month, employees}
  let showAll = false;

  function onDetails(row){ selected = row; resetFiltersForMonthView(); showModal = true; }
  function closeModal(){ showModal = false; selected = null; showAll = false; }

  function handleKey(e){ if(e.key === 'Escape') closeModal(); }

  // Count only 'Approved' and 'Pending' leaves for the card display
  const count = (row) => row.employees.filter(e => e.status === 'Approved' || e.status === 'Pending').length;

  // months + ALL tab for the rail
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthShort = ['All','Jan','Feb','Mar','Apr','May','June','July','Aug','Sept','Oct','Nov','Dec'];
  const railTabs = [{ label: 'All', value: 'All' }, ...months.map((m, i) => ({ label: monthShort[i+1], value: m }))];

  function jumpToMonth(m){
    if (m === 'All') { selectAllMonths(); return; }
    const found = rows.find(r => r.month === m);
    if(found){ selected = found; resetFiltersForMonthView(); }
  }

  // dates formatting
  const fmt = (iso) => new Date(iso).toLocaleDateString(undefined,{day:'numeric', month:'short', year:'numeric'});
  const dateRange = (a,b) => a===b ? fmt(a) : `${fmt(a)} – ${fmt(b)}`;

  // ======== Top-right filters ========
  let statusFilter = '';   // '', 'Approved', 'Pending', 'Rejected', 'Cancelled'
  let deptFilter = '';     // '', or department name
  let q = '';              // search Name/ID
  let monthFilter = 'All'; // 'All' or one of months (used in ALL view)

  // Unique departments (for dropdown)
  const allDepartments = Array.from(new Set(
    rows.flatMap(r => r.employees.map(e => e.department))
  )).sort();

  // Flatten all employees with their month for ALL view
  $: allCombined = rows.flatMap(r => r.employees.map(e => ({ ...e, _month: r.month })));

  function selectAllMonths(){
    selected = { month: 'All', employees: allCombined };
    monthFilter = 'All';
  }

  function onMonthFilterChange(value){
    if (!selected) return;
    if (value === 'All') { selectAllMonths(); return; }
    if (months.includes(value)) { jumpToMonth(value); }
  }

  function resetFiltersForMonthView(){
    monthFilter = selected?.month === 'All' ? 'All' : selected?.month || 'All';
    showAll = false;
  }

  // Apply filters to the selected list
  const applyFilters = (list=[]) => {
    let out = list;
    if (selected?.month === 'All' && monthFilter && monthFilter !== 'All') {
      out = out.filter(e => e._month === monthFilter);
    }
    if (statusFilter) {
      const s = statusFilter.toLowerCase();
      out = out.filter(e => (e.status || '').toLowerCase() === s);
    }
    if (deptFilter) out = out.filter(e => e.department === deptFilter);
    if (q.trim()) {
      const term = q.trim().toLowerCase();
      out = out.filter(e => e.name.toLowerCase().includes(term) || e.id.toLowerCase().includes(term));
    }
    return out;
  };

  // reactive derived lists
  $: filtered = selected ? applyFilters(selected.employees) : [];
  $: total = filtered.length;
</script>

<svelte:window on:keydown={handleKey}/>

<div class="page">

    <!-- Grid of month cards -->
    <div class="card-grid">
      {#each rows as row}
        <div class="month-card" on:click={() => onDetails(row)}>
          <h2>{row.month}</h2>
          <p>Number of Leave Applied</p>
          <div class="count">{count(row)}</div>
        </div>
      {/each}
    </div>
</div>


<!-- Modal -->
{#if showModal}
  <div class="modal">
    <div class="backdrop" on:click={closeModal}></div>
    <div class="dialog" role="dialog" aria-modal="true" aria-label="Leave details">
      <div class="dialog-head">
        <h3>{selected?.month} — Leave Details</h3>
        <button class="iconbtn" on:click={closeModal} aria-label="Close">✕</button>
      </div>

      <div class="dialog-body">
        <aside class="rail" aria-label="Month bookmarks">
          {#each railTabs as t}
            <button
              class="tab {selected?.month === t.value ? 'active' : ''}"
              style="--tab-bg: var(--primary);"
              title={t.value}
              on:click={() => jumpToMonth(t.value)}>
              <span class="tab-chip">{t.label}</span>
            </button>
          {/each}
        </aside>

        <section class="table-wrap">
          <div class="controls">
            <div class="spacer"></div>

            <label class="control">
              <span>Status</span>
              <select bind:value={statusFilter}>
                <option value="">All</option>
                <option>Approved</option>
                <option>Pending</option>
                <option>Rejected</option>
                <option>Cancelled</option>
              </select>
            </label>

            <label class="control">
              <span>Department</span>
              <select bind:value={deptFilter}>
                <option value="">All</option>
                {#each allDepartments as d}<option>{d}</option>{/each}
              </select>
            </label>

            <label class="control">
              <span>Name / ID</span>
              <input type="text" placeholder="Search…" bind:value={q} />
            </label>

            <label class="control">
              <span>Month</span>
              <select on:change={(e)=>onMonthFilterChange(e.target.value)} bind:value={monthFilter}>
                <option>All</option>
                {#each months as m}<option>{m}</option>{/each}
              </select>
            </label>
          </div>

          {#if selected && total > 0}
            <div class="table-meta">
              {#if selected.month === 'All' && monthFilter === 'All'}Showing: <b>All months</b>. {/if}
              {#if selected.month === 'All' && monthFilter !== 'All'}Month: <b>{monthFilter}</b>. {/if}
              {#if statusFilter}Status: <b>{statusFilter}</b>. {/if}
              {#if deptFilter}Dept: <b>{deptFilter}</b>. {/if}
              {#if q}Search: <b>{q}</b>. {/if}
              {#if !showAll && total > 10}
                Showing first 10 of {total}. <button class="linkbtn" on:click={() => showAll = true}>Show all</button>
              {:else if showAll && total > 10}
                Showing all {total}. <button class="linkbtn" on:click={() => showAll = false}>Show less</button>
              {/if}
            </div>

            <table class="table">
              <thead>
                <tr>
                  <th>No.</th>
                  {#if selected.month === 'All'}<th>Month</th>{/if}
                  <th>Staff ID</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Dates</th>
                  <th class="center">Total Days</th>
                  <th>Leave Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {#each (showAll ? filtered : filtered.slice(0, 10)) as emp, i}
                  <tr>
                    <td>{i + 1}</td>
                    {#if selected.month === 'All'}<td>{emp._month}</td>{/if}
                    <td>{emp.id}</td>
                    <td>{emp.name}</td>
                    <td>{emp.department}</td>
                    <td>{dateRange(emp.dateFrom, emp.dateTo)}</td>
                    <td class="center">{emp.totalDays}</td>
                    <td>{emp.leaveType}</td>
                    <td><span class="status {emp.status.toLowerCase()}">{emp.status}</span></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {:else}
            <div class="empty">
              {#if selected}
                No results for {selected.month}
                {#if statusFilter || deptFilter || q || (selected.month==='All' && monthFilter!=='All')} with current filters.{/if}
              {/if}
            </div>
          {/if}
        </section>
      </div>

      <div class="dialog-foot">
        <button class="btn" on:click={closeModal}>Close</button>
      </div>
    </div>
  </div>
{/if}

<style>
  :root{
    --primary:#49bdb3; --ink:#0c4a6e;
    --pop-out:14px; --tab-h:30px; --tab-gap:6px; --chip:18px; --chip-font:11px; --tab-radius:10px;
  }
  :global(html, body) {
    margin: 0;
    background: #0c4a6e;
    font-family: system-ui, sans-serif;
  }

 .page {
    padding: 1.5rem;
    max-width: 1500px;
    margin: auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .header-logo {
    font-family: "Bungee", cursive;
    font-size: 24px;
    color: #fff;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
  }

  /* ===== New Month Cards ===== */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
  }

  .month-card {
    background: #fff;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    text-align: center;
    box-shadow: 0 4px 10px rgba(0,0,0,0.08);

  }
  .month-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  }
  .month-card h2 {
    margin: 0 0 0.5rem;
    color: #0c4a6e;
    font-family:'Outfit', sans-serif;
    font-weight: 900;
    background: rgba(73, 189, 179, 0.15);
    padding: 8px 0;
    border-radius: 8px;
    text-transform: uppercase;

  }
  .month-card p {
    margin: 0 0 1rem;
    color: #475569;
    font-size: 0.9rem;
    font-weight: 500;
  }
  .month-card .count {
    font-size: 2.5rem;
    font-weight: bold;
    color: #49bdb3;
  }


  /* Button styles (for modal) */
  .btn{
    background:#e0f2fe; border:1px solid #e0f2fe;
    border-radius:8px; padding:6px 14px;
    font-weight:700; cursor:pointer; font-size:13px;
  }
  .btn:hover{ background:#f3f4f6; }

  /* ===== Modal ===== */
  .modal{ position:fixed; inset:0; z-index:50; display:grid; place-items:center; }
  .backdrop{ position:absolute; inset:0; background:rgba(0,0,0,.35); }
  .dialog{ position:relative; width:min(1100px, 94vw); max-height:82vh; background:#fff; border-radius:14px; box-shadow:0 10px 30px rgba(0,0,0,.2); display:flex; flex-direction:column; overflow:hidden; }
  .dialog-head{ display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid #eee; }
  .dialog-head h3{ margin:0; font-size:18px; color:#000; }
  .iconbtn{ background:transparent; border:none; font-size:18px; cursor:pointer; line-height:1; color:#476577; }
  .dialog-body{ display:grid; grid-template-columns:76px 1fr; gap:0; min-height:0; }

  /* Vertical numbered tabs */
  .rail{ display:flex; flex-direction:column; gap:var(--tab-gap); padding:10px 8px; border-right:1px solid #eef3f4; background:#f9fcfc; overflow-y:auto; overflow-x:visible; position:relative; }
  .tab{ position:relative; width:60px; height:var(--tab-h); border:none; background:transparent; cursor:pointer; display:flex; align-items:center; padding-left:16px; }
  .tab::before{ content:""; position:absolute; top:0; bottom:0; left:10px; right:0; background:var(--tab-bg); border-radius:var(--tab-radius); box-shadow:0 2px 4px rgba(0,0,0,.06); transition:right .18s ease, border-radius .18s ease, box-shadow .18s ease; }
  .tab-chip{ position:relative; z-index:1; min-width:var(--chip); height:var(--chip); padding:0 8px; border-radius:10px; background:#49bdb3; color:#fff; font-weight:900; font-size:var(--chip-font); display:grid; place-items:center; }
  .tab.active::before{ right:calc(-1 * var(--pop-out)); border-top-right-radius:calc(var(--tab-radius) + 6px); border-bottom-right-radius:calc(var(--tab-radius) + 6px); box-shadow:0 6px 14px rgba(0,0,0,.14); }
  .tab:focus-visible{ outline:2px solid #0ea5a5; outline-offset:2px; }

  /* Right side content */
  .table-wrap{ overflow:auto; padding:10px 16px 12px 16px; }
  .controls{ display:flex; align-items:end; gap:10px; margin-bottom:8px; }
  .controls .spacer{ flex:1; }
  .control{ display:flex; flex-direction:column; gap:4px; }
  .control span{ font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:#486474; font-weight:800; }
  .control select, .control input{ padding:6px 10px; border-radius:6px; border:1px solid #e3eef0; background:#fff; color:#0c4a6e; font-size:13px; min-width:150px; }
  .control input{ min-width:200px; }

  .table{ width:100%; border-collapse:separate; border-spacing:0; font-size:14px; }
  .table thead th{ position:sticky; top:0; background:#f6fbfb; text-align:left; padding:10px 12px; font-weight:700; color:#285a6d; border-bottom:1px solid #e5f2f1; }
  .table tbody td{ padding:10px 12px; border-bottom:1px solid #f0f4f7; color:#1b3342; vertical-align:middle; }
  .table tbody tr:hover td{ background:#fcfefe; }
  .table-meta{ font-size:12px; color:#4a6978; margin:6px 0 8px; }
  .linkbtn{ border:none; background:transparent; text-decoration:underline; cursor:pointer; font-weight:700; color:#0c4a6e; }

  .table th.center,
  .table td.center {
    text-align: center;
  }

  .status{ display:inline-block; padding:4px 8px; border-radius:999px; font-weight:700; font-size:12px; border:1px solid transparent; text-transform: capitalize; }
  .status.approved{ background:#e8f8f3; color:#116a51; border-color:#cbeee3; }
  .status.pending{  background:#fff8e7; color:#8a5b00; border-color:#f5e1b7; }
  .status.rejected{ background:#fdecec; color:#9b1c1c; border-color:#f3c2c2; }
  .status.cancelled{ background:#f1f5f9; color:#475569; border-color:#e2e8f0; }

  .empty{ padding:22px; color:#567; text-align:center; }
  .dialog-foot{ padding:12px 16px; border-top:1px solid #eee; display:flex; justify-content:flex-end; }

  @media(max-width:900px){
    .dialog-body{ grid-template-columns:1fr; }
    .rail{ flex-direction:row; gap:8px; padding:8px; border-right:none; border-bottom:1px solid #eef3f4; }
    .tab{ width:56px; height:28px; }
    .controls{ flex-wrap:wrap; }
    .control select, .control input{ min-width:140px; }
  }
  @media(max-width:560px){ .grid{ grid-template-columns:1fr; } }
</style>

