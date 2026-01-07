<script>
  export let data;
  const user = data?.user;
  import { onMount } from 'svelte';
  import { tick } from "svelte";
  import Chart from "chart.js/auto";
  const BASE_ANNUAL = 14;

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

let staffLeaveData = {
  annual: { taken: [], remaining: [], carry: [] },
  medical: { taken: [], remaining: [], carry: [] },
  hospital: { taken: [], remaining: [], carry: [] }
};


function getKey(title) {
  if (title.includes("Annual")) return "annual";
  if (title.includes("Medical")) return "medical";
  if (title.includes("Hospital")) return "hospital";
}

function customTooltip(context) {
  let tooltip = document.getElementById("chart-tooltip");

  // Create tooltip element kalau belum ada
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "chart-tooltip";
    tooltip.style.position = "absolute";
    tooltip.style.background = "rgba(30,30,30,0.92)";
    tooltip.style.color = "#fff";
    tooltip.style.padding = "10px 12px";
    tooltip.style.borderRadius = "6px";
    tooltip.style.pointerEvents = "auto";  // penting utk scroll & click
    tooltip.style.maxWidth = "260px";
    tooltip.style.zIndex = "9999999";
    tooltip.style.boxShadow = "0 4px 8px rgba(0,0,0,.25)";
    tooltip.style.whiteSpace = "normal";
    document.body.appendChild(tooltip);
  }

  const model = context.tooltip;

  // ==========================
  // HIDE tooltip bila mouse keluar
  // TAPI JANGAN hide kalau frozenTooltip = true
  // ==========================
  // HIDE tooltip hanya bila:
// 1. tak frozen
// 2. opacity = 0
if (!frozenTooltip && model.opacity === 0) {
  tooltip.style.opacity = 0;
  return;
}

// Kalau frozen → abaikan model.opacity
if (frozenTooltip) {
  // jangan hide, jangan reposition
} else {
  // normal: update position ikut hover
  const rect = context.chart.canvas.getBoundingClientRect();
  tooltip.style.left = rect.left + model.caretX + 12 + "px";
  tooltip.style.top  = rect.top  + model.caretY + 12 + "px";
}


  // ==========================
  // BINA CONTENT
  // ==========================
  let html = "";

  // TITLE — kekal besar
  if (model.title?.length) {
    html += `
      <div style="
        font-weight:700;
        font-size:12px;
        margin-bottom:6px;
      ">
        ${model.title[0]}
      </div>
    `;
  }

  // BODY — nama staff kecil + scrollable
  if (model.body) {
    const lines = model.body.map(b => b.lines).flat();

    html += `
  <div id="tooltip-scroll" style="
    font-size:10px;
    line-height:1.25;
    max-height:140px;
    overflow-y: auto;
    overflow-x: hidden;
  ">
    ${lines.join("<br>")}
  </div>

  <div style="
    margin-top:6px;
    font-size:9px;
    opacity:0.6;
    text-align:right;
    font-style:italic;
  ">
    Click to freeze
  </div>
`;
  }

  tooltip.innerHTML = html;

// ==========================
// POSITION TOOLTIP
// ==========================
if (!frozenTooltip) {
  const rect = context.chart.canvas.getBoundingClientRect();
  tooltip.style.left = rect.left + model.caretX + 12 + "px";
  tooltip.style.top  = rect.top  + model.caretY + 12 + "px";
}

tooltip.style.opacity = 1;

}

  const pct = (s, t) => (t > 0 ? Math.round((s/t)*100) : 0);

  // ======= Employees Overview State =======
  let loading = true;
  let error = "";
  let dataByDept = [];
  let totalEmployees = 0;
  let canvasEl;
  let frozenTooltip = false;

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

// ================= FETCH ALL STAFF (FILTER BY DEPARTMENT) =================
const empRes = await fetch("/api/employee");
const allEmployees = await empRes.json();

// 🔥 FILTER: Only employees in manager's department
const deptEmployees = allEmployees.filter(emp => {
  if (user?.role === "Manager" && user?.department === "Director") {
    // ✅ include ALL managers
    if (emp.role === "Manager") return true;

    // staff Director sahaja
    return emp.department === "Director";
  }

  return emp.department === user?.department;
});



