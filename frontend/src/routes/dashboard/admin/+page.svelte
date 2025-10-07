<script>
  import { onMount, tick } from 'svelte';
  export let data; // expects: { user, holidaysByYear, employeesOverview? }
 
  // ----- user/profile -----
  const user = data?.user ?? { name: 'admin', role: 'Human Resources', staffId: 'E8505' };
  const initials = (name) => (name || 'A B').split(' ').map(x => x[0]).slice(0,2).join('').toUpperCase();
  let profileMenuOpen = false;
  
  const holidaysByYear = data.holidaysByYear;

  function clickOutside(node) {
  const onClick = (e) => { if (!node.contains(e.target)) profileMenuOpen = false; };
  document.addEventListener('click', onClick);
  return { destroy: () => document.removeEventListener('click', onClick) };
}


  // ===== Department data for Overview + Chart =====
  // (Replace with your real data source as needed)
  const dataByDept = [
    { name: "Administrator",                count: 12, color: "#FCF9BE" },
    { name: "Operations Support",           count: 35, color: "#F2C6DE" },
    { name: "Technical Data",               count: 22, color: "#DBCDF0" },
    { name: "Operations – RTOC",            count: 18, color: "#C6DEF1" },
    { name: "Sales & Technical Excellence", count: 27, color: "#C9E4DE" },
    { name: "Director",                     count:  3, color: "#FFD9CC" }
  ];
  $: totalEmployees = dataByDept.reduce((a,b)=>a+b.count, 0);

  // ===== Chart.js (RIGHT panel) =====
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

  // ===== Calendar helpers =====
  const atStartOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const isoLocal = (d) => { // MYT-safe YYYY-MM-DD
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };
  let today = atStartOfDay(new Date());
  const todayISO = isoLocal(today);

  // Wider nav window so prev/next works nicely
 // Dynamic window based on holidaysByYear from layout
const years = data?.holidaysByYear ? Object.keys(data.holidaysByYear).map(Number) : [new Date().getFullYear()];
const minYear = Math.min(...years);
const maxYear = Math.max(...years);
const minDate = new Date(minYear, 0, 1);
const maxDate = new Date(maxYear, 11, 31);
const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const minMonthStart = monthStart(minDate);
const maxMonthStart = monthStart(maxDate);

  let viewBase = atStartOfDay(new Date());
  const canGoPrev = () => monthStart(viewBase) > minMonthStart;
  const canGoNext = () => monthStart(viewBase) < maxMonthStart;
  function clampToWindowMonth(d) {
    const ms = monthStart(d).getTime();
    if (ms < minMonthStart.getTime()) return new Date(minMonthStart);
    if (ms > maxMonthStart.getTime()) return new Date(maxMonthStart);
    return new Date(d);
  }
  viewBase = clampToWindowMonth(viewBase);

  let monthLabel = '';
  let days = [];

  // ===== WP Public Holidays — rolling 3-year window (current..+2) =====
let holidayWindowStart = new Date().getFullYear();
const HOLIDAY_WINDOW = 3; // years

// store both: dates (fast check) + names (tooltip)
const holidayDatesByYear = {};
const holidayNamesByYear = {};

if (data?.holidaysByYear) {
  for (const y in data.holidaysByYear) {
    const arr = data.holidaysByYear[y] ?? [];
    const yr = Number(y);
    holidayDatesByYear[yr] = new Set(arr.map(h => h.date));
    holidayNamesByYear[yr] = new Map(arr.map(h => [h.date, h.name || 'Public Holiday']));
  }
}
function setHolidayWindow(anchorYear) {
  holidayWindowStart = anchorYear;
  for (let y = holidayWindowStart; y < holidayWindowStart + HOLIDAY_WINDOW; y++) {
    if (!holidayDatesByYear[y]) holidayDatesByYear[y] = new Set();
    if (!holidayNamesByYear[y]) holidayNamesByYear[y] = new Map();
  }
}
function inHolidayWindow(y) {
  return y >= holidayWindowStart && y < holidayWindowStart + HOLIDAY_WINDOW;
}
setHolidayWindow(new Date().getFullYear());

