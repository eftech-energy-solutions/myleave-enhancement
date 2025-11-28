<script>
  import { onMount, tick } from 'svelte';
  // ----- state -----
  let loading = true;
  let error = "";
  const pct = (s, t) => Math.min(100, Math.max(0, Math.round((s / t) * 100)));

  // ======= Pengurusan Cuti (Digabung dari API)
  let holidaysByYear = {};
  let holidayDatesByYear = {};
  let holidayNamesByYear = {};
  let holidayDescsByYear = {};

  // ---- Local ISO helper to avoid UTC off-by-one (CRITICAL FIX) ----
  const atStartOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const sameDay = (a, b) => atStartOfDay(a).getTime() === atStartOfDay(b).getTime();
  const formatCF = (x) => Number(x || 0).toString().replace(".0", "");

  const localISO = (d) => {
    const x = atStartOfDay(d);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const dd = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  const parseLocalISO = (iso) => {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, (m - 1), d);
  };

  function isHoliday(d) {
    const y = d.getFullYear();
    const iso = localISO(d);
    return holidayDatesByYear[y]?.has(iso) ?? false;
  }

  function countDaysExcludingPH(fromISO, untilISO) {
    const start = parseLocalISO(fromISO);
    const end   = parseLocalISO(untilISO || fromISO);
    if (!start || !end) return 0;
    if (atStartOfDay(end) < atStartOfDay(start)) return 0;

    let c = 0;
    const d = new Date(start);
    for (;;) {
      if (!isHoliday(d)) c++;
      if (sameDay(d, end)) break;
      d.setDate(d.getDate() + 1);
    }
    return c;
  }
  function holidayTitle(d) {
    const y = d.getFullYear();
    const iso = localISO(d);
    return holidayNamesByYear[y]?.get(iso) || null;
  }
  function holidayDescription(d) {
    const y = d.getFullYear();
    const iso = localISO(d);
    return holidayDescsByYear[y]?.get(iso) || null;
  }

  // ----- calendar helpers -----
  let today = atStartOfDay(new Date());
  const todayISO = localISO(today);
  let viewBase = atStartOfDay(new Date());

  // Akan ditetapkan oleh processHolidayData
  let minDate = new Date(new Date().getFullYear(), 0, 1);
  let maxDate = new Date(new Date().getFullYear(), 11, 31);
  // BARU: Tambah min/max month start untuk clamp
  const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  let minMonthStart = monthStart(minDate);
  let maxMonthStart = monthStart(maxDate);

  // let monthLabel = ''; // DIBUANG
  let days = [];
  let modal;

  function buildMonth(base = new Date()) {
    const y = base.getFullYear(), m = base.getMonth();
    const first = new Date(y, m, 1);
    const start = new Date(first);
    // Monday-start
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));

    const arr = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const iso = localISO(d);
      const outOfWindow = d < minDate || d > maxDate;

      const hol = isHoliday(d);
      const holName = hol ? holidayTitle(d) : null;
      const holDesc = hol ? holidayDescription(d) : null;

      let title = undefined;
      if (hol) {
        title = holName;
        if (holDesc) title += ` - ${holDesc}`;
      }

      arr.push({
        key: iso,
        label: d.getDate(),
        date: d,
        muted: d.getMonth() !== m,
        today: sameDay(d, today),
        holiday: hol,
        title,
        outOfWindow
      });
    }
    // monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(first); // DIBUANG
    days = arr;
  }
  
  // --- BARU: State untuk Dropdown Berasingan (Sama seperti admin) ---
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

  // ======= Muat turun data dari API
  async function loadHolidays() {
    loading = true;
    error = "";
    try {
      const res = await fetch("/api/holidays", { credentials: "include" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("GET /api/holidays failed:", res.status, txt);
        throw new Error("Failed to load holidays");
      }
      const flatHolidays = await res.json(); // [{ id, date, title, description }]

      const byYear = {};
      for (const hol of flatHolidays) {
        const year = hol.date.slice(0, 4);
        if (!byYear[year]) byYear[year] = [];
        byYear[year].push({
          id: hol.id,
          date: hol.date,
          name: hol.title,
          description: hol.description || ''
        });
      }
      holidaysByYear = byYear;

      processHolidayData();

      if (!viewBase) {
        viewBase = clampToWindowMonth(atStartOfDay(new Date()));
      }
      buildMonth(viewBase);

    } catch (e) {
      error = e.message || "Error";
    } finally {
      loading = false;
    }
  }

  function processHolidayData() {
    const newHolidayDatesByYear = {};
    const newHolidayNamesByYear = {};
    const newHolidayDescsByYear = {};

    // ⬇️ LOGIK BARU: TAHUN SEMASA + 3 TAHUN (Sama seperti admin)
    const currentYear = new Date().getFullYear();
    const minYear = currentYear;
    const maxYear = currentYear + 3;

    // Kemaskini pembolehubah global
    minDate = new Date(minYear, 0, 1);
    maxDate = new Date(maxYear, 11, 31);
    minMonthStart = monthStart(minDate); // DITAMBAH
    maxMonthStart = monthStart(maxDate); // DITAMBAH
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
    }

    holidayDatesByYear = newHolidayDatesByYear;
    holidayNamesByYear = newHolidayNamesByYear;
    holidayDescsByYear = newHolidayDescsByYear;
  }

  function clampToWindowMonth(d) {
    // ⬇️ DIUBAHSUAI: Logik fallback ditambah untuk pastikan ia sentiasa ada nilai
    if (!d || !minMonthStart || !maxMonthStart || !minMonthStart.getTime() || !maxMonthStart.getTime()) {
      const fallbackYear = new Date().getFullYear();
      minMonthStart = new Date(fallbackYear, 0, 1);
      maxMonthStart = new Date(fallbackYear + 3, 11, 31);
      if (!d) d = new Date();
    }
    // ⬆️ TAMAT UBAHSUAI

    const ms = monthStart(d).getTime();
    if (ms < minMonthStart.getTime()) return new Date(minMonthStart);
    if (ms > maxMonthStart.getTime()) return new Date(maxMonthStart);
    return new Date(d);
  }