const staffMap = {};
const today = new Date();

deptEmployees.forEach(emp => {
  // ✅ Check if CF expired (same logic as employee donut)
  const cfExpiry = emp.carry_forward_expiry ? new Date(emp.carry_forward_expiry) : null;
  const validCF = (cfExpiry && today > cfExpiry) ? 0 : (emp.carry_forward_balance ?? 0);

  staffMap[emp.staff_id] = {
    name: emp.full_name,
    department: emp.department,

    // Annual Leave
    annual_taken: 0,
    annual_entitlement: Number(emp.leave_entitlement_annual ?? 14),
    annual_original: Number(emp.leave_entitlement_annual_original ?? 14),
    carry_forward: validCF,  // ✅ Only valid CF
    carry_forward_raw: Number(emp.carry_forward_balance ?? 0),  // Raw value for tooltip

    // Medical Leave
    medical_taken: 0,
    medical_entitlement: Number(emp.leave_entitlement_medical ?? 14),

    // Hospital Leave
    hospital_taken: 0,
    hospital_entitlement: 60
  };
});

// ================= FETCH LEAVE DATA (FILTER BY DEPARTMENT) =================
const leaveRes = await fetch("/api/leave-requests?status=approved");
const allLeaveData = await leaveRes.json();

// 🔥 FILTER: Only leaves from manager's department
const leaveData = allLeaveData.filter(r => {
  const emp = allEmployees.find(e => e.staff_id === r.staff_id);
  if (!emp) return false;

  // 🔥 SPECIAL CASE: Manager department Director
  if (user?.role === "Manager" && user?.department === "Director") {
    // ✅ semua manager
    if (emp.role === "Manager") return true;

    // ✅ semua orang department Director
    return emp.department === "Director";
  }

  // 🔒 Manager biasa (KEKAL behaviour)
  return emp.department === user?.department;
});


// Merge leave summary into staff list
leaveData.forEach(r => {
  const id = r.staff_id;
  if (!staffMap[id]) return;

  const days = Number(r.total_days || 0);

  if (r.leave_type === "AL" || r.leave_type === "EL")
    staffMap[id].annual_taken += days;

  if (r.leave_type === "MC")
    staffMap[id].medical_taken += days;

  if (r.leave_type === "HOSP")
    staffMap[id].hospital_taken += days;
});

// ================= BUILD DONUT CHART DATA =================
staffLeaveData = {
  annual: {
    // ✅ TAKEN: Staff with approved leave
    taken: Object.values(staffMap)
      .filter(s => s.annual_taken > 0)
      .map(s => ({
        name: s.name,
        days: s.annual_taken,
        department: s.department
      })),

    // ✅ REMAINING: Current AL + Valid CF - Taken
    remaining: Object.values(staffMap)
    .map(s => {
      const al = Number(s.annual_entitlement);
      const cf = Number(s.carry_forward);
      const taken = Number(s.annual_taken);
      const remaining = al + cf - taken;
      
      return {
        name: s.name,
        days: Math.max(0, remaining),
        department: s.department
      };
    })
    .filter(s => s.days > 0),  // Only show if remaining > 0

    // ✅ CARRY FORWARD: Only valid (non-expired) CF
    carry: Object.values(staffMap)
      .filter(s => s.carry_forward > 0)
      .map(s => ({
        name: s.name,
        days: s.carry_forward,
        department: s.department
      }))
  },

  medical: {
    taken: Object.values(staffMap)
      .filter(s => s.medical_taken > 0)
      .map(s => ({
        name: s.name,
        days: s.medical_taken,
        department: s.department
      })),

    remaining: Object.values(staffMap)
      .map(s => ({
        name: s.name,
        days: Math.max(0, s.medical_entitlement - s.medical_taken),
        department: s.department
      }))
      .filter(s => s.days > 0),

    carry: []
  },

  hospital: {
    taken: Object.values(staffMap)
      .filter(s => s.hospital_taken > 0)
      .map(s => ({
        name: s.name,
        days: s.hospital_taken,
        department: s.department
      })),

    remaining: Object.values(staffMap)
      .map(s => ({
        name: s.name,
        days: Math.max(0, s.hospital_entitlement - s.hospital_taken),
        department: s.department
      }))
      .filter(s => s.days > 0),

    carry: []
  }
};
    }
