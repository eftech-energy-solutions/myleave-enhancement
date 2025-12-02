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

let hoveredDonut = null;
let hoveredSlice = null;

const donuts = [
  { 
    title: "Staff Annual Leave Summary",
    key: "annual",
    canvas: null
  },
  { 
    title: "Staff Medical Leave Summary",
    key: "medical",
    canvas: null
  },
  { 
    title: "Staff Hospitalization Leave Summary",
    key: "hospital",
    canvas: null
  }
];

const staffLeaveData = {
  annual: {
    taken: [
      { name: "Alya", days: 3 },
      { name: "Azira", days: 4 },
      { name: "Nur", days: 7 }
    ],
    remaining: [
      { name: "Alya", days: 5 },
      { name: "Azira", days: 3 },
      { name: "Nur", days: 1 }
    ],
    carry: [
      { name: "Alya", days: 2 },
      { name: "Azira", days: 1 },
      { name: "Nur", days: 0 }
    ]
  },
  medical: {
    taken: [
      { name: "Alya", days: 1 },
      { name: "Azira", days: 0 },
      { name: "Nur", days: 3 }
    ],
    remaining: [
      { name: "Alya", days: 13 },
      { name: "Azira", days: 14 },
      { name: "Nur", days: 11 }
    ],
    carry: [
      { name: "Alya", days: 0 },
      { name: "Azira", days: 0 },
      { name: "Nur", days: 0 }
    ]
  },
  hospital: {
    taken: [
      { name: "Alya", days: 10 },
      { name: "Azira", days: 2 },
      { name: "Nur", days: 0 }
    ],
    remaining: [
      { name: "Alya", days: 50 },
      { name: "Azira", days: 58 },
      { name: "Nur", days: 60 }
    ],
    carry: [
      { name: "Alya", days: 7 },
      { name: "Azira", days: 5 },
      { name: "Nur", days: 0 }
    ]
  }
};

function getKey(title) {
  if (title.includes("Annual")) return "annual";
  if (title.includes("Medical")) return "medical";
  if (title.includes("Hospital")) return "hospital";
}

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

    dataByDept = json.departments.map((d, i) => ({
      name: d.name,
      count: d.count,
      color: palette[i % palette.length]
    }));

    totalEmployees = dataByDept.reduce((a,b)=>a+b.count, 0);

    await tick();

    // ✅ BAR CHART
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

    // ✅ DONUT CHARTS
    donuts.forEach(d => {
      const data = staffLeaveData[d.key];

      const totalTaken = data.taken.reduce((a,b)=>a+b.days,0);
      const totalRemaining = data.remaining.reduce((a,b)=>a+b.days,0);
      const totalCarry = data.carry.reduce((a,b)=>a+b.days,0);

      new Chart(d.canvas, {
        type: 'doughnut',
        data: {
          labels: ['Taken Leave', 'Remaining Leave', 'Carry-forward Leave'],
          datasets: [{
            data: [1, 1, 1],   // ✅ semua slice sama besar
            backgroundColor: ['#ef4444', '#3b82f6', '#10b981'],
            hoverOffset: 10,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          layout: {
            padding: { right: 24 }
          },
          plugins: {
            tooltip: {
              displayColors: false,
              callbacks: {
                title: (items) => items[0].label,
                label: (ctx) => {
                  const slice =
                    ctx.label.includes('Taken') ? 'taken' :
                    ctx.label.includes('Remaining') ? 'remaining' : 'carry';

                  const list = staffLeaveData[d.key][slice];
                  return list.map(s => `${s.name}: ${s.days}`);
                }
              }
            },
            legend: {
              display: false
            }
          }
        }
      });
    });

    loading = false;

  } catch (err) {
    console.error(err);
    error = "Failed to load employee overview";
    loading = false;
  }
});

</script>
<svelte:head>
  <style>
    body {
      overflow-y: hidden;
    }
  </style>
</svelte:head>
<main class="main">

