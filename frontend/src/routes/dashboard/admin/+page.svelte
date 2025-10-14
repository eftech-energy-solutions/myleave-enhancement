<script>
  import { onMount, tick } from 'svelte';
  export let data; // expects: { user, holidaysByYear, employeesOverview? }

  // ===================================
  // 1. COMPONENT STATE & PROPS
  // ===================================
  const user = data?.user ?? { name: 'admin', role: 'Human Resources', staffId: 'E8505' };
  const holidaysByYear = data.holidaysByYear;
  let canvasEl; // For Chart.js
  let addModal; // For the dialog element

  // ===================================
  // 2. UI DATA (CHARTS, OVERVIEW)
  // ===================================
  const dataByDept = [
    { name: "Director",                     count:  3, color: "#FFD9CC" },
    { name: "Administrator",                count: 12, color: "#FCF9BE" },
    { name: "Operations",                   count: 18, color: "#C6DEF1" },
    { name: "Operations Support",           count: 35, color: "#F2C6DE" },
    { name: "Sales & Technical Excellence", count: 27, color: "#C9E4DE" },
    { name: "Technical Data",               count: 22, color: "#DBCDF0" }
  ];
  $: totalEmployees = dataByDept.reduce((a,b)=>a+b.count, 0);

  // ===================================
  // 3. CALENDAR LOGIC
  // ===================================

  // --- Date Helpers ---
  const atStartOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const isoLocal = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };
  let today = atStartOfDay(new Date());
  const todayISO = isoLocal(today);

  // --- Calendar View & Navigation ---
  const years = data?.holidaysByYear ? Object.keys(data.holidaysByYear).map(Number) : [new Date().getFullYear()];
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const minDate = new Date(minYear, 0, 1);
  const maxDate = new Date(maxYear, 11, 31);
  const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  const minMonthStart = monthStart(minDate);
  const maxMonthStart = monthStart(maxDate);

  let viewBase = clampToWindowMonth(atStartOfDay(new Date()));
  let monthLabel = '';
  let days = [];

  const canGoPrev = () => monthStart(viewBase) > minMonthStart;
  const canGoNext = () => monthStart(viewBase) < maxMonthStart;
  
  function clampToWindowMonth(d) {
    const ms = monthStart(d).getTime();
    if (ms < minMonthStart.getTime()) return new Date(minMonthStart);
    if (ms > maxMonthStart.getTime()) return new Date(maxMonthStart);
    return new Date(d);
  }

  function prevMonth() { if (canGoPrev()) { const d = new Date(viewBase); d.setMonth(d.getMonth() - 1, 1); viewBase = clampToWindowMonth(d); buildMonth(viewBase); } }
  function nextMonth() { if (canGoNext()) { const d = new Date(viewBase); d.setMonth(d.getMonth() + 1, 1); viewBase = clampToWindowMonth(d); buildMonth(viewBase); } }
  function prevYear() { if (canGoPrev()) { const d = new Date(viewBase); d.setFullYear(d.getFullYear() - 1); viewBase = clampToWindowMonth(d); buildMonth(viewBase); } }
  function nextYear() { if (canGoNext()) { const d = new Date(viewBase); d.setFullYear(d.getFullYear() + 1); viewBase = clampToWindowMonth(d); buildMonth(viewBase); } }
  function goToday() { viewBase = clampToWindowMonth(atStartOfDay(new Date())); buildMonth(viewBase); }

  // --- Holiday Data Management ---
  const holidayDatesByYear = {};
  const holidayNamesByYear = {};
  if (data?.holidaysByYear) {
    for (const y in data.holidaysByYear) {
      const arr = data.holidaysByYear[y] ?? [];
      holidayDatesByYear[y] = new Set(arr.map(h => h.date));
      holidayNamesByYear[y] = new Map(arr.map(h => [h.date, h.name || 'Public Holiday']));
    }
  }
  const isHoliday = (d) => holidayDatesByYear[d.getFullYear()]?.has(isoLocal(d)) ?? false;

  // --- Additional Leave Data Management ---
  const additionalMeta = new Map(); // ISO -> { name, desc }
  const isAdditional = (d) => additionalMeta.has(isoLocal(d));
  
  function addOrUpdateAdditional(iso, { name, desc }) {
    additionalMeta.set(iso, { name, desc });
  }
  function removeAdditional(iso) {
    additionalMeta.delete(iso);
  }

  // --- Month Builder ---
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

      const isHol = isHoliday(d);
      const addName = additionalMeta.get(iso)?.name || null;
      const phName  = holidayNamesByYear[y2]?.get(iso) || null;

      arr.push({
        key: iso,
        label: d.getDate(),
        date: d,
        muted: d.getMonth() !== m,
        today: iso === todayISO,
        holiday: isHol || isAdditional(d),
        outOfWindow: d < minDate || d > maxDate,
        title: phName || addName || null
      });
    }
    monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(first);
    days = arr;
  }

  // ===================================
  // 4. MODAL LOGIC (ADD/EDIT/VIEW)
  // ===================================
  let addDateISO = '';
  let addName = '';
  let addDesc = '';
  let modalMode = 'add'; // 'add', 'edit', 'viewPublic'

  async function openFormForDate(date) {
    const iso = isoLocal(atStartOfDay(date));
    addDateISO = iso;
    const y = date.getFullYear();

    if (holidayDatesByYear[y]?.has(iso)) {
      modalMode = 'viewPublic';
      addName = holidayNamesByYear[y]?.get(iso) || 'Public Holiday';
      addDesc = 'This is a pre-defined public holiday.';
    } else if (additionalMeta.has(iso)) {
      modalMode = 'edit';
      const existing = additionalMeta.get(iso);
      addName = existing.name || '';
      addDesc = existing.desc || '';
    } else {
      modalMode = 'add';
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
  
  function deletePublicHoliday() {
    const y = Number(addDateISO.slice(0,4));
    if (holidayDatesByYear[y]) {
      holidayDatesByYear[y].delete(addDateISO);
      holidayNamesByYear[y].delete(addDateISO);
    }
    addModal?.close();
    buildMonth(viewBase);
  }

  // ===================================
  // 5. LIFECYCLE & INITIALIZATION
  // ===================================
  onMount(async () => {
    // Build initial calendar view
    buildMonth(viewBase);

    // Initialize Chart.js
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

<!-- ======================= -->
<!--      HTML / MARKUP      -->
<!-- ======================= -->
<main class="main">
  <!-- Top Bar -->
  <!-- Dashboard Grid -->
  <div class="grid">
    <!-- Employees Overview Card -->
    <div class="card overview-wide" style="grid-column: span 12;">
      <h3>Employees Overview</h3>
      <div class="mini-metrics">
        <div class="mini">
          <div class="mini-val">{totalEmployees}</div>
          <div class="mini-label">
            <span class="dot" style="background:#49bdb3"></span> Total Employees
          </div>
        </div>
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

    <!-- Calendar Card -->
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
              disabled={d.outOfWindow || (d.date < today && !d.today)}
              on:click={() => openFormForDate(d.date)}
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

    <!-- Chart Card -->
    <div class="card" style="grid-column: span 7;">
      <h3>Total Active Employees</h3>
      <div class="chart-box">
        <canvas bind:this={canvasEl}></canvas>
      </div>
    </div>
  </div>
</main>

<!-- Add/Edit/View Holiday Modal -->
<dialog bind:this={addModal} class="leave-modal" aria-labelledby="add-title">
  <form method="dialog" class="leave-form" on:submit|preventDefault={submitAdditional}>
    <button type="button" class="close-btn" on:click={() => addModal.close()} aria-label="Close">✕</button>
    <h2 id="add-title" class="title">
      {#if modalMode === 'viewPublic'}
        Public Holiday Details
      {:else if modalMode === 'edit'}
        Edit Additional Leave
      {:else}
        Add Additional Leave
      {/if}
    </h2>
    <label>
      <span>Date</span>
      <input type="text" value={addDateISO} readonly />
    </label>
    <label>
      <span>Leave Name</span>
      <input type="text" name="name" bind:value={addName} readonly={modalMode === 'viewPublic'} />
    </label>
    <label>
      <span>Description</span>
      <textarea name="desc" rows="3" bind:value={addDesc} readonly={modalMode === 'viewPublic'} />
    </label>
    <div class="row-actions">
      {#if modalMode !== 'viewPublic'}
        <button type="submit" class="submit-btn">{modalMode === 'edit' ? 'Save' : 'Add'}</button>
      {/if}
      {#if modalMode === 'edit' || modalMode === 'viewPublic'}
        <button 
          type="button" 
          class="danger-btn" 
          on:click={modalMode === 'viewPublic' ? deletePublicHoliday : deleteAdditional}>
          Delete
        </button>
      {/if}
    </div>
  </form>
</dialog>

<!-- ======================= -->
<!--         STYLES          -->
<!-- ======================= -->
<style>
  /* --- Global & Layout --- */
  :root{ --ring:#e5e7eb; --shadow:0 4px 12px rgba(0,0,0,.06); }
  .main { padding: 18px; }
  .top-row{ display:flex; justify-content:flex-end; align-items:center; margin: 8px 0 6px; }
  .grid{ margin-top:6px; display:grid; gap:10px; grid-template-columns:repeat(12, minmax(0,1fr)); }
  .card{ background:#fff; border:1px solid var(--ring); border-radius:12px; padding:14px; box-shadow:var(--shadow); }
  h3{ margin:0 0 8px 0; }

  /* --- Employees Overview Card --- */
  .overview-wide { max-width: 100%; margin: 0; }
  .mini-metrics { display: grid; grid-template-columns: repeat(7, 0.5fr); gap: 10px; align-items: stretch; }
  .mini { border: 1px solid var(--ring); background: #f9fafb; border-radius: 10px; padding: 8px; text-align: center; height: 75px; display: flex; flex-direction: column; justify-content: center; transition: all 0.2s ease; }
  .mini-val { font-size: 18px; font-weight: 800; color: #0f172a; line-height: 1.1; }
  .mini-label { font-size: 11px; color: #0c4a6e; margin-top: 2px; display: flex; align-items: center; gap: 5px; justify-content: center; }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }

  /* --- Calendar Styles --- */
  .calendar-wide { max-width: 400px; margin: 0 auto; }
  .calendar-wide .days button{ padding:10px; }
  .calendar .month{ display:flex; align-items:center; justify-content:space-between; font-weight:700; margin-bottom:6px; gap:6px; }
  .calendar .month > span { text-align:center; min-width:160px; font-size:16px; }
  .calendar .month .nav{ display:flex; gap:6px; flex-wrap:wrap; }
  .calendar .month .nav-btn{ border:none; background:#eef2ff; padding:5px 9px; border-radius:8px; cursor:pointer; font-weight:700; line-height:1; font-size:12px; }
  .calendar .month .nav-btn:hover{ background:#e5e7eb; }
  .nav-btn:disabled{ opacity:.5; cursor:not-allowed; }
  .weekdays{ display:grid; grid-template-columns:repeat(7,1fr); gap:4px; font-size:11.5px; color:#6b7280; margin-bottom:4px; }
  .days{ display:grid; grid-template-columns:repeat(7,1fr); gap:4px; }
  .days button{ border:1px solid var(--ring); border-radius:8px; background:#fff; cursor:pointer; font-size:12px; }
  .days button.today { border: 2px solid #49bdb3; font-weight: 700; color: #111827; background: #ffff; }
  .days button.muted{ opacity:.5; }
  .days button:disabled{ background:#f3f4f6; color:#9ca3af; cursor:not-allowed; }
  .days button.holiday { background: #71c0f5; border-color: #71c0f5; color: #fff; }
  .days button.today.holiday { background: #71c0f5; color: #fff; }
  .days button.out { background: #f9fafb; color: #9ca3af; border-color: #e5e7eb; cursor: not-allowed; opacity: .75; }
  .legend.small{ display:flex; justify-content:center; gap:14px; margin-top:8px; font-size:11.5px; color:#6b7280; }
  .swatch{ display:inline-block; width:14px; height:9px; border-radius:3px; margin-right:6px; vertical-align:middle; }
  .sw-today{ background:#fff; border:1px solid #49bdb3; }
  .sw-blue{ background:#71c0f5; border:1px solid #71c0f5; }

  /* --- Chart Styles --- */
  .chart-box { display: flex; justify-content: center; align-items: center; height: 400px; margin-top: 75px; width: 650px; }
  .chart-box canvas { max-height: 500px; width: 100%; }

  /* --- Modal Styles --- */
  .leave-modal .title{ margin-bottom:8px; }
  .leave-form label{ display:grid; gap:6px; margin:8px 0; }
  .leave-form input[readonly], .leave-form textarea[readonly]{ background:#f3f4f6; color:#6b7280; cursor:not-allowed; }
  .row-actions{ display:flex; gap:8px; align-items:center; margin-top:8px; }
  .submit-btn{ background:#49bdb3; color:#fff; border:none; border-radius:8px; padding:9px 12px; cursor:pointer; font-weight:700; }
  .submit-btn:hover{ opacity:.9; }
  .danger-btn{ background:#fff; color:#000; border:1px solid #e5e7eb; border-radius:8px; padding:9px 12px; cursor:pointer; font-weight:700; }
  .danger-btn:hover{ opacity:.92; }
  .close-btn{ position:absolute; right:10px; top:8px; border:none; background:transparent; font-size:16px; cursor:pointer; }
</style>