let user = null;

onMount(async () => {
  const meRes = await fetch("/api/me", { credentials: "include" });
  user = { ...(await meRes.json()) };

  await loadHolidays();
  await loadRecent();

  // 🔥 PATCH 1: If staffhistory changed something, force reload dashboard recent
  if (sessionStorage.getItem("forceDashboardRefresh") === "true") {
    await loadRecent();
    recent = [...recent];          // 🔥 force UI update
    sessionStorage.removeItem("forceDashboardRefresh");
  }
});



// Reactive donut values once user is loaded
$: donuts = user ? [
  {
    title: "Annual Leave Summary",
    total: user.leave_entitlement_annual_original ?? 14,
    spent: (user.leave_entitlement_annual_original ?? 14)
        - (user.leave_entitlement_annual ?? 14),
    carryForward: user.carry_forward_balance ?? 0
  },


  {
    title: "Medical Leave Summary",
    total: 14,
    spent: 14 - (user.leave_entitlement_medical ?? 14)
  },

  {
    title: "Hospitalization Leave Summary",
    total: user.hosp_entitlement ?? 60,
    spent: (user.hosp_entitlement ?? 60) - (user.hosp_balance ?? 60)
  }



] : [];



  // ===== navigation (prev/next + jump to today) =====
  // BARU: Tambah check canGoPrev/Next
  const canGoPrev = () => monthStart(viewBase) > minMonthStart;
  const canGoNext = () => monthStart(viewBase) < maxMonthStart;

  function prevMonth() {
    if (!canGoPrev()) return; // BARU
    const d = new Date(viewBase); 
    d.setMonth(d.getMonth() - 1, 1); 
    viewBase = clampToWindowMonth(d); // BARU: Guna clamp
    buildMonth(viewBase); 
  }
  function nextMonth() { 
    if (!canGoNext()) return; // BARU
    const d = new Date(viewBase); 
    d.setMonth(d.getMonth() + 1, 1); 
    viewBase = clampToWindowMonth(d); // BARU: Guna clamp
    buildMonth(viewBase); 
  }
  function prevYear()  { 
    if (!canGoPrev()) return; // BARU
    const d = new Date(viewBase); 
    d.setFullYear(d.getFullYear() - 1, d.getMonth(), 1); 
    viewBase = clampToWindowMonth(d); // BARU: Guna clamp
    buildMonth(viewBase); 
  }
  function nextYear()  { 
    if (!canGoNext()) return; // BARU
    const d = new Date(viewBase); 
    d.setFullYear(d.getFullYear() + 1, d.getMonth(), 1); 
    viewBase = clampToWindowMonth(d); // BARU: Guna clamp
    buildMonth(viewBase); 
  }
  function goToday()   { 
    viewBase = clampToWindowMonth(atStartOfDay(new Date())); 
    buildMonth(viewBase); 
  }

  // ===== Leave form state =====
  let leaveType = 'AL';
  let duration = 'Full';       // 'Full' | 'Half'
  let dateFrom = '';
  let dateUntil = '';
  let totalDays = 1;
  let requestType = "new";
  let endLocked = false;

  // ---- Medical: attachment required ----
  let attachmentFiles;   // FileList
  let fileInputEl;       // <input type="file">
  $: showAttachmentReminder =
    (leaveType === 'MC') && (!attachmentFiles || attachmentFiles.length === 0);

    const fixedDurations = {
      MAT : 98,
      PAT : 7,
      "COMP_A": 3,
      "COMP_B": 1,
      MAR : 3
    };


  $: {
    if (fileInputEl) {
      const needs = (leaveType === 'MC');
      fileInputEl.required = needs;
      if (needs && (!attachmentFiles || attachmentFiles.length === 0)) {
        fileInputEl.setCustomValidity('For Medical leave, please attach your medical certificate.');
        setTimeout(() => fileInputEl.reportValidity(), 0);
      } else {
        fileInputEl.setCustomValidity('');
      }
    }
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = (from, until) => {
    if (!from) return 0;
    const a = parseLocalISO(from);
    const b = parseLocalISO(until || from);
    return Math.max(1, Math.floor((b - a) / dayMs) + 1); // inclusive
  };
   const addDaysISO = (iso, days) => {
    const d = parseLocalISO(iso); // Guna parseLocalISO
    d.setDate(d.getDate() + (days - 1)); // -1 sebab 'inclusive'
    return localISO(d);
  };

  // keep until >= from
  $: if (dateFrom && dateUntil && parseLocalISO(dateUntil) < parseLocalISO(dateFrom)) {
    dateUntil = dateFrom;
  }
  $: {
    const n = fixedDurations[leaveType];
    endLocked = Boolean(n);
    if (dateFrom && endLocked) {
      dateUntil = addDaysISO(dateFrom, n);
    }
  }

  // auto-calc total
  $: if (duration === 'Half') {
    totalDays = 0.5;
    if (dateFrom) dateUntil = dateFrom;
  } else {
    totalDays = dateFrom ? diffDays(dateFrom, dateUntil || dateFrom) : 0;
  }

  function onFromChange() {
    if (!dateFrom) return;
    if (duration === 'Half') dateUntil = dateFrom;
    if (!dateUntil) dateUntil = dateFrom;
  }

  async function openLeaveForm(date) {
    const iso = localISO(date);
    leaveType = 'AL';
    duration  = 'Full';
    dateFrom  = iso;
    dateUntil = iso;
    totalDays = 1;
    attachmentFiles = undefined;

    if (!modal?.open) modal.showModal();
    await tick();
  }

async function submitLeave(e) {
  const formEl = e.currentTarget;
  e.preventDefault();

  if (!formEl.reportValidity()) return;

  const fd = new FormData(formEl);

  fd.set("type", leaveType);
  fd.set("requestType", requestType);
  fd.set("duration", duration);
  fd.set("dateFrom", dateFrom);
  fd.set("dateUntil", dateUntil);
  fd.set("totalDays", String(totalDays));

  try {
    const res = await fetch("/api/leave-requests", {
      method: "POST",
      body: fd,
      credentials: "include"
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "Failed to submit leave.");
      alert(msg);
      return;
    }

    const created = await res.json().catch(() => null);
    console.log("Leave created:", created);

    modal?.close(); // 🔥 PERBETULKAN INI

  } catch (err) {
    console.error("Error submit leave:", err);
    alert("Something went wrong while submitting your leave.");
  }
}
let recent = [];

async function loadRecent() {
  try {
    const res = await fetch("/api/leave-requests", {
      credentials: "include"
    });

    if (!res.ok) {
      console.error("GET /api/leave-requests failed:", res.status);
      return;
    }

    const all = await res.json();

    if (!user || !user.staff_id) {
      console.error("❌ user.staff_id not found!", user);
      return;
    }

    recent = all
      .filter(l => String(l.staff_id).toLowerCase() === String(user.staff_id).toLowerCase())
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 4)
      .map(l => ({
        id: l.leave_id,
        from: l.date_from,
        to: l.date_until,
        totalDays: l.total_days,
        type: l.leave_type,
        status:
          l.status === "pending" ? "Pending" :
          l.status === "approved" ? "Approved" :
          l.status === "rejected" ? "Rejected" :
          l.status === "cancellation_pending" ? "Cancellation Pending" :
          l.status
      }));
    recent = [...recent];
  } catch (err) {
    console.error("Failed to load recent staff leaves:", err);
  }
}

  const fmt = (iso) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