// ✅ DONUT CHARTS
donuts.forEach(d => {
  const data = staffLeaveData[d.key];

  const hasCarry = d.key === "annual";
  const labels = hasCarry
    ? ['Taken Leave', 'Remaining Leave', 'Carry-forward Leave']
    : ['Taken Leave', 'Remaining Leave'];

  const colors = hasCarry
    ? ['#ef4444', '#3b82f6', '#10b981']
    : ['#ef4444', '#3b82f6'];

  const values = hasCarry ? [1,1,1] : [1,1];

  // ==========================
  // CHART
  // ==========================
  new Chart(d.canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        hoverOffset: 3,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      interaction: {
        intersect: false,
        mode: 'nearest'
      },
      layout: {
        padding: { right: 24 }
      },
      plugins: {
        tooltip: {
          enabled: false,
          external: customTooltip,
          displayColors: false,
          padding: 12,
          callbacks: {
          title: (items) => items[0].label,
          label: (ctx) => {
            let slice;
            if (ctx.label.includes('Taken')) slice = 'taken';
            else if (ctx.label.includes('Remaining')) slice = 'remaining';
            else slice = 'carry';

            const list = staffLeaveData[d.key][slice];
            
            // ✅ Format numbers to remove unnecessary decimals
            return list.map(s => {
              const days = Number(s.days);
              const formatted = days % 1 === 0 ? days.toFixed(0) : days.toFixed(1);
              return `${s.name}: ${formatted}`;
            });
          }
        }
        },
        legend: {
          display: false
        }
      }
    }
  });

  // ======================
  // CLICK UNTUK FREEZE TOOLTIP
  // ======================
  d.canvas.addEventListener("click", () => {
    frozenTooltip = !frozenTooltip;
  });

  // ======================
  // CLICK LUAR UNTUK UNFREEZE
  // ======================
  document.addEventListener("click", (e) => {
    const tooltip = document.getElementById("chart-tooltip");
    if (!tooltip) return;

    if (tooltip.contains(e.target)) return;
    if (e.target.tagName === "CANVAS") return;

    frozenTooltip = false;
    tooltip.style.opacity = 0;
  });

}); // END donuts.forEach

    loading = false;

  } catch (err) {
    console.error(err);
    error = "Failed to load employee overview";
    loading = false;
  }
})
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

        <div class="legend-custom">

          <!-- TAKEN + REMAINING -->
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

          <!-- CARRY ONLY IF ANNUAL -->
          {#if d.key === "annual"}
            <div class="legend-row-bottom">
              <div class="legend-item">
                <span class="chip" style="background:#10b981"></span>
                <span>Carry-forward Leave</span>
              </div>
            </div>
          {/if}

        </div> <!-- /.legend-custom -->

      </div> <!-- /.card donut-card -->
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

      <a class="numbers-link" href="/dashboard/manager/employees">
        View employees
      </a>
    </div>
  </div> <!-- END GRID -->
</main>

<style>
  :root{ --ring:#e5e7eb; --shadow:0 4px 12px rgba(0,0,0,.06); }
  .main { padding: 18px; }
  canvas {
  cursor: pointer !important;
}
  /* grid + cards */
  .grid{ margin-top:-35px; display:grid; gap:10px; grid-template-columns:repeat(12, minmax(0,1fr)); }
  .card{ background:#fff; border:1px solid var(--ring); border-radius:12px; padding:14px; box-shadow:var(--shadow); }
  h3{ margin:0 0 8px 0; }

  /* donut */
  :global(:root){ --spentRed:#ef4444; --restBlue:#3b82f6; }

  :global(#tooltip-scroll) {
  scrollbar-width: none;          /* Firefox */
  -ms-overflow-style: none;       /* IE/Edge lama */
}

:global(#tooltip-scroll::-webkit-scrollbar) {
  display: none;                  /* Chrome/Safari */
}

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
  overflow: visible !important;
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