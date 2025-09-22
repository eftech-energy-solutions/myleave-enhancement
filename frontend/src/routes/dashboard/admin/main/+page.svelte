<script>
  import { onMount } from 'svelte';
  export let data; // from +layout.server.js -> { user }

  // header expects these
  const user = data?.user ?? { name: 'Admin', role: 'admin', staffId: 'E8505' };
  let profileMenuOpen = false;

  function clickOutside(node) {
    const onClick = (e) => { if (!node.contains(e.target)) profileMenuOpen = false; };
    document.addEventListener('click', onClick);
    return { destroy: () => document.removeEventListener('click', onClick) };
  }

  // donuts
  const donuts = [
    { title: 'Annual Leave Summary',          spent: 1,  total: 14 },
    { title: 'Medical Leave Summary',         spent: 0,  total: 14 },
    { title: 'Hospitalization Leave Summary', spent: 0,  total: 60 }
  ];
  const pct = (s, t) => (t > 0 && isFinite(s/t)) ? Math.min(100, Math.max(0, Math.round((s/t)*100))) : 0;

  // employees (chart + numbers)
  const dataByDept = [
    { name: "Administrator",                count: 12, color: "#7c3aed" },
    { name: "Operations Support",           count: 35, color: "#22c55e" },
    { name: "Technical Data",               count: 22, color: "#f59e0b" },
    { name: "Operations – RTOC",            count: 18, color: "#3b82f6" },
    { name: "Sales & Technical Excellence", count: 27, color: "#ef4444" },
    { name: "Director",                     count:  3, color: "#14b8a6" }
  ];
  $: totalEmployees = dataByDept.reduce((a,b)=>a+b.count, 0);

  let canvasEl;
  onMount(async () => {
    const Chart = (await import('chart.js/auto')).default;
    if (!canvasEl) return;
    new Chart(canvasEl, {
      type: 'bar',
      data: {
        labels: dataByDept.map(d=>d.name),
        datasets: [{
          label: 'Active Employees',
          data: dataByDept.map(d=>d.count),
          backgroundColor: dataByDept.map(d=>d.color),
          borderColor: dataByDept.map(d=>d.color),
          borderWidth: 1,
          borderRadius: 8
        }]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:false }},
        scales:{
          x:{ ticks:{ autoSkip:false, maxRotation:40, minRotation:0 }},
          y:{ beginAtZero:true, precision:0 }
        }
      }
    });
  });
</script>

