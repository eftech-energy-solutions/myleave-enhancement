<script>
  export let data;
  const user = data?.user;
  import { onMount } from 'svelte';
  import { tick } from "svelte";
  import Chart from "chart.js/auto";

  let profileMenuOpen = false;

  function clickOutside(node) {
    const onClick = (e) => { if (!node.contains(e.target)) profileMenuOpen = false; };
    document.addEventListener('click', onClick);
    return { destroy: () => document.removeEventListener('click', onClick) };
  }

  // donuts — keep
  const donuts = [
    { title: 'Staff Annual Leave Summary', spent: 1, total: 14 },
    { title: 'Staff Medical Leave Summary', spent: 0, total: 14 },
    { title: 'Staff Hospitalization Leave Summary', spent: 0, total: 60 }
  ];
  const pct = (s, t) => (t > 0 ? Math.round((s/t)*100) : 0);

  // ======= Employees Overview State =======
  let loading = true;
  let error = "";
  let dataByDept = [];
  let totalEmployees = 0;
  let canvasEl;

  const palette = [
    "#FFD9CC", "#C6DEF1", "#F2C6DE",
    "#C9E4DE", "#DBCDF0", "#E2F0CB"
  ];

  // ===== FETCH DEPT DATA + RENDER CHART =====
  onMount(async () => {
    try {
      const res = await fetch("http://localhost:5000/api/employee/department-summary");
      if (!res.ok) throw new Error("Failed to load");

      const json = await res.json();

      // fill your array (same as admin)
      dataByDept = json.departments.map((d, i) => ({
        name: d.name,
        count: d.count,
        color: palette[i % palette.length]
      }));

      // calculate totals
      totalEmployees = dataByDept.reduce((a,b)=>a+b.count, 0);

      // now draw chart
      await tick();
      if (canvasEl) {
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
            responsive:true,
            maintainAspectRatio:false,
            plugins:{ legend:{ display:false }},
            scales:{
              x:{ ticks:{ autoSkip:false, maxRotation:40, minRotation:0 }},
              y:{ beginAtZero:true }
            }
          }
        });
      }

      loading = false;

    } catch (err) {
      console.error(err);
      error = "Failed to load employee overview";
      loading = false;
    }
  });
</script>

<main class="main">

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
  .stats{ display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:10px; margin-top:8px; } /*grid employee overview*/
  @media (max-width:980px){ .stats{ grid-template-columns: repeat(2, minmax(0,1fr)); } }
  @media (max-width:580px){ .stats{ grid-template-columns: 1fr; } }
  .stat{ background:#f9fafb; border:1px solid var(--ring); border-radius:12px; padding:14px; display:grid; gap:4px; }
  .stat .label{ color:#6b7280; font-size:12px; display:flex; align-items:center; gap:8px; }
  .stat .value{ font-size:28px; font-weight:800; color:#111827; line-height:1; }
  .dot{ width:10px; height:10px; border-radius:999px; display:inline-block; }
  .numbers-link{ display:inline-block; margin-top:10px; font-weight:600; color:#2563eb; text-decoration:none; }
  .numbers-link:hover{ text-decoration:underline; }
</style>