const isHoliday = (d) => {
  const y = d.getFullYear();
  if (!inHolidayWindow(y)) return false;
  const iso = isoLocal(d);
  return holidayDatesByYear[y]?.has(iso) ?? false;
};


  function maybeSlideHolidayWindow(anchorYear) {
    if (!inHolidayWindow(anchorYear)) setHolidayWindow(anchorYear);
  }

  // ===== Additional Leave (create / edit / delete) =====
  const additionalByYear = {};
  const additionalMeta = new Map(); // ISO -> { name, desc }

  function isAdditional(d) {
    const y = d.getFullYear();
    if (!inHolidayWindow(y)) return false;
    const iso = isoLocal(d);
    return additionalByYear[y]?.has(iso) ?? false;
  }
  function addOrUpdateAdditional(iso, { name, desc }) {
    const y = Number(iso.slice(0,4));
    if (!inHolidayWindow(y)) return;
    if (!additionalByYear[y]) additionalByYear[y] = new Set();
    additionalByYear[y].add(iso);
    additionalMeta.set(iso, { name, desc });
  }
  function removeAdditional(iso) {
    const y = Number(iso.slice(0,4));
    additionalByYear[y]?.delete(iso);
    additionalMeta.delete(iso);
  }

  function buildMonth(base = new Date()) {
    const y = base.getFullYear(), m = base.getMonth();
    const first = new Date(y, m, 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7)); // Monday-start

    const arr = [];
 for (let i = 0; i < 42; i++) {
  const d = new Date(start);
  d.setDate(start.getDate() + i);
  const iso = isoLocal(d);
  const y2 = d.getFullYear();

  const isHol = isHoliday(d);                          // ✅ detect public holiday
  const addName = additionalMeta.get(iso)?.name || null;
  const phName  = holidayNamesByYear[y2]?.get(iso) || null;

  // ✅ Prevent adding Additional Leave on public holiday
  const isBlocked = isHol; // use this to disable button

  arr.push({
    key: iso,
    label: d.getDate(),
    date: d,
    muted: d.getMonth() !== m,
    today: iso === todayISO,
    holiday: isHol || isAdditional(d),
    outOfWindow: d < minDate || d > maxDate,
    blocked: isBlocked,                              // 🔹 NEW: mark non-clickable
    title: phName || addName || null                 // 🔹 prioritize public holiday name for tooltip
  });
    }
    monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(first);
    days = arr;
  }
  onMount(() => buildMonth(viewBase));

  // Nav
  function prevMonth() {
    if (!canGoPrev()) return;
    const d = new Date(viewBase); d.setMonth(d.getMonth() - 1, 1);
    maybeSlideHolidayWindow(d.getFullYear());
    viewBase = clampToWindowMonth(d); buildMonth(viewBase);
  }
  function nextMonth() {
    if (!canGoNext()) return;
    const d = new Date(viewBase); d.setMonth(d.getMonth() + 1, 1);
    maybeSlideHolidayWindow(d.getFullYear());
    viewBase = clampToWindowMonth(d); buildMonth(viewBase);
  }
  function prevYear() {
    if (!canGoPrev()) return;
    const d = new Date(viewBase); d.setFullYear(d.getFullYear() - 1, d.getMonth(), 1);
    maybeSlideHolidayWindow(d.getFullYear());
    viewBase = clampToWindowMonth(d); buildMonth(viewBase);
  }
  function nextYear() {
    if (!canGoNext()) return;
    const d = new Date(viewBase); d.setFullYear(d.getFullYear() + 1, d.getMonth(), 1);
    maybeSlideHolidayWindow(d.getFullYear());
    viewBase = clampToWindowMonth(d); buildMonth(viewBase);
  }
  function goToday() {
    const d = atStartOfDay(new Date());
    maybeSlideHolidayWindow(d.getFullYear());
    viewBase = clampToWindowMonth(d);
    buildMonth(viewBase);
  }

  // Modal state (Add/Edit/Delete)
  let addModal;           // dialog ref
  let addDateISO = '';
  let addName = '';
  let addDesc = '';
  let isEditing = false;

  async function openAdditionalForm(date) {
    const iso = isoLocal(atStartOfDay(date));
    addDateISO = iso;
    const existing = additionalMeta.get(iso);
    if (existing) {
      isEditing = true;
      addName = existing.name || '';
      addDesc = existing.desc || '';
    } else {
      isEditing = false;
      addName = '';
      addDesc = '';
    }
    if (!addModal?.open) addModal.showModal();
    await tick();
  }
  function submitAdditional(e) {
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    addOrUpdateAdditional(addDateISO, { name: addName.trim(), desc: addDesc.trim() });
    addModal?.close();
    buildMonth(viewBase);
  }
  function deleteAdditional() {
    removeAdditional(addDateISO);
    addModal?.close();
    buildMonth(viewBase);
  }
</script>

