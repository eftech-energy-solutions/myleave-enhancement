<script>
  export let data;
  const user = data?.user;
  import { onMount } from 'svelte';
  import { tick } from "svelte";
  import Chart from "chart.js/auto";
  import { apiFetch } from '$lib/api';
  import { PUBLIC_VITE_API_BASE } from '$env/static/public';
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
      canvas: null,
      instance: null
    },
    { 
      title: "Staff Medical Leave Summary",
      key: "medical",
      canvas: null,
      instance: null
    },
    { 
      title: "Staff Hospitalization Leave Summary",
      key: "hospital",
      canvas: null,
      instance: null
    }
  ];

  let staffLeaveData = {
    annual: { taken: [], remaining: [], carry: [] },
    medical: { taken: [], remaining: [], carry: [] },
    hospital: { taken: [], remaining: [], carry: [] }
  };

  let selectedDepartment = "All"; 
  let isDirectorManager = user?.role === "Manager" && user?.department === "Director";

  function filterByDept(list, dept) {
    if (dept === "All") return list;
    return list.filter(item => {
      const itemDepts = (item.department || "").split(",").map(d => d.trim());
      return itemDepts.includes(dept);
    });
  }

  $: filteredStaffLeaveData = {
    annual: {
      taken: filterByDept(staffLeaveData.annual.taken, selectedDepartment),
      remaining: filterByDept(staffLeaveData.annual.remaining, selectedDepartment),
      carry: filterByDept(staffLeaveData.annual.carry, selectedDepartment)
    },
    medical: {
      taken: filterByDept(staffLeaveData.medical.taken, selectedDepartment),
      remaining: filterByDept(staffLeaveData.medical.remaining, selectedDepartment)
    },
    hospital: {
      taken: filterByDept(staffLeaveData.hospital.taken, selectedDepartment),
      remaining: filterByDept(staffLeaveData.hospital.remaining, selectedDepartment)
    }
  };

  $: if (!loading && selectedDepartment) {
    updateCharts();
  }

  function updateCharts() {
    donuts.forEach(d => {
      if (d.instance) {
        d.instance.update();
      }
    });
  }

  function getKey(title) {
    if (title.includes("Annual")) return "annual";
    if (title.includes("Medical")) return "medical";
    if (title.includes("Hospital")) return "hospital";
  }

  function customTooltip(context) {
    let tooltip = document.getElementById("chart-tooltip");

    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "chart-tooltip";
      tooltip.style.position = "absolute";
      tooltip.style.background = "rgba(30,30,30,0.92)";
      tooltip.style.color = "#fff";
      tooltip.style.padding = "10px 12px";
      tooltip.style.borderRadius = "6px";
      tooltip.style.pointerEvents = "auto";
      tooltip.style.maxWidth = "260px";
      tooltip.style.zIndex = "9999999";
      tooltip.style.boxShadow = "0 4px 8px rgba(0,0,0,.25)";
      tooltip.style.whiteSpace = "normal";
      document.body.appendChild(tooltip);
    }

    const model = context.tooltip;

    if (!frozenTooltip && model.opacity === 0) {
      tooltip.style.opacity = 0;
      return;
    }

    if (!frozenTooltip) {
      const rect = context.chart.canvas.getBoundingClientRect();
      tooltip.style.left = rect.left + model.caretX + 12 + "px";
      tooltip.style.top  = rect.top  + model.caretY + 12 + "px";
    }

    let html = "";

    if (model.title?.length) {
      html += `
        <div style="font-weight:700; font-size:12px; margin-bottom:6px;">
          ${model.title[0]} (${selectedDepartment})
        </div>
      `;
    }

    if (model.body) {
      const lines = model.body.map(b => b.lines).flat();

      html += `
        <div id="tooltip-scroll" style="font-size:10px; line-height:1.25; max-height:140px; overflow-y: auto; overflow-x: hidden;">
          ${lines.join("<br>")}
        </div>
        <div style="margin-top:6px; font-size:9px; opacity:0.6; text-align:right; font-style:italic;">
          Click to freeze
        </div>
      `;
    }

    tooltip.innerHTML = html;

    if (!frozenTooltip) {
      const rect = context.chart.canvas.getBoundingClientRect();
      tooltip.style.left = rect.left + model.caretX + 12 + "px";
      tooltip.style.top  = rect.top  + model.caretY + 12 + "px";
    }

    tooltip.style.opacity = 1;
  }

  const pct = (s, t) => (t > 0 ? Math.round((s/t)*100) : 0);

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

  onMount(async () => {
    try {
      const res = await fetch(
        `${PUBLIC_VITE_API_BASE}/api/employee/department-summary`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load");

      const json = await res.json();

      dataByDept = json.departments.map((d, i) => ({
        name: d.name,
        count: d.count,
        color: palette[i % palette.length]
      }));

      dataByDept.sort((a, b) => {
        if (a.name === "Director") return -1;
        if (b.name === "Director") return 1;
        return 0;
      });

      totalEmployees = dataByDept.reduce((a,b)=>a+b.count, 0);

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

      const empRes = await fetch(
        `${PUBLIC_VITE_API_BASE}/api/employee`,
        { credentials: "include" }
      );
      const allEmployees = await empRes.json();

      const deptEmployees = allEmployees.filter(emp => {
        if (user?.role === "Manager" && user?.department === "Director") {
          return true; 
        }

        if (user?.role === "Manager") {
          const managerDepartments = (user.department || "")
            .split(",")
            .map(d => d.trim());

          const employeeDepartments = (emp.department || "")
            .split(",")
            .map(d => d.trim());

          return employeeDepartments.some(dep =>
            managerDepartments.includes(dep)
          );
        }

        return true;
      });

      const staffMap = {};
      const today = new Date();

      deptEmployees.forEach(emp => {
        const cfExpiry = emp.carry_forward_expiry ? new Date(emp.carry_forward_expiry) : null;
        const validCF = (cfExpiry && today > cfExpiry) ? 0 : Number(emp.carry_forward_balance ?? 0);

        const proratedAnnual = Number(emp.leave_entitlement_annual_prorated ?? 14);
        const proratedMedical = Number(emp.leave_entitlement_medical_prorated ?? 14);

        staffMap[emp.staff_id] = {
          name: emp.full_name,
          department: emp.department,
          annual_taken: 0,
          annual_entitlement: proratedAnnual,
          carry_forward: validCF,
          medical_taken: 0,
          medical_entitlement: proratedMedical,
          hospital_taken: 0,
          hospital_entitlement: 60
        };
      });

      const leaveRes = await fetch(
        `${PUBLIC_VITE_API_BASE}/api/leave-requests`,
        { credentials: "include" }
      );
      const allLeaveData = await leaveRes.json();

      const leaveData = allLeaveData.filter(r => {
        const emp = allEmployees.find(e => e.staff_id === r.staff_id);
        if (!emp) return false;

        const statusClean = String(r.status || "").toLowerCase().trim();
        const isValidStatus = ["approved", "pending", "cancellation_pending", "cancellation pending"].includes(statusClean);
        if (!isValidStatus) return false;

        if (user?.role === "Manager" && user?.department === "Director") {
          return true; 
        }

        if (user?.role === "Manager") {
          const managerDepartments = (user.department || "")
            .split(",")
            .map(d => d.trim());

          const employeeDepartments = (emp.department || "")
            .split(",")
            .map(d => d.trim());

          return employeeDepartments.some(dep =>
            managerDepartments.includes(dep)
          );
        }

        return true;
      });

      leaveData.forEach(r => {
        const id = r.staff_id;
        if (!staffMap[id]) return;

        const days = Number(r.total_days || 0);

        if (r.leave_type === "AL" || r.leave_type === "EL")
          staffMap[id].annual_taken += days;
        else if (r.leave_type === "MC")
          staffMap[id].medical_taken += days;
        else if (r.leave_type === "HOSP")
          staffMap[id].hospital_taken += days;
      });

      staffLeaveData = {
        annual: {
          taken: Object.values(staffMap).map(s => ({ name: s.name, days: s.annual_taken, department: s.department })),
          remaining: Object.values(staffMap).map(s => {
            const remaining = s.annual_entitlement + s.carry_forward - s.annual_taken;
            return { name: s.name, days: Math.max(0, remaining), department: s.department };
          }),
          carry: Object.values(staffMap).map(s => ({ name: s.name, days: s.carry_forward, department: s.department }))
        },
        medical: {
          taken: Object.values(staffMap).map(s => ({ name: s.name, days: s.medical_taken, department: s.department })),
          remaining: Object.values(staffMap).map(s => ({ name: s.name, days: Math.max(0, s.medical_entitlement - s.medical_taken), department: s.department }))
        },
        hospital: {
          taken: Object.values(staffMap).map(s => ({ name: s.name, days: s.hospital_taken, department: s.department })),
          remaining: Object.values(staffMap).map(s => ({ name: s.name, days: Math.max(0, s.hospital_entitlement - s.hospital_taken), department: s.department }))
        }
      };

      donuts.forEach(d => {
        const hasCarry = d.key === "annual";
        const labels = hasCarry
          ? ['Spent Leave', 'Balance Leave', 'Carry-forward Leave']
          : ['Spent Leave', 'Balance Leave'];

        const colors = hasCarry
          ? ['#ef4444', '#3b82f6', '#10b981']
          : ['#ef4444', '#3b82f6'];

        const values = hasCarry ? [1,1,1] : [1,1];

        d.instance = new Chart(d.canvas, {
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
            interaction: { intersect: false, mode: 'nearest' },
            layout: { padding: { right: 24 } },
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
                    if (ctx.label.includes('Spent')) slice = 'taken';
                    else if (ctx.label.includes('Balance')) slice = 'remaining';
                    else slice = 'carry';

                    const list = filteredStaffLeaveData[d.key][slice];
                    
                    return list.map(s => {
                      const days = Number(s.days);
                      const formatted = days % 1 === 0 ? days.toFixed(0) : days.toFixed(1);
                      return `${s.name}: ${formatted}`;
                    });
                  }
                }
              },
              legend: { display: false }
            }
          }
        });

        d.canvas.addEventListener("click", () => {
          frozenTooltip = !frozenTooltip;
        });

        document.addEventListener("click", (e) => {
          const tooltip = document.getElementById("chart-tooltip");
          if (!tooltip) return;
          if (tooltip.contains(e.target)) return;
          if (e.target.tagName === "CANVAS") return;

          frozenTooltip = false;
          tooltip.style.opacity = 0;
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
    body { overflow-y: hidden; }
  </style>
</svelte:head>

<main class="main">
  <div class="grid">
    {#each donuts as d}
      <div class="card donut-card" style="grid-column: span 4;">
        <div class="donut-card-header">
          <h3 class="donut-title">{d.title}</h3>
          
          {#if isDirectorManager}
            <select bind:value={selectedDepartment} class="inline-dept-select">
              <option value="All">All Depts</option>
              {#each dataByDept as dept}
                <option value={dept.name}>{dept.name}</option>
              {/each}
            </select>
          {/if}
        </div>

        <div class="donut-container">
          <canvas bind:this={d.canvas}></canvas>
        </div>

        <div class="legend-custom">
          <div class="legend-row-top">
            <div class="legend-item">
              <span class="chip" style="background:#ef4444"></span>
              <span>Spent Leave</span>
            </div>

            <div class="legend-item">
              <span class="chip" style="background:#3b82f6"></span>
              <span>Balance Leave</span>
            </div>
          </div>

          {#if d.key === "annual"}
            <div class="legend-row-bottom">
              <div class="legend-item">
                <span class="chip" style="background:#10b981"></span>
                <span>Carry-forward Leave</span>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/each}

    <div class="card employees-card" style="grid-column: span 6;">
      <h3 class="left-title">Total Active Employees</h3>
      <div class="chart-center">
        <div style="height: 320px; width: 550px;">
          <canvas bind:this={canvasEl}></canvas>
        </div>
      </div>
    </div>

    <div class="card employee-card" style="grid-column: span 6;">
      <h3>Employees Overview</h3>

      <div class="stats">
        <div class="stat total-tile">
          <div class="label">Total Employees</div>
          <div class="value">{totalEmployees}</div>
        </div>

        {#each dataByDept as d (d.name)}
          <div class="stat">
            <div class="label">
              <span class="dot" style="background: {d.color};"></span>
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
  </div>
</main>

<style>
  :root{ --ring:#e5e7eb; --shadow:0 4px 12px rgba(0,0,0,.06); }
  .main { padding: 18px; }
  canvas { cursor: pointer !important; }
  .grid{ margin-top:-35px; display:grid; gap:10px; grid-template-columns:repeat(12, minmax(0,1fr)); }
  .card{ background:#fff; border:1px solid var(--ring); border-radius:12px; padding:14px; box-shadow:var(--shadow); }
  h3{ margin:0 0 8px 0; }

  /* 🌟 Header Flex Styling inside Donut cards */
  .donut-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin-bottom: 2px;
  }
  .donut-title{ font-size:12px; font-weight:700; color:#374151; margin:0; }

  /* 🌟 Inline Compact Dropdown Input Select Box */
  .inline-dept-select {
    padding: 2px 6px;
    font-size: 10px;
    font-weight: 600;
    border-radius: 4px;
    border: 1px solid #d1d5db;
    background-color: #f9fafb;
    color: #374151;
    cursor: pointer;
    outline: none;
    max-width: 95px;
    height: 20px;
  }
  .inline-dept-select:focus {
    border-color: #2563eb;
  }

  :global(#tooltip-scroll) {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  :global(#tooltip-scroll::-webkit-scrollbar) {
    display: none;
  }

  .donut-container {
    width: 110px;
    height: 110px;
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 8px auto;
    transform: translate(10px, -6px);
  }
  .card.donut-card { padding: 8px 10px !important; }
  .donut-card { height: 180px; }

  .legend-custom {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    transform: translateY(-15px);
    margin-top: 0px;
  }

  .employee-card{ display:flex; flex-direction:column; height:430px; }
  .legend-row-top { display: flex; gap: 18px; }
  .legend-row-bottom { display: flex; justify-content: center; }
  .legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #6b7280; }
  .chip { width: 22px; height: 8px; border-radius: 4px; }
  .employees-card { display: flex; flex-direction: column; }
  .left-title { text-align: left; }
  .chart-center { display: flex; justify-content: center; width: 100%; margin-top: 6px; }

  .stats{
    scrollbar-width:none;
    -ms-overflow-style:none;
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:10px;
    flex:1;
    overflow-y:auto;
    max-height:340px;
    padding-right:4px;
  }
  .stats::-webkit-scrollbar{ display:none; }
  @media (max-width:980px){ .stats{ grid-template-columns: repeat(2, minmax(0,1fr)); } }
  @media (max-width:580px){ .stats{ grid-template-columns: 1fr; } }

  .stat{ background:#f9fafb; border:1px solid var(--ring); border-radius:12px; padding:20px; display:grid; gap:4px; }
  .stat .label{ color:#6b7280; font-size:12px; display:flex; align-items:center; gap:8px; }
  .stat .value{ font-size:25px; font-weight:800; color:#111827; line-height:1; }
  
  /* 🌟 Fixed: Added missing colon to separate css rule definitions */
  .dot{ width:10px; height:10px; border-radius: 999px; display:inline-block; }
  
  .numbers-link{
    margin-top:12px;
    align-self:center;
    transform: translateX(250px);
    font-weight:600;
    color:#2563eb;
    text-decoration:none;
  }
  .numbers-link:hover{ text-decoration:underline; }
</style>