<div class="grid">
 {#each donuts as d}
  <div class="card donut-card" style="grid-column: span 4;">
    <h3 class="donut-title">{d.title}</h3>

    <div class="donut-container">
  <canvas bind:this={d.canvas}></canvas>
    </div>
    <!-- ✅ CUSTOM INDICATOR BAWAH SETIAP DONUT -->
    <div class="legend-custom">
        <div class="legend-row-top">
          <div class="legend-item">
            <span class="chip" style="background:#ef4444"></span>
            <span>Taken Leave</span>
          </div>

          <div class="legend-item">
            <span class="chip" style="background:#3b82f6"></span>
            <span>Remaining Leave</span>
          </div>
        </div>

        <div class="legend-row-bottom">
          <div class="legend-item">
            <span class="chip" style="background:#10b981"></span>
            <span>Carry-forward Leave</span>
          </div>
        </div>
      </div>
  </div>
{/each}


    <!-- CHART -->
    <div class="card employees-card" style="grid-column: span 6;">
      <h3 class="left-title">Total Active Employees</h3>

      <div class="chart-center">
        <div style="height: 320px; width: 550px;">
          <canvas bind:this={canvasEl}></canvas>
        </div>
      </div>
    </div>


    <!-- EMPLOYEE NUMBERS -->
    <div class="card employee-card" style="grid-column: span 6;">
      <h3>Employees Overview</h3>
      <div class="stats-wrap"></div>
      <div class="stats">
        <div class="stat total-tile">
          <div class="label">Total Employees</div>
          <div class="value">{totalEmployees}</div>
        </div>

        {#each dataByDept as d (d.name)}
          <div class="stat">
            <div class="label">
              <span class="dot" style="background:{d.color}"></span>
              {d.name}
            </div>
            <div class="value">{d.count}</div>
          </div>
        {/each}
      </div>

      <a class="numbers-link" href="/dashboard/admin/employees">
        View employees
      </a>
    </div>
  </div>
</main>

<style>
  :root{ --ring:#e5e7eb; --shadow:0 4px 12px rgba(0,0,0,.06); }
  .main { padding: 18px; }

  /* grid + cards */
  .grid{ margin-top:-35px; display:grid; gap:10px; grid-template-columns:repeat(12, minmax(0,1fr)); }
  .card{ background:#fff; border:1px solid var(--ring); border-radius:12px; padding:14px; box-shadow:var(--shadow); }
  h3{ margin:0 0 8px 0; }

  /* donut */
  :global(:root){ --spentRed:#ef4444; --restBlue:#3b82f6; }

  .donut-title{ font-size:12px; font-weight:700; color:#374151; margin:0 0 6px; }
 .donut-container {
  width: 110px;
  height: 110px;
  margin: 6px auto 2px auto;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translateY(-10px);
  margin-left: 145px;
}
.card.donut-card {
  padding: 8px 10px !important;  /* smaller top/bottom */
}
.donut-card {
  height: 180px;   /* adjust this */
}

  .legend-custom {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  transform: translateY(-15px);
  margin-top: 0px;
}

.legend-row-top {
  display: flex;
  gap: 18px;
}

.legend-row-bottom {
  display: flex;
  justify-content: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #6b7280;
}

.chip {
  width: 22px;
  height: 8px;
  border-radius: 4px;
}
.employees-card {
  display: flex;
  flex-direction: column;
}

.left-title {
  text-align: left;     /* title kiri */
}

.chart-center {
  display: flex;
  justify-content: center;  /* center content horizontally */
  width: 100%;              /* ensure full spanning */
  margin-top: 6px;
}

  /* numbers panel */
  .stats{ display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:10px; margin-top:8px; height: 20px; } /*grid employee overview*/
  @media (max-width:980px){ .stats{ grid-template-columns: repeat(2, minmax(0,1fr)); } }
  @media (max-width:580px){ .stats{ grid-template-columns: 1fr; } }

  .stats-wrap {
  display: flex;
  flex-direction: column;
}
  .stat{ background:#f9fafb; border:1px solid var(--ring); border-radius:12px; padding:20px; display:grid; gap:4px; }
  .stat .label{ color:#6b7280; font-size:12px; display:flex; align-items:center; gap:8px; }
  .stat .value{ font-size:25px; font-weight:800; color:#111827; line-height:1; }
  .dot{ width:10px; height:10px; border-radius:999px; display:inline-block; }
  .numbers-link{ display:inline-block; margin-top:270px; font-weight:600; color:#2563eb; text-decoration:none;  margin-left: 463px; white-space: nowrap;  } /* RIGHT side */
  .numbers-link:hover{ text-decoration:underline; }


</style>