</script>

<main class="main">
  <!-- ===== GRID ===== -->
  <div class="grid">
    <!-- Top: 3 donuts -->
    {#each donuts as d}
      <div class="card" style="grid-column: span 4;">
        <h3 class="donut-title">{d.title}</h3>
        <div
          class="donut fancy"
          style="--size:110px; --spent:{pct(d.spent,d.total)}; --spent-color: var(--spentRed); --rest-color: var(--restBlue);"
        ></div>
        <div class="legend-row">
          <div class="legend-item"><span class="chip spent"></span><span>Taken Leave</span></div>
          <div class="legend-item"><span class="chip unspent"></span><span>Remaining Leave</span></div>
        </div>
        <div class="total-line">Total spent: {d.spent}/{d.total}</div>

        {#if d.title === 'Annual Leave Summary'}
          <div class="cf-line">
            Carry forward: {formatCF(d.carryForward)}/7
            <button type="button" class="info-btn" aria-describedby={"cf-tip-" + d.title} tabindex="0">ⓘ</button>
            <span class="tooltip" id={"cf-tip-" + d.title} role="tooltip">
              Carry-forward is capped at 7 days and expires before April (start of April).
            </span>
          </div>
        {/if}
      </div>
    {/each}

    <!-- Bottom: Calendar (4) + Recent (8) -->
    <div class="card" style="grid-column: span 4;">
      <h3>Leave Application</h3>
      {#if loading}
        <p>Loading holidays...</p>
      {:else if error}
        <p class="text-red-600">{error}</p>
      {:else}
      <div class="calendar calendar-small">
        <div class="month">
          <div class="nav">
            <!-- BARU: Tambah disabled={!canGoPrev} -->
            <button class="nav-btn" on:click={prevYear} aria-label="Previous year" disabled={!canGoPrev()}>«</button>
            <button class="nav-btn" on:click={prevMonth} aria-label="Previous month" disabled={!canGoPrev()}>‹</button>
          </div>

          <!-- ⬇️ BARU: Wrapper untuk dua dropdown (Sama seperti admin) -->
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
          <!-- ⬆️ TAMAT Wrapper -->

          <div class="nav">
            <button class="nav-btn" on:click={goToday} aria-label="Go to current month">Today</button>
            <!-- BARU: Tambah disabled={!canGoNext} -->
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
              title={d.title}
              disabled={d.outOfWindow || d.holiday || (!d.today && atStartOfDay(d.date) < today)}
              on:click={() => openLeaveForm(d.date)}
              aria-label={`Select ${d.date.toDateString()}`}
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
      {/if}
    </div>

    <div class="card" style="grid-column: span 8;">
      <h3>Recent Application</h3>
      <div class="recent-wrap">
        {#each recent as r}
          <div class="recent-item">
            <div class="when">{fmt(r.from)} – {fmt(r.to)}</div>
            <div class="cols">
              <div><div class="muted">Total Days:</div><div>{r.totalDays}</div></div>
              <div><div class="muted">Leave Type:</div><div>{r.type}</div></div>
              <div><div class="muted">Status:</div><div>{r.status}</div></div>
            </div>
            <a class="link" href={`/dashboard/staff/staffhistory`}>Details</a>
          </div>
        {/each}
      </div>
      <div class="recent-footer">
  <a class="view-more" href="/dashboard/staff/staffhistory">View more →</a>
</div>
    </div>
  </div>
</main>

<!-- ===== MODAL ===== -->
<dialog bind:this={modal} class="leave-modal" aria-labelledby="leave-title">
  <form class="leave-form" on:submit={submitLeave}>
    <button type="button" class="close-btn" on:click={() => modal.close()} aria-label="Close">✕</button>
    <h2 id="leave-title" class="title">Leave Application Form</h2>

    <label>
      <span>Leave Type</span>
      <select name="type" bind:value={leaveType} required>
        <option value="AL">Annual / Emergency</option>
        <option value="MC">Medical</option>
        <option value="MAT">Maternity</option>
        <option value="PAT">Paternity</option>
        <option value="COMP_A">Compassionate A (Parent/Child/Spouse)</option>
        <option value="COMP_B">Compassionate B (Grandparent/Sibling)</option>
        <option value="MAR">Marriage</option>
        <option value="HOSP">Hospitalization</option>

      </select>
    </label>

    <div class="duration">
      <span>Leave Duration</span>
      <label><input type="radio" name="duration" value="Full" bind:group={duration}> Full Day</label>
      <label><input type="radio" name="duration" value="Half" bind:group={duration}> Half Day</label>
    </div>

    <div class="dates">
      <label>
        <span>Date from</span>
        <input
          type="date"
          name="dateFrom"
          bind:value={dateFrom}
          required
          min={todayISO}
          on:change={onFromChange}
        />
      </label>

      <label>
        <span>Date until</span>
        <input
          type="date"
          name="dateUntil"
          bind:value={dateUntil}
          min={dateFrom || todayISO}
          disabled={duration === 'Half'}
          aria-disabled={duration === 'Half'}
        />
        {#if duration === 'Half'}
          <input type="hidden" name="dateUntil" value={dateUntil} />
        {/if}
      </label>
    </div>

    <label>
      <span>Total day</span>
      <input
        type="number"
        name="totalDays"
        bind:value={totalDays}
        min="0.5"
        step="0.5"
        required
        readonly
      />
    </label>

    <label><span>Reason</span><textarea name="reason" rows="3" required></textarea></label>

    <label>
      <span>Attachment</span>
      <input
        type="file"
        name="attachment"
        bind:this={fileInputEl}
        bind:files={attachmentFiles}
        required={leaveType === 'MC'}
        on:change={() => fileInputEl?.setCustomValidity('')}
      />
      {#if showAttachmentReminder}
        <small class="help warn">Reminder: please attach your medical certificate.</small>
      {/if}
    </label>

    <button type="submit" class="submit-btn">SUBMIT</button>
  </form>
</dialog>

<style>
  /* page container */
  .main { padding: 18px; }

  /* grid spacing */
  .grid{ margin-top:0px; display:grid; gap:10px; grid-template-columns:repeat(12, minmax(0,1fr)); }

  /* donut colors & size */
  :global(:root){ --spentRed:#ef4444; --restBlue:#3b82f6; --ring:#e5e7eb; --shadow:0 2px 12px rgba(0,0,0,.06); }
  .card{ border:1px solid var(--ring); border-radius:12px; padding:12px; background:#fff; box-shadow:var(--shadow); }
  .text-red-600 { color: #dc2626; }

  .donut.fancy{
    height: var(--size, 110px); width: var(--size, 110px);
    border-radius:9999px; margin:6px auto 8px;
    background: conic-gradient(var(--spent-color, #ef4444) calc(var(--spent) * 1%), var(--rest-color, #3b82f6) 0);
    display:grid; place-items:center; box-shadow:var(--shadow);
  }

  .sw-blue{ background:#71c0f5; border:1px solid #71c0f5; }
  .sw-today{ background:#fff; border:1px solid #49bdb3; }
  .legend.small{
    display:flex; justify-content:center; gap:14px; margin-top:8px; font-size:11.5px; color:#6b7280;}
    
  .swatch{ display:inline-block; width:14px; height:9px; border-radius:3px; margin-right:6px; vertical-align:middle; }

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

  /* recent application */
.recent-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}


.view-more {
  font-size: 13px;
  font-weight: 600;
  color: #2563eb;
  cursor: pointer;
}

.view-more:hover {
  color: #1d4ed8;
}

  /* carry-forward line + tooltip (added) */
  .cf-line{
    margin-top:6px;
    text-align:center;
    font-size:12px;
    color:#6b7280;
    position:relative;
    display:flex;
    align-items:center;
    justify-content:center;
    gap:6px;
  }
  .info-btn{
    border:none;
    background:#eef2ff;
    border-radius:999px;
    width:18px; height:18px;
    line-height:18px;
    font-size:12px;
    font-weight:700;
    cursor:pointer;
    padding:0;
    display:inline-grid;
    place-items:center;
    color:#374151;
  }
  .info-btn {
  border: none;
  background: none;      /* remove blue background */
  border-radius: 999px;
  width: 18px;
  height: 18px;
  line-height: 18px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
  display: inline-grid;
  place-items: center;
  color: #374151;        /* dark gray for text/icon */
  transition: background 0.2s ease;
  margin-top: 2px; /* cuba 2–4px ikut sedap */
}

.info-btn:hover {
  background: #e5e7eb;    /* light gray only when hovered */
}

  .tooltip{
    position:absolute;
    bottom:130%;
    left:50%;
    transform:translateX(-50%);
    background:#111827; color:#fff;
    padding:6px 8px; border-radius:6px; font-size:12px; white-space:nowrap;
    box-shadow:0 4px 18px rgba(0,0,0,.18);
    opacity:0; visibility:hidden; transition:opacity .15s ease, visibility .15s ease;
    pointer-events:none;
  }
  .tooltip::after{
    content:""; position:absolute; top:100%; left:50%; transform:translateX(-50%);
    border:6px solid transparent; border-top-color:#111827;
  }
  .info-btn:hover + .tooltip, .info-btn:focus + .tooltip{ opacity:1; visibility:visible; }

  /* calendar sizing */
  .calendar-small{ max-width:350px; margin:0 auto; }
  .calendar-small .days button{ padding:4px; }

  /* month header with full nav */
  .calendar .month{
    display:flex; align-items:center; justify-content:space-between;
    font-weight:700; margin-bottom:6px;
    gap:8px;
  }
  .calendar .month > span { text-align:center; min-width:160px; }

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
    padding: 6px 10px; /* Sesuai dengan .nav-btn staff */
    border-radius: 8px;
    cursor: pointer;
    font-weight: 700;
    line-height: 1.4; /* Ketinggian lebih baik untuk <select> */
    /* font-size: default, sama seperti .nav-btn */
    
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
    padding-left: 10px;
    text-align: left;
  }
  /* --- Tamat Style Dropdown --- */

  .calendar .month .nav{ display:flex; gap:6px; flex-wrap:wrap; }
  .calendar .month .nav-btn{
    border:none; background:#eef2ff; padding:6px 10px; border-radius:8px; cursor:pointer;
    font-weight:700; line-height:1;
  }
  .calendar .month .nav-btn:hover{ background:#e5e7eb; }
  .nav-btn:disabled { opacity: 0.5; cursor: not-allowed; } /* BARU: Style untuk butang disabled */

  /* weekdays/days grid */
  .weekdays{ display:grid; grid-template-columns:repeat(7,1fr); gap:4px; font-size:12px; color:#6b7280; margin-bottom:4px; }
  .days{ display:grid; grid-template-columns:repeat(7,1fr); gap:4px; }
  .days button{
    border:1px solid var(--ring); border-radius:8px; background:#fff; cursor:pointer;
  }
  .days button.today {
    border: 2px solid #49bdb3;
    font-weight: 700;
    color: #111827;
    background: #ffff;
  }
  .days button.muted{ opacity:.5; }
  .days button:disabled{ background:#f3f4f6; color:#9ca3af; cursor:not-allowed; }

  /* Public holiday highlight — SAME as Admin */
  .days button.holiday { background: #71c0f5; border-color: #71c0f5; color: #fff; }
  .days button.today.holiday { background: #71c0f5; }
  .days button.out { background: #f9fafb; color: #9ca3af; border-color: #e5e7eb; cursor: not-allowed; opacity: .75; }

  /* recent card */
  .recent-wrap{ display:grid; gap:12px; }
  .recent-item{ border:1px solid var(--ring); border-radius:12px; padding:12px; display:grid; gap:6px; background:#f9fafb; }
  .recent-item .when{ font-weight:700; color:#111827; }
  .recent-item .cols{ display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; font-size:12px; }
  .recent-item .muted{ color:#6b7280; }

  .link { 
    font-size: 12px; 
    color: #2563eb; 
    text-decoration: none; 
    font-weight: 600;
    justify-self: start;
  }
  .link:hover { text-decoration: underline; }

  /* Modal Styles */
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
    backdrop-filter: blur(2px);
  }
  .leave-form {
    padding: 18px 22px 22px;
    display: grid;
    gap: 12px;
  }
  .leave-form .title { margin: 0 0 4px; }
  .leave-form label {
    display: grid;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
  }
  .leave-form input, .leave-form select, .leave-form textarea {
    font-size: 14px;
    font-weight: 400;
    border: 1px solid var(--ring);
    border-radius: 8px;
    padding: 8px 10px;
  }
  .leave-form input[required]:invalid, .leave-form textarea[required]:invalid {
    border-color: #ef4444;
  }
  
  /* --- Keep radios inline/left without changing their markup position --- */
  .leave-form .duration {
    display: flex;
    flex-direction: column;
    gap: .5rem;
    align-items: flex-start;
  }
  .leave-form .duration label {
    display: inline-flex;
    flex-direction: row;
    align-items: center;
    gap: .5rem;
    cursor: pointer;
    text-align: left;
    font-weight: 400; /* label weight normal */
  }
  .leave-form .duration input[type="radio"] {
    accent-color: #3FADA4; /* slightly darker than #49bdb3 */
    width: 16px;
    height: 16px;
    margin: 0;
  }

  /* Greyed-out look for locked fields */
  .leave-form input[readonly],
  .leave-form input:disabled {
    background:#f3f4f6;
    color:#6b7280;
    cursor:not-allowed;
  }

  /* helper text */
  .help { color:#6b7280; font-size:12px; display:block; margin-top:4px; font-weight: 400; }
  .help.warn { color:#b45309; }
  
  .submit-btn {
    background: #3FADA4;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 10px 14px;
    cursor: pointer;
    font-weight: 700;
    font-size: 14px;
    margin-top: 8px;
  }
  .submit-btn:hover { opacity: .9; }
  
  .close-btn{ 
    position:absolute; 
    right:10px; top:8px; 
    border:none; background:transparent; 
    font-size:20px; 
    cursor:pointer; 
    padding: 4px;
  }
</style>