<main class="main">
  <!-- HEADER -->
  <div class="topbar">
    <div class="title-wrap">
      <div class="hello">Welcome back, {user?.name || 'admin'}!</div>
      <h1 class="page-title">Dashboard</h1>
    </div>

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

      <button
        class="icon-btn caret"
        aria-haspopup="menu"
        aria-expanded={profileMenuOpen}
        on:click={() => (profileMenuOpen = !profileMenuOpen)}
        aria-label="Open profile menu"
      >▾</button>

      {#if profileMenuOpen}
        <div class="menu" role="menu">
          <a role="menuitem" href="/dashboard/admin/profile">Update Profile</a>
        </div>
      {/if}
    </div>

    <!-- ✅ Download anchored bottom-right inside header -->
    <a class="download header-download" href="#">Download</a>
  </div>

  <!-- GRID -->
  <div class="grid">
    <!-- donuts -->
    {#each donuts as d}
      <div class="card" style="grid-column: span 4;">
        <h3 class="donut-title">{d.title}</h3>
        <div class="donut fancy"
          style="--size:110px; --spent:{pct(d.spent,d.total)}; --spent-color: var(--spentRed); --rest-color: var(--restBlue);">
        </div>
        <div class="legend-row">
          <div class="legend-item"><span class="chip spent"></span><span>Spent Leave</span></div>
          <div class="legend-item"><span class="chip unspent"></span><span>Unspent Leave</span></div>
        </div>
        <div class="total-line">Total spent: {d.spent}/{d.total}</div>
      </div>
    {/each}

    <!-- chart -->
    <div class="card" style="grid-column: span 6;">
      <h3>Total Active Employees</h3>
      <div style="height: 360px;">
        <canvas bind:this={canvasEl}></canvas>
      </div>
    </div>

    <!-- numbers -->
    <div class="card" style="grid-column: span 6;">
      <h3>Employees Overview</h3>
      <div class="stats">
        <div class="stat total-tile">
          <div class="label">Total Employees</div>
          <div class="value">{totalEmployees}</div>
        </div>
        {#each dataByDept as d (d.name)}
          <div class="stat">
            <div class="label"><span class="dot" style="background:{d.color}"></span>{d.name}</div>
            <div class="value">{d.count}</div>
          </div>
        {/each}
      </div>
      <a class="numbers-link" href="/dashboard/admin/employees">View employees</a>
    </div>
  </div>
</main>

<style>
  :root{ --ring:#e5e7eb; --shadow:0 4px 12px rgba(0,0,0,.06); }
  .main { padding: 18px; }

  /* header */
  .topbar{
    position: relative;            /* ⬅ anchor for absolute button */
    display:flex; align-items:flex-start; justify-content:space-between;
    gap:16px; margin-bottom:8px; padding-bottom: 18px; /* space above the button */
  }
  .title-wrap{ color:#fff; }
  .hello{ font-size:18px; font-weight:400; margin:4px 0 6px; opacity:.95; }
  .page-title{ margin:0; font-size:60px; line-height:.80; color:#fff; letter-spacing:.3px; }
  @media (max-width:740px){ .page-title{ font-size:40px; } }

  .profile{ position:relative; display:flex; align-items:center; gap:10px; }
  .icon-btn{ border:none; background:transparent; cursor:pointer; font-size:18px; line-height:1; padding:6px; border-radius:8px; color:#fff; }
  .icon-btn:hover{ background:rgba(255,255,255,.12); }
  .profile-info{ display:flex; align-items:center; gap:10px; color:#fff; }
  .avatar-img{ height:36px; width:36px; border-radius:9999px; display:block; box-shadow:0 0 0 2px rgba(255,255,255,.25); }
  .who .name{ font-size: 20px; font-weight:700; }
  .who .sub{ font-size:12px; opacity:.95; color:#fff; }
  .caret{ font-size:16px; color:#fff; }

  .profile .menu{
    position:absolute; right:0; top:calc(100% + 8px);
    background:#fff; border:1px solid var(--ring); border-radius:10px; box-shadow:var(--shadow);
    min-width:200px; padding:6px; z-index:30;
  }
  .profile .menu a{ display:block; padding:10px 12px; border-radius:8px; color:#111827; font-weight:600; text-decoration:none; }
  .profile .menu a:hover{ background:#f3f4f6; }

  /* download bottom-right of header */
  .download{ color:#fff; text-decoration: underline; font-size:14px; }
  .header-download{
    position:absolute; right: 12px; bottom: 8px; /* ⬅ like your screenshot */
  }
  .download:hover{ opacity:.85; }

  /* grid + cards */
  .grid{ margin-top:6px; display:grid; gap:10px; grid-template-columns:repeat(12, minmax(0,1fr)); }
  .card{ background:#fff; border:1px solid var(--ring); border-radius:12px; padding:14px; box-shadow:var(--shadow); }
  h3{ margin:0 0 8px 0; }

  /* donut */
  :global(:root){ --spentRed:#ef4444; --restBlue:#3b82f6; }
  .donut.fancy{
    height: var(--size, 110px); width: var(--size, 110px);
    border-radius:9999px; margin:6px auto 8px;
    background: conic-gradient(var(--spent-color, #ef4444) calc(var(--spent) * 1%), var(--rest-color, #3b82f6) 0);
    display:grid; place-items:center; box-shadow:var(--shadow); position: relative;
  }
  .donut.fancy::after{
    content:""; height:66%; width:66%; background:#fff; border-radius:9999px; box-shadow:inset 0 0 0 1px var(--ring);
  }
  .donut-title{ font-size:14px; font-weight:700; color:#374151; margin:0 0 6px; }
  .legend-row{ display:flex; gap:18px; justify-content:center; align-items:center; margin:6px 0 2px; font-size:12px; color:#6b7280; }
  .legend-item{ display:flex; align-items:center; gap:8px; }
  .chip{ display:inline-block; width:24px; height:8px; border-radius:4px; }
  .chip.spent{ background: var(--spentRed); }
  .chip.unspent{ background: var(--restBlue); }
  .total-line{ text-align:center; font-size:12px; color:#6b7280; margin-top:4px; }

  /* numbers panel */
  .stats{ display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:12px; margin-top:8px; }
  @media (max-width:980px){ .stats{ grid-template-columns: repeat(2, minmax(0,1fr)); } }
  @media (max-width:580px){ .stats{ grid-template-columns: 1fr; } }
  .stat{ background:#f9fafb; border:1px solid var(--ring); border-radius:12px; padding:14px; display:grid; gap:4px; }
  .stat .label{ color:#6b7280; font-size:12px; display:flex; align-items:center; gap:8px; }
  .stat .value{ font-size:28px; font-weight:800; color:#111827; line-height:1; }
  .dot{ width:10px; height:10px; border-radius:999px; display:inline-block; }
  .numbers-link{ display:inline-block; margin-top:10px; font-weight:600; color:#2563eb; text-decoration:none; }
  .numbers-link:hover{ text-decoration:underline; }
</style>
