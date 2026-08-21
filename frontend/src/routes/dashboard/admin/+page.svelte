<script>
 import { onMount, tick } from 'svelte';
 import { apiFetch } from '$lib/api';
 import { PUBLIC_VITE_API_BASE } from '$env/static/public';
  // export let data; // REMOVED: Will fetch its own holidays

  // ===================================
  // 1. COMPONENT STATE & PROPS
  // ===================================
  const user = { name: 'admin', role: 'Human Resources', staffId: 'E8505' };
  let holidaysByYear = {}; 
  let loading = true;
  let error = "";

  let canvasEl;
  let addModal;

  let holidayDatesByYear = {};
  let holidayNamesByYear = {};
  let holidayDescsByYear = {}; 
  let holidayIdsByISO = new Map();
  let holidaySourcesByISO = new Map(); 
  let holidayUIDsByISO = new Map(); 
  let editingId = null;
  let editDate = "";
  let editTitle = "";
  let editDescription = "";
  let dataByDept = [];
  let totalEmployees = 0;
  // 🟢 helper untuk Svelte binding (fix ternary bind:value)
  let toast = {
  show: false,
  type: "success",
  title: "",
  message: "",
  closing: false
};

function showToast(message, type = "success", title = "", duration = 3000) {
  toast = {
    show: true,
    type,
    title: title || type.charAt(0).toUpperCase() + type.slice(1),
    message,
    closing: false
  };

  setTimeout(() => {
    toast.closing = true;
    setTimeout(() => {
      toast.show = false;
      toast.closing = false;
    }, 300);
  }, duration);
}

  const palette = [
    "#0F9B8E", "#D97706", "#475569",
    "#14B8A6", "#F59E0B", "#94A3B8"
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

    totalEmployees = dataByDept.reduce((a,b) => a + b.count, 0);
    loading = false;

  } catch (err) {
    console.error(err);
    error = "Failed to load employee overview";
    loading = false;
  }
});
  $: totalEmployees = dataByDept.reduce((a,b)=>a+b.count, 0);

  const atStartOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const isoLocal = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };
  let today = atStartOfDay(new Date());
  const todayISO = isoLocal(today);

  let minDate = new Date(new Date().getFullYear(), 0, 1);
  let maxDate = new Date(new Date().getFullYear() + 3, 11, 31);
  const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  let minMonthStart = monthStart(minDate);
  let maxMonthStart = monthStart(maxDate);

  let viewBase = clampToWindowMonth(atStartOfDay(new Date()));
  let days = [];

  const canGoPrev = () => monthStart(viewBase) > minMonthStart;
  const canGoNext = () => {
  const next = new Date(viewBase);
  next.setMonth(next.getMonth() + 1);
  return monthStart(next) <= maxMonthStart;
};
  
const canGoPrevYear = () => {
  const prev = new Date(viewBase);
  prev.setFullYear(prev.getFullYear() - 1);
  return monthStart(prev) >= minMonthStart;
};