<main class="main">
  <div class="top-row">
    <a class="download" href="#">Download</a>
  </div>

  <div class="grid">
    <!-- TOP: Employees Overview (wider card, shows Total + per-dept counts) -->
    <div class="card overview-wide" style="grid-column: span 12;">
      <h3>Employees Overview</h3>
      <div class="mini-metrics">
        <!-- Total first -->
        <div class="mini">
  <div class="mini-val">{totalEmployees}</div>
  <div class="mini-label">
    <span class="dot" style="background:#49bdb3"></span> Total Employees
  </div>
</div>


        <!-- Then each department -->
        {#each dataByDept as d (d.name)}
          <div class="mini">
            <div class="mini-val">{d.count}</div>
            <div class="mini-label">
              <span class="dot" style="background:{d.color}"></span>{d.name}
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- LEFT: Calendar (wider card than before) -->
    <div class="card" style="grid-column: span 5;">
      <h3>Calendar (Public & Additional Leave)</h3>
      <div class="calendar calendar-wide">
        <div class="month">
          <div class="nav">
            <button class="nav-btn" on:click={prevYear} aria-label="Previous year" disabled={!canGoPrev()}>«</button>
            <button class="nav-btn" on:click={prevMonth} aria-label="Previous month" disabled={!canGoPrev()}>‹</button>
          </div>

          <span aria-live="polite">{monthLabel}</span>

          <div class="nav">
            <button class="nav-btn" on:click={goToday} aria-label="Go to current month">Today</button>
            <button class="nav-btn" on:click={nextMonth} aria-label="Next month" disabled={!canGoNext()}>›</button>
            <button class="nav-btn" on:click={nextYear} aria-label="Next year" disabled={!canGoNext()}>»</button>
          </div>
        </div>

        <div class="weekdays">
          <div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div>
          <div>Fri</div><div>Sat</div><div>Sun</div>
        </div>

        <div class="days">
          {#each days as d (d.key)}
            <button
  class:muted={d.muted}
  class:today={d.today}
  class:holiday={d.holiday}
  class:out={d.outOfWindow}
  disabled={d.outOfWindow || d.blocked || (d.date < today && !d.today)}  
  on:click={() => !d.blocked && openAdditionalForm(d.date)}               
  aria-label={`Select ${d.date.toDateString()}`}
  title={d.title || (d.holiday ? 'Public/Additional Holiday' : '')}
>
              {d.label}
            </button>

          {/each}
        </div>

        <div class="legend small">
          <span><i class="swatch sw-blue"></i> Public / Additional leave</span>
          <span><i class="swatch sw-today"></i> Today</span>
        </div>
      </div>
    </div>

    <!-- RIGHT: Chart (smaller & pushed down a bit) -->
    <div class="card" style="grid-column: span 7;">
      <h3>Total Active Employees</h3>
      <div class="chart-box">
  <canvas bind:this={canvasEl}></canvas>
      </div>
    </div>
</main>

<!-- Additional Leave Modal (Add/Edit/Delete) -->
<dialog bind:this={addModal} class="leave-modal" aria-labelledby="add-title">
  <form method="dialog" class="leave-form" on:submit|preventDefault={submitAdditional}>
    <button type="button" class="close-btn" on:click={() => addModal.close()} aria-label="Close">✕</button>
    <h2 id="add-title" class="title">{isEditing ? 'Edit Additional Leave' : 'Add Additional Leave'}</h2>

    <label>
      <span>Date</span>
      <input type="text" value={addDateISO} readonly />
    </label>

    <label>
      <span>Leave Name</span>
      <input type="text" name="name" bind:value={addName} />
    </label>

    <label>
      <span>Description</span>
      <textarea name="desc" rows="3" bind:value={addDesc} />
    </label>

    <div class="row-actions">
      <button type="submit" class="submit-btn">{isEditing ? 'Save' : 'Add'}</button>
      {#if isEditing}
        <button type="button" class="danger-btn" on:click={deleteAdditional}>Delete</button>
      {/if}
    </div>
  </form>
</dialog>

<style>
  :root{ --ring:#e5e7eb; --shadow:0 4px 12px rgba(0,0,0,.06); }
  .main { padding: 18px; }

  .top-row{ display:flex; justify-content:flex-end; align-items:center; margin: 8px 0 6px; }
  .download{ color:#fff; text-decoration: underline; font-size:14px; }
  .download:hover{ opacity:.85; }

  .grid{ margin-top:6px; display:grid; gap:10px; grid-template-columns:repeat(12, minmax(0,1fr)); }
  .card{ background:#fff; border:1px solid var(--ring); border-radius:12px; padding:14px; box-shadow:var(--shadow); }
  h3{ margin:0 0 8px 0; }

  /* ===== Employees Overview (wide) ===== */
  .overview-wide { max-width: 100%; margin: 0; }
.mini-metrics {
  display: grid;
  grid-template-columns: repeat(7, 0.5fr); /* 6 equal boxes, one row */
  gap: 10px;                             /* slightly closer spacing */
  align-items: stretch;
}


.mini {
  border: 1px solid var(--ring);
  background: #f9fafb;
  border-radius: 10px;
  padding: 8px;                          /* reduced padding */
  text-align: center;
  height: 75px;                          /* 🔹 smaller height */
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: all 0.2s ease;
}

.mini-val {
  font-size: 18px;                       /* slightly smaller font */
  font-weight: 800;
  color: #0f172a;
  line-height: 1.1;
}
 
.mini-label {
  font-size: 11px;                       /* smaller label text */
  color: #0c4a6e;
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 5px;
  justify-content: center;
}

.dot {
  width: 8px;                            /* smaller dot */
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

  /* ===== Calendar (wider internal width) ===== */
  .calendar-wide { max-width: 400px; margin: 0 auto; }  /* wider than before */
  .calendar-wide .days button{ padding:10px; }

  .calendar .month{
    display:flex; align-items:center; justify-content:space-between;
    font-weight:700; margin-bottom:6px; gap:6px;
  }
  .calendar .month > span { text-align:center; min-width:160px; font-size:13px; }
  .calendar .month .nav{ display:flex; gap:6px; flex-wrap:wrap; }
  .calendar .month .nav-btn{
    border:none; background:#eef2ff; padding:5px 9px; border-radius:8px; cursor:pointer;
    font-weight:700; line-height:1; font-size:12px;
  }
  .calendar .month .nav-btn:hover{ background:#e5e7eb; }
  .nav-btn:disabled{ opacity:.5; cursor:not-allowed; }

  .weekdays{ display:grid; grid-template-columns:repeat(7,1fr); gap:4px; font-size:11.5px; color:#6b7280; margin-bottom:4px; }
  .days{ display:grid; grid-template-columns:repeat(7,1fr); gap:4px; }
  .days button{
    border:1px solid var(--ring); border-radius:8px; background:#fff; cursor:pointer; font-size:12px;
  }
  .days button.today { border: 2px solid #49bdb3; font-weight: 700; color: #111827; background: #ffff; }
  .days button.muted{ opacity:.5; }
  .days button:disabled{ background:#f3f4f6; color:#9ca3af; cursor:not-allowed; }

  /* Public + Additional leave (same blue) */
 /* Public + Additional leave (same blue) */
.days button.holiday {
  background: #71c0f5;
  border-color: #71c0f5;
  color: #fff;                 /* better contrast */
}
.days button.today.holiday {
  background: #71c0f5;
  color: #fff;
}

/* legend swatch should match */
.sw-blue{ background:#71c0f5; border:1px solid #71c0f5; }

  .days button.out { background: #f9fafb; color: #9ca3af; border-color: #e5e7eb; cursor: not-allowed; opacity: .75; }

  .legend.small{
    display:flex; justify-content:center; gap:14px; margin-top:8px; font-size:11.5px; color:#6b7280;
  }
  .swatch{ display:inline-block; width:14px; height:9px; border-radius:3px; margin-right:6px; vertical-align:middle; }
  .sw-today{ background:#fff; border:1px solid #49bdb3; }

  /* ===== Chart tweaks ===== */
.chart-box {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400px;      /* equals canvas max-height for perfect center */
  margin-top: 75px;   /* gentle push down under the title */
  width: 650px;
}
.chart-box canvas {
  max-height: 500px;
  width: 100%;
}



  /* ===== Modal / buttons ===== */
  .leave-modal .title{ margin-bottom:8px; }
  .leave-form label{ display:grid; gap:6px; margin:8px 0; }
  .leave-form input[readonly]{ background:#f3f4f6; color:#6b7280; cursor:not-allowed; }
  .row-actions{ display:flex; gap:8px; align-items:center; margin-top:8px; }
  .submit-btn{ background:#49bdb3; color:#fff; border:none; border-radius:8px; padding:9px 12px; cursor:pointer; font-weight:700; }
  .submit-btn:hover{ opacity:.9; }
  .danger-btn{ background:#fff; color:#000; border:1px solid #e5e7eb; border-radius:8px; padding:9px 12px; cursor:pointer; font-weight:700; }
  .danger-btn:hover{ opacity:.92; }
  .close-btn{ position:absolute; right:10px; top:8px; border:none; background:transparent; font-size:16px; cursor:pointer; }
</style>
