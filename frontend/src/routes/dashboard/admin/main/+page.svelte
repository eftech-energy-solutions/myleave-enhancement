<script>
  import { onMount } from "svelte";
  import AdminSidebar from '$lib/components/AdminSidebar.svelte';

  export let data; // expects { user, donuts, recent }

  const dataByDept = [
    { name: "Administrator", count: 12, color: "#7c3aed" },
    { name: "Operations Support", count: 35, color: "#22c55e" },
    { name: "Technical Data", count: 22, color: "#f59e0b" },
    { name: "Operations – RTOC", count: 18, color: "#3b82f6" },
    { name: "Sales & Technical Excellence", count: 27, color: "#ef4444" },
    { name: "Director", count: 3, color: "#14b8a6" }
  ];

  // total employees across departments
  $: total = dataByDept.reduce((a, b) => a + b.count, 0);

  let canvasEl;

  onMount(async () => {
    const Chart = (await import("chart.js/auto")).default;
    if (!canvasEl) return;

    new Chart(canvasEl, {
      type: "bar",
      data: {
        labels: dataByDept.map(d => d.name),
        datasets: [{
          label: "Active Employees",
          data: dataByDept.map(d => d.count),
          backgroundColor: dataByDept.map(d => d.color),
          borderColor: dataByDept.map(d => d.color),
          borderWidth: 1,
          borderRadius: 8
        }]
      },
      options: {
        indexAxis: 'x',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 0 } },
          y: { beginAtZero: true }
        }
      }
    });
  });
</script>

<!-- PAGE CONTENT -->
<!-- HEADER -->
<section class="header">
  <div>
    <div class="hello">Welcome back, {data.user.name}!</div>
    <h1>Dashboard</h1>
  </div>

  <div class="profile">
    <div class="badge">🔔</div>
    <div class="avatar">{data.user.name.at(0)}</div>
    <div class="info">
      <div style="font-weight:700">{data.user.name}</div>
      <div style="font-size:12px; opacity:.95">{data.user.role}</div>
      <div style="font-size:11px; opacity:.85">#{data.user.id}</div>
    </div>
    <a class="download" href="#">Download</a>
  </div>
</section>

<!-- GRID: 3 Donut charts + Employees chart -->
<div class="grid" style="grid-template-rows:auto auto; align-items:start">
  {#each data.donuts as d (d.title)}
    <div class="card" style="grid-column: span 4">
      <h3>{d.title}</h3>
      <div class="legend">
        <span><span class="chip" style="background:#0ea5e9"></span>Spent Leave</span>
        <span><span class="chip" style="background:#e5e7eb"></span>Unspent Leave</span>
      </div>
      <div class="donut" style="--spent: {(100*d.spent/d.total).toFixed(6)}"></div>
      <div class="total">Total spent {d.spent}/{d.total}</div>
    </div>
  {/each}

  <div class="card" style="grid-column: span 6">
    <h3>Total Active Employees</h3>
    <div style="height: 360px;">
      <canvas bind:this={canvasEl}></canvas>
    </div>
  </div>
</div>

<style>
.legend { display:flex; gap:1rem; align-items:center; font-size:13px; color:#374151; }
.chip { width:12px; height:12px; border-radius:999px; display:inline-block; margin-right:.35rem; }
.chip:first-child { background:#0ea5e9; }
.chip:last-child { background:#e5e7eb; }

.donut {
  --size: 160px;
  --track: #e5e7eb;
  --fill: #0ea5e9;
  width: var(--size);
  height: var(--size);
  margin: .25rem auto .75rem;
  border-radius: 50%;
  background: conic-gradient(var(--fill) calc(var(--spent) * 1%), var(--track) 0);
  position: relative;
}
.donut::after {
  content: "";
  position: absolute; inset: 12%;
  background: #fff; border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,.03);
}
.total { text-align:center; color:#6b7280; font-size:13px; }

</style>