const canGoNextYear = () => {
  const next = new Date(viewBase);
  next.setFullYear(next.getFullYear() + 1);
  return monthStart(next) <= maxMonthStart;
};

  function clampToWindowMonth(d) {
    if (!d || !minMonthStart || !maxMonthStart || !minMonthStart.getTime() || !maxMonthStart.getTime()) {
      const fallbackYear = new Date().getFullYear();
      minMonthStart = new Date(fallbackYear, 0, 1);
      maxMonthStart = new Date(fallbackYear + 3, 11, 31);
      if (!d) d = new Date();
    }
    
    const ms = monthStart(d).getTime();
    if (ms < minMonthStart.getTime()) return new Date(minMonthStart);
    if (ms > maxMonthStart.getTime()) return new Date(maxMonthStart);
    return new Date(d);
  }

  function prevMonth() { if (canGoPrev()) { const d = new Date(viewBase); d.setMonth(d.getMonth() - 1, 1); viewBase = clampToWindowMonth(d); buildMonth(viewBase); } }
  function nextMonth() { if (canGoNext()) { const d = new Date(viewBase); d.setMonth(d.getMonth() + 1, 1); viewBase = clampToWindowMonth(d); buildMonth(viewBase); } }
  function prevYear() { if (canGoPrevYear()) { const d = new Date(viewBase); d.setFullYear(d.getFullYear() - 1); viewBase = clampToWindowMonth(d); buildMonth(viewBase); } }
  function nextYear() { if (canGoNextYear()) { const d = new Date(viewBase); d.setFullYear(d.getFullYear() + 1); viewBase = clampToWindowMonth(d); buildMonth(viewBase); } }
  function goToday() { viewBase = clampToWindowMonth(atStartOfDay(new Date())); buildMonth(viewBase); }

  const isHoliday = (d) => holidayDatesByYear[d.getFullYear()]?.has(isoLocal(d)) ?? false;
  
  function startEdit(h) {
    if (h.source === "official") {
      alert("Official holidays can’t be edited (you can hide them instead).");
      return;
    }
    editingId = h.id;
    editDate = h.date;
    editTitle = h.title;
    editDescription = h.description || "";
  }

  function cancelEdit() {
    editingId = null;
    editDate = "";
    editTitle = "";
    editDescription = "";
    modalMode = 'viewPublic';
  }

 async function saveEdit() {
  if (!editingId) return;
  if (!editDate || !editTitle) {
    showToast("Please fill in date and leave name.", "warning", "Missing Fields");
    return;
  }

  try {
    const res = await fetch(`${PUBLIC_VITE_API_BASE}/api/holidays/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        date: editDate,
        title: editTitle,
        description: editDescription
      })
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "Failed to update holiday");
    }

    // ✅ SUCCESS TOAST
    showToast(
      "Public holiday updated successfully.",
      "success",
      "Holiday Updated"
    );

    await loadHolidays();
    addModal?.close();
    cancelEdit();

  } catch (err) {
    console.error("❌ Edit holiday error:", err);

    // ❌ ERROR TOAST
    showToast(
      err.message || "Unable to update public holiday.",
      "error",
      "Update Failed"
    );
  }
}


  async function handleSubmit(e) {
  const form = e.currentTarget;
  if (!form.reportValidity()) return;

  if (modalMode === 'add') {
    await addHolidayAPI();
  } else if (modalMode === 'edit') {
    await saveEdit();
  }
}

  // --- Month Builder ---
  function buildMonth(base = new Date()) {
    if (!base) return;
    const y = base.getFullYear(), m = base.getMonth();
    const first = new Date(y, m, 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7)); // Monday-start

    const arr = [];
    for (let i = 0; i < 35; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = isoLocal(d);
      const y2 = d.getFullYear();

      const isHol = isHoliday(d);
      const phName  = holidayNamesByYear[y2]?.get(iso) || null;
      const phDesc = holidayDescsByYear[y2]?.get(iso) || null; // Ambil desc
      
      let title = phName;
      if (phName && phDesc) {
        title = `${phName} - ${phDesc}`; // Gabung untuk title hover
      }

      arr.push({
        key: iso,
        label: d.getDate(),
        date: d,
        muted: d.getMonth() !== m,
        today: iso === todayISO,
        holiday: isHol,
        outOfWindow: d < minDate || d > maxDate,
        title: title || (isHol ? 'Public Holiday' : null) // Guna title gabungan
      });
    }
    // monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(first); // DIBUANG
    days = arr;
  }

  // --- BARU: State untuk Dropdown Berasingan ---
  const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
  ];
  const staticMonthOptions = monthNames.map((label, index) => ({ value: index, label }));

  $: dynamicYearOptions = ((min, max) => {
      const years = [];
      if (!min || !max) return [new Date().getFullYear()]; // Fallback
      for (let y = min; y <= max; y++) {
          years.push(y);
      }
      return years;
  })(minDate.getFullYear(), maxDate.getFullYear());

  // Dapatkan state semasa dari viewBase
  $: selectedYear = viewBase ? viewBase.getFullYear() : new Date().getFullYear();
  $: selectedMonth = viewBase ? viewBase.getMonth() : new Date().getMonth();

  // Handler apabila dropdown berubah
  function onYearSelect(event) {
      const newYear = parseInt(event.target.value, 10);
      const newDate = new Date(newYear, selectedMonth, 1);
      viewBase = clampToWindowMonth(newDate);
      buildMonth(viewBase);
  }

  function onMonthSelect(event) {
      const newMonth = parseInt(event.target.value, 10);
      const newDate = new Date(selectedYear, newMonth, 1);
      viewBase = clampToWindowMonth(newDate);
      buildMonth(viewBase);
  }
  // --- Tamat State Dropdown ---

  // ===================================
  // 4. API & DATA LOGIC (NEW SECTION)
  // ===================================

  /**
   * Fetches all holidays, processes them, and rebuilds the calendar.
   */
  async function loadHolidays() {
  loading = true;
  error = "";

  try {
    const res = await fetch(
      `${PUBLIC_VITE_API_BASE}/api/holidays`,
      {
        credentials: "include"   // ✅ GET sahaja
      }
    );

    if (!res.ok) throw new Error("Failed to load holidays");

    const flatHolidays = await res.json();

    const byYear = {};
    for (const hol of flatHolidays) {
      const year = hol.date.slice(0, 4);
      if (!byYear[year]) byYear[year] = [];
      byYear[year].push({
        id: hol.id,
        date: hol.date,
        name: hol.title,
        description: hol.description || '',
        source: hol.source,
        uid: hol.uid
      });
    }

    holidaysByYear = byYear;
    processHolidayData();

    if (!viewBase) {
      viewBase = clampToWindowMonth(atStartOfDay(new Date()));
    }
    buildMonth(viewBase);

  } catch (e) {
    error = e.message || "Error loading holidays";
  } finally {
    loading = false;
  }
}

  /**
   * Processes the `holidaysByYear` object to build fast-lookup maps.
   */
  function processHolidayData() {
    const newHolidayDatesByYear = {};
    const newHolidayNamesByYear = {};
    const newHolidayDescsByYear = {};
    const newHolidayIdsByISO = new Map();
    const newHolidaySourcesByISO = new Map(); // BARU
    const newHolidayUIDsByISO = new Map(); // BARU
    
    // ⬇️ LOGIK BARU: TAHUN SEMASA + 3 TAHUN 
    const currentYear = new Date().getFullYear();
    const minYear = currentYear;
    const maxYear = currentYear + 3;
    
    minDate = new Date(minYear, 0, 1);
    maxDate = new Date(maxYear, 11, 31);
    minMonthStart = monthStart(minDate);
    maxMonthStart = monthStart(maxDate);
    // ⬆️ TAMAT LOGIK BARU

    for (const y in holidaysByYear) {
      // Hanya proses data dalam julat tahun kita
      if (parseInt(y, 10) < minYear || parseInt(y, 10) > maxYear) {
        continue;
      }
      
      const arr = holidaysByYear[y] ?? [];
      newHolidayDatesByYear[y] = new Set(arr.map(h => h.date));
      newHolidayNamesByYear[y] = new Map(arr.map(h => [h.date, h.name || 'Public Holiday']));
      newHolidayDescsByYear[y] = new Map(arr.map(h => [h.date, h.description || '']));
      
      // Dipecahkan untuk populasikan semua data
      arr.forEach(h => {
  newHolidayIdsByISO.set(h.date, h.id);
  newHolidaySourcesByISO.set(h.date, h.source);
  newHolidayUIDsByISO.set(h.date, h.uid);
});

    }
    
    holidayDatesByYear = newHolidayDatesByYear;
    holidayNamesByYear = newHolidayNamesByYear;
    holidayDescsByYear = newHolidayDescsByYear;
    holidayIdsByISO = newHolidayIdsByISO;
    holidaySourcesByISO = newHolidaySourcesByISO; // BARU
    holidayUIDsByISO = newHolidayUIDsByISO; // BARU
  }

  /**
   * ADDS a public holiday via API call.
   * Ini adalah fungsi 'addHoliday' dari skrip baru, digabungkan ke sini.
   */
  async function addHolidayAPI() {
  try {
    const res = await fetch(
      `${PUBLIC_VITE_API_BASE}/api/holidays`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: addDateISO,
          title: addName,
          description: addDesc
        })
      }
    );

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "Failed to add public holiday");
    }

    // 🔁 Recalculate leave
    await fetch(
        `${PUBLIC_VITE_API_BASE}/api/leave-requests/recalc-invalid`,
        {
          method: "POST",
          credentials: "include"
        }
      );

    // ✅ TOAST SUCCESS — LETAK SINI
    showToast(
      `Public holiday "${addName}" added successfully.`,
      "success",
      "Holiday Added"
    );

    addModal?.close();
    await loadHolidays();

  } catch (err) {
    console.error("❌ Error adding holiday:", err);

    // ❌ TOAST ERROR — LETAK SINI
    showToast(
      err.message || "Failed to add public holiday.",
      "error",
      "Action Failed"
    );
  }
}


  // ===================================
  // 5. MODAL LOGIC (ADD/EDIT/VIEW)
  // ===================================
  let addDateISO = '';
  let addName = '';
  let addDesc = '';
  let modalMode = 'add'; // 'add', 'viewPublic'
  let selectedHolidayId = null;
  let selectedHolidaySource = null; // BARU
  let selectedHolidayUID = null; // BARU

  async function openFormForDate(date) {
    const iso = isoLocal(atStartOfDay(date));
    addDateISO = iso;
    const y = date.getFullYear();
    
    // Ambil SEMUA data berkaitan tarikh ini
    selectedHolidayId = holidayIdsByISO.get(iso) || null;
    selectedHolidaySource = holidaySourcesByISO.get(iso) || 'custom'; // Anggap 'custom' jika tiada
    selectedHolidayUID = holidayUIDsByISO.get(iso) || null;

    if (holidayDatesByYear[y]?.has(iso)) {
      modalMode = 'viewPublic';
      addName = holidayNamesByYear[y]?.get(iso) || 'Public Holiday';
      addDesc = holidayDescsByYear[y]?.get(iso) || ''; 
    } else {
      modalMode = 'add';
      addName = '';
      addDesc = '';
    }
    if (!addModal?.open) addModal.showModal();
    await tick();
  }

  // FUNGSI INI DIKEMASKINI SEPENUHNYA DENGAN LOGIK 'deleteItem' BARU
 async function deletePublicHoliday() {
  const source = selectedHolidaySource;
  const uid = selectedHolidayUID;
  const date = addDateISO;
  const id = selectedHolidayId;

  if (!confirm("Are you sure you want to delete/hide this holiday?")) return;

  try {
    if (source === "official") {
      const res = await fetch(
        `${PUBLIC_VITE_API_BASE}/api/holidays/official/hide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            uid,
            date,
            reason: "Hidden by admin"
          })
        }
      );

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to hide official holiday");
      }

      // ✅ SUCCESS TOAST (OFFICIAL)
      showToast(
        "Official public holiday has been hidden.",
        "success",
        "Holiday Hidden"
      );

    } else {
      const res = await fetch(
        `${PUBLIC_VITE_API_BASE}/api/holidays/${id}`,
        {
          method: "DELETE",
          credentials: "include"
        }
      );

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to delete public holiday");
      }

      // ✅ SUCCESS TOAST (CUSTOM)
      showToast(
        "Public holiday deleted successfully.",
        "success",
        "Holiday Deleted"
      );
    }

    addModal?.close();
    await loadHolidays();

  } catch (err) {
    console.error("❌ Delete holiday error:", err);

    // ❌ ERROR TOAST
    showToast(
      err.message || "Unable to delete public holiday.",
      "error",
      "Action Failed"
    );
  }
}


  // ===================================
  // 6. LIFECYCLE & INITIALIZATION
  // ===================================
  onMount(async () => {
    // Build initial calendar view
    await loadHolidays(); // NEW: Fetch data on mount

    // Initialize Chart.js
    const Chart = (await import('chart.js/auto')).default;
    if (!canvasEl) return;
    const departmentOrder = [
      'Director',
      'Operations',
      'Operations Support',
      'Technical Data',
      'Technical Data - Consultant',
      'Sales & Technical Excellence',
      'Business Development',
      'Technical Data,Technical Data - Consultant'
    ];

    dataByDept.sort(
      (a, b) =>
        departmentOrder.indexOf(a.name) -
        departmentOrder.indexOf(b.name)
    );
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
<!--       HTML / MARKUP       -->
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
            <span class="dot" style="background:#0F9B8E"></span> Total Employees
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
      <h3>Calendar (Public Holidays)</h3>
      <div class="calendar calendar-wide">
        <div class="month">
          <div class="nav">
            <button class="nav-btn" on:click={prevYear} aria-label="Previous year" disabled={!canGoPrevYear()}>«</button>
            <button class="nav-btn" on:click={prevMonth} aria-label="Previous month" disabled={!canGoPrev()}>‹</button>
          </div>
          
          <!-- BARU: Wrapper untuk dua dropdown -->
          <div class="month-select-wrapper">
            <select
              class="month-select"
              aria-label="Select month"
              value={selectedMonth}
              on:change={onMonthSelect}
            >
              {#each staticMonthOptions as opt (opt.value)}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
            <select
              class="month-select year-select"
              aria-label="Select year"
              value={selectedYear}
              on:change={onYearSelect}
            >
              {#each dynamicYearOptions as year (year)}
                <option value={year}>{year}</option>
              {/each}
            </select>
          </div>

          <div class="nav">
            <button class="nav-btn" on:click={goToday} aria-label="Go to current month">Today</button>
            <button class="nav-btn" on:click={nextMonth} aria-label="Next month" disabled={!canGoNext()}>›</button>
            <button class="nav-btn" on:click={nextYear} aria-label="Next year" disabled={!canGoNextYear()}>»</button>
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
              disabled={d.outOfWindow || (!d.holiday && d.date < today && !d.today)}
              on:click={() => openFormForDate(d.date)}
              aria-label={`Select ${d.date.toDateString()}`}
              title={d.title || (d.holiday ? 'Public Holiday' : '')}
            >
              {d.label}
            </button>
          {/each}
        </div>
        <div class="legend small">
          <span><i class="swatch sw-blue"></i> Public Holiday</span>
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
  <form method="dialog" class="leave-form" on:submit|preventDefault={handleSubmit}>
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
  {#if modalMode === 'edit'}
    <input type="date" bind:value={editDate} required />
  {:else}
    <input type="text" value={addDateISO} readonly />
  {/if}
</label>

<label>
  <span>Leave Name</span>
  {#if modalMode === 'edit'}
    <!-- Edit mode: bind to editTitle -->
    <input type="text" name="name" bind:value={editTitle} required />
  {:else}
    <!-- Add / View mode: bind to addName (readonly only when viewing public) -->
    <input type="text" name="name" bind:value={addName} readonly={modalMode === 'viewPublic'} required />
  {/if}
</label>

<label>
  <span>Description</span>
  {#if modalMode === 'edit'}
    <textarea name="desc" rows="3" bind:value={editDescription}></textarea>
  {:else}
    <textarea name="desc" rows="3" bind:value={addDesc} readonly={modalMode === 'viewPublic'}></textarea>
  {/if}
</label>


    <div class="row-actions">
      {#if modalMode === 'add'}
        <button type="submit" class="submit-btn">Add</button>
      {/if}

      {#if modalMode === 'viewPublic'}
        {#if selectedHolidaySource !== 'official'}
         <button
      type="button"
      class="edit-btn"
      on:click={() => {
        editingId = selectedHolidayId;
        editDate = addDateISO;
        editTitle = addName;
        editDescription = addDesc || "";
        modalMode = 'edit';
      }}>
      Edit
    </button>
        {/if}

        <button 
          type="button" 
          class="danger-btn" 
          on:click={deletePublicHoliday}>
          Delete
        </button>
      {/if}

      {#if modalMode === 'edit'}
        <button
          type="button"
          class="submit-btn"
          on:click={saveEdit}>
          Save
        </button>
        <button
          type="button"
          class="cancel-btn"
          on:click={cancelEdit}>
          Cancel
        </button>
      {/if}
    </div>
  </form>
</dialog>

{#if toast.show}
  <div class="toast-stack">
    <div class="toast-item {toast.type} {toast.closing ? 'closing' : ''}">
      <div class="toast-icon">
      {#if toast.type === 'success'}
        <svg viewBox="0 0 24 24" class="toast-svg">
          <path d="M9.5 16.2L4.8 11.5l1.4-1.4 3.3 3.3 8.1-8.1 1.4 1.4z"/>
        </svg>
      {/if}

      {#if toast.type === 'error'}
        <svg viewBox="0 0 24 24" class="toast-svg">
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm3.5 13.1-1.4 1.4L12 13.4l-2.1 2.1-1.4-1.4L10.6 12 8.5 9.9l1.4-1.4 2.1 2.1 2.1-2.1 1.4 1.4L13.4 12z"/>
        </svg>
      {/if}

      {#if toast.type === 'info'}
        <svg viewBox="0 0 24 24" class="toast-svg">
          <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/>
        </svg>
      {/if}

      {#if toast.type === 'warning'}
        <svg viewBox="0 0 24 24" class="toast-svg">
          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
        </svg>
      {/if}
    </div>

      <div class="toast-body">
        <strong>{toast.title}</strong>
        <p>{toast.message}</p>
      </div>

      <button class="toast-close" on:click={() => (toast.show = false)}>×</button>
    </div>
  </div>
{/if}

<!-- ======================= -->
<!--         STYLES          -->
<!-- ======================= -->
<style>
  /* --- Global & Layout --- */
  :root{ --ring:#e5e7eb; --shadow:0 4px 12px rgba(0,0,0,.06); }
  .main { padding: 18px; }
  .grid{ margin-top:0; display:grid; gap:10px; grid-template-columns:repeat(12, minmax(0,1fr)); }
  .card{ background:#fff; border:1px solid var(--ring); border-radius:12px; padding:8px; box-shadow:var(--shadow); }
  h3{ margin:0 0 8px 0; font-size:var(--fs-section-heading, 16px); font-weight:600; color:var(--ink, #1F2937); }

  /* --- Employees Overview Card --- */
  .overview-wide { max-width: 100%; margin: 0; }
  .mini-metrics { display: grid; grid-template-columns: repeat(6, 0.5fr); gap: 10px; align-items: stretch; }
  .mini { border: 1px solid var(--ring); background: #f9fafb; border-radius: 10px; padding: 8px; text-align: center; height: 75px; display: flex; flex-direction: column; justify-content: center; transition: all 0.2s ease; }
  .mini-val { font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.1; }
  .mini-label { font-size: 12px; color: #0c4a6e; margin-top: 2px; display: flex; align-items: center; gap: 5px; justify-content: center; }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }

  /* --- Calendar Styles --- */
  .calendar-wide { max-width: 400px; margin: 0 auto; }
 
  .calendar-wide .days button{ padding: 14px;      /* ✅ kecilkan kotak tarikh */
  height: 45px; /* ✅ kawal tinggi */
  width: 52px;   
  font-size: 13px;  }

  .calendar .month{ display:flex; align-items:center; justify-content:space-between; font-weight:700; margin-bottom:6px; gap:6px; }
  
  /* --- BARU: Style untuk Dropdown Bulan/Tahun --- */
  .month-select-wrapper {
    display: flex;
    gap: 6px;
    flex-grow: 1; /* Benarkan wrapper membesar */
    justify-content: center; /* Pusatkan dropdowns */
    min-width: 170px; /* Pastikan ia ada ruang */
  }
  .month-select {
    border: none;
    background: #eef2ff;
    padding: 5px 9px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 700;
    line-height: 1.4; /* Selaraskan ketinggian */
    font-size: 12px;
    
    /* Overrides khusus untuk <select> */
    padding-right: 28px; /* Ruang untuk arrow */
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.5rem center;
    background-size: 1.25em 1.25em;
    
    text-align: center;
    flex-grow: 1; /* Bulan ambil baki ruang */
  }
  .month-select:hover {
    background: #e5e7eb;
  }
  .month-select.year-select {
    flex-grow: 0; /* Tahun tidak perlu membesar */
    min-width: 80px; /* Lebar tetap untuk tahun */
    padding-left: 9px;
    text-align: left;
  }
  /* --- Tamat Style Dropdown --- */
  
  .calendar .month .nav{ display:flex; gap:6px; flex-wrap:wrap; }
  .calendar .month .nav-btn{ border:none; background:#eef2ff; padding:5px 9px; border-radius:8px; cursor:pointer; font-weight:700; line-height:1; font-size:12px; }
  .calendar .month .nav-btn:hover{ background:#e5e7eb; }
  .nav-btn:disabled{ opacity:.5; cursor:not-allowed; }
  .weekdays{ display:grid; grid-template-columns:repeat(7,1fr); gap:4px; font-size:11.5px; color:#6b7280; margin-bottom:4px; }
  .days{ display:grid; grid-template-columns:repeat(7,1fr); gap:4px; }
  .days button{ border:1px solid var(--ring); border-radius:8px; background:#fff; cursor:pointer; font-size:13px; }
  .days button.today { border: 2px solid #0F9B8E; font-weight: 700; color: #111827; background: #ffff; }
  .days button.muted{ opacity:.5; }
  .days button:disabled{ background:#f3f4f6; color:#9ca3af; cursor:not-allowed; }
  .days button.holiday { background: #71c0f5; border-color: #71c0f5; color: #fff; }
  .days button.today.holiday { background: #71c0f5; color: #fff; }
  .days button.out { background: #f9fafb; color: #9ca3af; border-color: #e5e7eb; cursor: not-allowed; opacity: .75; }
  .legend.small{ display:flex; justify-content:center; gap:14px; margin-top:8px; font-size:11.5px; color:#6b7280; }
  .swatch{ display:inline-block; width:14px; height:9px; border-radius:3px; margin-right:6px; vertical-align:middle; }
  .sw-today{ background:#fff; border:1px solid #0F9B8E; }
  .sw-blue{ background:#71c0f5; border:1px solid #71c0f5; }

  /* --- Chart Styles --- */
  .chart-box { display: flex; justify-content: center; align-items: center; height: 320px; margin-left: 22px;  width: 650px; margin-top: 50px; }
  .chart-box canvas { max-height: 500px; width: 100%; }

  /* --- Modal Styles --- */
  .leave-modal .title{ margin-bottom:8px; }
   .leave-modal {
    border: 1px solid var(--ring);
    border-radius: 12px;
    box-shadow: var(--shadow);
    padding: 0;
    max-width: 500px;
    width: 90%;
  }
  .leave-modal::backdrop {
    background: rgba(0,0,0,0.2);
    backdrop-filter: blur(0.8px);
  }
  .edit-btn, .cancel-btn {
  padding: 9px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
  background: #fff; /* White background */
  color: #0c4a6e; /* Same text color as submit button */
  border: 1px solid #e5e7eb; /* Same border color */
  transition: all 0.2s ease; /* Smooth hover effect */
}

.edit-btn:hover, .cancel-btn:hover {
  background: #f3f4f6;
}

  .leave-form label{ display:grid; gap:6px; margin:8px 0; }
  .leave-form input[readonly], .leave-form textarea[readonly]{ background:#f3f4f6; color:#6b7280; cursor:not-allowed; }
  .leave-form input[required]:invalid { border-color: #DC2626; }
  .row-actions{ display:flex; gap:8px; align-items:center; margin-top:8px; }
  .submit-btn{ background:#0F9B8E; color:#fff; border:none; border-radius:10px; padding:9px 14px; cursor:pointer; font-weight:600; font-size:14px; }
  .submit-btn:hover{ opacity:.9; }
  .danger-btn{ background:#dc2626; color:#fff; border:1px solid #fecaca; border-radius:8px; padding:9px 12px; cursor:pointer; font-weight:700; }
  .danger-btn:hover{ background:#b91c1c; }
  .close-btn{ position:absolute; right:10px; top:8px; border:none; background:transparent; font-size:16px; cursor:pointer; }

/* =========================
   TOAST NOTIFICATION
========================= */
/* ===== TOAST STACK ===== */
.toast-stack {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
}

/* ===== TOAST ITEM ===== */
.toast-item {
  display: flex;
  align-items: flex-start; 
  background: #fff;
  border-radius: 8px;
  min-width: 340px;
  max-width: 400px;
  padding: 12px 14px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.15);
  animation: slideIn 0.25s ease;
  border-left: 5px solid;
}

/* ICON */
.toast-icon {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  margin-top: 2px;
}

.toast-svg {
  width: 20px;
  height: 20px;
  fill: #fff;
}

/* BODY */
.toast-body {
  flex: 1;
}

.toast-body strong {
  display: block;
  font-size: 14px;
  color: #111827;
  margin-bottom: 2px;
}

.toast-body p {
  margin: 0;
  font-size: 13px;
  color: #4b5563;
}

/* CLOSE */
.toast-close {
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #9ca3af;
  margin-left: 10px;
}
.toast-close:hover {
  color: #111827;
}

/* ===== TYPES ===== */
.toast-item.success {
  border-color: #22c55e;
}
.toast-item.success .toast-icon {
  background: #22c55e;
}

.toast-item.error {
  border-color: #DC2626;
}
.toast-item.error .toast-icon {
  background: #DC2626;
}

.toast-item.info {
  border-color: #0F9B8E;
}
.toast-item.info .toast-icon {
  background: #3b82f6;
}

.toast-item.warning {
  border-color: #f59e0b;
}
.toast-item.warning .toast-icon {
  background: #f59e0b;
}

/* ===== ANIMATION ===== */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(24px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
@keyframes fadeOut {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(24px);
  }
}

.toast-item.closing {
  animation: fadeOut 0.25s ease forwards;
}

@media (max-width: 860px) {
  .grid { grid-template-columns: 1fr !important; }
  .grid > [style] { grid-column: unset !important; }
  .main { padding: 10px; }
  .mini-metrics { grid-template-columns: repeat(2, 1fr); }
  .chart-box { width: 100%; height: 260px; margin-left: 0; margin-top: 20px; }
  .calendar-wide { max-width: 100%; }
  .calendar-wide .days button { width: auto; height: 38px; font-size: 12px; padding: 4px; }
  .toast-item { min-width: 0; width: calc(100vw - 32px); max-width: none; }
}
</style>