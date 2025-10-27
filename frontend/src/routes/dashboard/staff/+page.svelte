<script>
  import { onMount, tick } from 'svelte';
  export let data; // comes from +layout.server.js -> { user, holidaysByYear }

  // ----- donuts -----
  const donuts = [
    { title: 'Annual Leave Summary',          spent: 1,  total: 14, carryForward: 0 }, // added carryForward (dummy)
    { title: 'Medical Leave Summary',         spent: 0,  total: 14 },
    { title: 'Hospitalization Leave Summary', spent: 0,  total: 60 }
  ];
  const pct = (s, t) => Math.min(100, Math.max(0, Math.round((s / t) * 100)));

  // Shared public holidays (single source from layout)
  const holidaysByYear = data.holidaysByYear;

  // Build quick lookups from shared holidays
  const years = Object.keys(holidaysByYear).map(Number);
  const holidayDatesByYear = {};
  const holidayNamesByYear = {};
  for (const y of years) {
    const list = holidaysByYear[y] ?? [];
    holidayDatesByYear[y] = new Set(list.map(h => h.date)); // 'YYYY-MM-DD'
    holidayNamesByYear[y] = new Map(list.map(h => [h.date, h.name || 'Public Holiday']));
  }

  // ---- Local ISO helper to avoid UTC off-by-one (CRITICAL FIX) ----
  const atStartOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const localISO = (d) => {
    const x = atStartOfDay(d);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const dd = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  function isHoliday(d) {
    const y = d.getFullYear();
    const iso = localISO(d);
    return holidayDatesByYear[y]?.has(iso) ?? false;
  }
  // parse 'YYYY-MM-DD' safely in local time (no UTC drift)
  const parseLocalISO = (iso) => {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, (m - 1), d);
  };

  // Count inclusive days excluding public holidays
  function countDaysExcludingPH(fromISO, untilISO) {
    const start = parseLocalISO(fromISO);
    const end   = parseLocalISO(untilISO || fromISO);
    if (!start || !end) return 0;

    // ensure start <= end
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

  // ----- calendar helpers -----
  const sameDay = (a, b) => atStartOfDay(a).getTime() === atStartOfDay(b).getTime();

  let today = atStartOfDay(new Date());
  const todayISO = localISO(today); // use local ISO for inputs too

  // moving "view base" for the visible calendar
  let viewBase = atStartOfDay(new Date());

  let monthLabel = '';
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
      const hol = isHoliday(d);
      arr.push({
        key: localISO(d),               // FIX: use local ISO for stable keys
        label: d.getDate(),
        date: d,
        muted: d.getMonth() !== m,
        today: sameDay(d, today),
        holiday: hol,
        title: hol ? holidayTitle(d) : null
      });
    }
    monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(first);
    days = arr;
  }

  onMount(() => buildMonth(viewBase));

  // ===== navigation (prev/next + jump to today) =====
  function prevMonth() {
    const d = new Date(viewBase);
    d.setMonth(d.getMonth() - 1, 1);
    viewBase = atStartOfDay(d);
    buildMonth(viewBase);
  }
  function nextMonth() {
    const d = new Date(viewBase);
    d.setMonth(d.getMonth() + 1, 1);
    viewBase = atStartOfDay(d);
    buildMonth(viewBase);
  }
  function prevYear() {
    const d = new Date(viewBase);
    d.setFullYear(d.getFullYear() - 1, d.getMonth(), 1);
    viewBase = atStartOfDay(d);
    buildMonth(viewBase);
  }
  function nextYear() {
    const d = new Date(viewBase);
    d.setFullYear(d.getFullYear() + 1, d.getMonth(), 1);
    viewBase = atStartOfDay(d);
    buildMonth(viewBase);
  }
  function goToday() {
    viewBase = atStartOfDay(new Date());
    buildMonth(viewBase);
  }

  // ===== Leave form state (auto-calc total) =====
  let leaveType = 'Annual';     // added for Medical attachment requirement
  let duration = 'Full';        // 'Full' | 'Half'
  let dateFrom = '';
  let dateUntil = '';
  let totalDays = 1;

  // ---- Medical: attachment required ----
  let attachmentFiles;  // FileList
  let fileInputEl;      // <input type="file">
  $: showAttachmentReminder =
    (leaveType === 'Medical') && (!attachmentFiles || attachmentFiles.length === 0);

  // Toggle native required + message live (minimal, only for Medical)
  $: {
    if (fileInputEl) {
      const needs = (leaveType === 'Medical');
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
    const a = atStartOfDay(from);
    const b = atStartOfDay(until || from);
    return Math.max(1, Math.floor((b - a) / dayMs) + 1); // inclusive
  };

  // keep until >= from
  $: if (dateFrom && dateUntil && atStartOfDay(dateUntil) < atStartOfDay(dateFrom)) {
    dateUntil = dateFrom;
  }

  // auto-calc total
  $: if (duration === 'Half') {
    totalDays = 0.5;
    if (dateFrom) dateUntil = dateFrom; // lock same day
  } else {
    totalDays = dateFrom ? diffDays(dateFrom, dateUntil || dateFrom) : 0;
  }

  function onFromChange() {
    if (!dateFrom) return;
    if (duration === 'Half') dateUntil = dateFrom;
    if (!dateUntil) dateUntil = dateFrom;
  }

  async function openLeaveForm(date) {
    const iso = localISO(date); // FIX: use local ISO
    // initialize form state for the clicked date
    leaveType = 'Annual';
    duration  = 'Full';
    dateFrom  = iso;
    dateUntil = iso;
    totalDays = 1;
    attachmentFiles = undefined; // reset

    if (!modal?.open) modal.showModal();
    await tick();
  }

  function submitLeave(e) {
    const fd = new FormData(e.currentTarget);
    if (!e.currentTarget.reportValidity()) return; // blocks submit if Medical has no file
    // TODO: post to backend
    modal?.close();
  }

  // ----- recent -----
  const recent = [
    { id: 1, from: '2024-01-02', to: '2024-01-03', totalDays: 1,   type: 'Annual', status: 'Approved' },
    { id: 2, from: '2024-01-02', to: '2024-01-03', totalDays: 1.0, type: 'Annual', status: 'Approved' }
  ];
  const fmt = (iso) => new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
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
          <div class="legend-item"><span class="chip spent"></span><span>Spent Leave</span></div>
          <div class="legend-item"><span class="chip unspent"></span><span>Unspent Leave</span></div>
        </div>
        <div class="total-line">Total spent: {d.spent}/{d.total}</div>

        {#if d.title === 'Annual Leave Summary'}
          <!-- added carry forward line + tooltip, nothing else touched -->
          <div class="cf-line">
            Carry forward: {d.carryForward ?? 0}/7
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
      <div class="calendar calendar-small">
        <div class="month">
          <div class="nav">
            <button class="nav-btn" on:click={prevYear} aria-label="Previous year">«</button>
            <button class="nav-btn" on:click={prevMonth} aria-label="Previous month">‹</button>
          </div>

          <span aria-live="polite">{monthLabel}</span>

          <div class="nav">
            <button class="nav-btn" on:click={goToday} aria-label="Go to current month">Today</button>
            <button class="nav-btn" on:click={nextMonth} aria-label="Next month">›</button>
            <button class="nav-btn" on:click={nextYear} aria-label="Next year">»</button>
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
            <a class="link" href={`/dashboard/admin/reports/${r.id}`}>Details</a>
          </div>
        {/each}
      </div>
    </div>
  </div>
</main>

<!-- ===== MODAL ===== -->
<dialog bind:this={modal} class="leave-modal" aria-labelledby="leave-title">
  <form method="dialog" class="leave-form" on:submit|preventDefault={submitLeave}>
    <button type="button" class="close-btn" on:click={() => modal.close()} aria-label="Close">✕</button>
    <h2 id="leave-title" class="title">Leave Application Form</h2>

    <label>
      <span>Type</span>
      <!-- bind:value added so we can enforce Medical attachment -->
      <select name="type" bind:value={leaveType} required>
        <option value="Annual">Annual / Emergency</option>
        <option value="Medical">Medical</option>
        <option value="Maternity">Maternity</option>
        <option value="Paternity">Paternity</option>
        <option value="Compassionate">Compassionate A (Death of parent, children, husband, wife)</option>
        <option value="Compassionate">Compassionate B (Death of grandparent, sibling)</option>
        <option value="Marriage">Marriage</option>
        <option value="Hospitalization">Hospitalization</option>
      </select>
    </label>

    <!-- keep position/order of these inputs exactly -->
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
          <!-- disabled inputs are NOT posted; send value anyway -->
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
      <!-- only these minimal changes: bind refs, required based on Medical, clear validity on change -->
      <input
        type="file"
        name="attachment"
        bind:this={fileInputEl}
        bind:files={attachmentFiles}
        required={leaveType === 'Medical'}
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
  background: none;       /* remove blue background */
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
  color: #374151;          /* dark gray for text/icon */
  transition: background 0.2s ease;
  margin-top: 2px; /* cuba 2–4px ikut sedap */
}

.info-btn:hover {
  background: #e5e7eb;     /* light gray only when hovered */
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
  .calendar .month .nav{ display:flex; gap:6px; flex-wrap:wrap; }
  .calendar .month .nav-btn{
    border:none; background:#eef2ff; padding:6px 10px; border-radius:8px; cursor:pointer;
    font-weight:700; line-height:1;
  }
  .calendar .month .nav-btn:hover{ background:#e5e7eb; }

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
  .days button.holiday { background: #71c0f5; border-color: #71c0f5; }
  .days button.today.holiday { background: #FFF7CC; }
  /* (Keep styles minimal; just matching Admin’s look) */

  /* recent card */
  .recent-wrap{ display:grid; gap:12px; }
  .recent-item{ border:1px solid var(--ring); border-radius:12px; padding:12px; display:grid; gap:6px; background:#f9fafb; }
  .recent-item .when{ font-weight:700; color:#111827; }
  .recent-item .cols{ display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; font-size:12px; }
  .recent-item .muted{ color:#6b7280; }

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
  .help { color:#6b7280; font-size:12px; display:block; margin-top:4px; }
  .help.warn { color:#b45309; }
</style>
