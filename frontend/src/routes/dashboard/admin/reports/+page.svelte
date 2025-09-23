<script>
  import { onMount, tick } from 'svelte';
  export let data; // comes from +layout.server.js -> { user }

  // ----- user/profile -----
  const user = data?.user ?? { name: 'admin', role: 'Human Resources', staffId: 'E8505' };
  const initials = (name) => (name || 'A B').split(' ').map(x => x[0]).slice(0,2).join('').toUpperCase();
  let profileMenuOpen = false;

  // click-outside action for dropdown
  function clickOutside(node) {
    const onClick = (e) => { if (!node.contains(e.target)) profileMenuOpen = false; };
    document.addEventListener('click', onClick);
    return { destroy: () => document.removeEventListener('click', onClick) };
  }

  // ----- donuts -----
  const donuts = [
    { title: 'Annual Leave Summary',          spent: 1,  total: 14 },
    { title: 'Medical Leave Summary',         spent: 0,  total: 14 },
    { title: 'Hospitalization Leave Summary', spent: 0,  total: 60 }
  ];
  const pct = (s, t) => Math.min(100, Math.max(0, Math.round((s / t) * 100)));

  // ----- calendar helpers -----
  const atStartOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const sameDay = (a, b) => atStartOfDay(a).getTime() === atStartOfDay(b).getTime();

  let today = atStartOfDay(new Date());
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
      arr.push({
        key: d.toISOString().slice(0,10),
        label: d.getDate(),
        date: d,
        muted: d.getMonth() !== m,
        today: sameDay(d, today)
      });
    }
    monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(first);
    days = arr;
  }
  onMount(() => buildMonth(new Date()));

  // ===== Leave form state (auto-calc total) =====
  let duration = 'Full';     // 'Full' | 'Half'
  let dateFrom = '';
  let dateUntil = '';
  let totalDays = 1;

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
    const iso = atStartOfDay(date).toISOString().slice(0,10);
    // initialize form state for the clicked date
    duration = 'Full';
    dateFrom = iso;
    dateUntil = iso;
    totalDays = 1;

    if (!modal?.open) modal.showModal();
    await tick();
  }

  function submitLeave(e) {
    const fd = new FormData(e.currentTarget);
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
  <!-- HEADER (simple row, no boxed container) -->
  <div class="topbar">
    <div class="title-wrap">
      <div class="hello">Welcome back, {user?.name || 'admin'}!</div>
      <h1 class="page-title">My Dashboard</h1>
    </div>

    <div class="profile" use:clickOutside>
      <button class="icon-btn bell" aria-label="Notifications">🔔</button>

      <div class="profile-info">
        <img src="/images/icontest1.png" alt="" class="avatar-img"
             on:error={(e)=> e.currentTarget.style.display='none'} />
        <div class="who">
          <div class="name">{user?.name || 'Afiq Mikail'}</div>
          <div class="sub">{user?.role || 'Human Resources'}</div>
          <div class="sub">#{user?.staffId || 'E8505'}</div>
        </div>
      </div>

      <button
        class="icon-btn caret"
        aria-haspopup="menu"
        aria-expanded={profileMenuOpen}
        on:click={() => (profileMenuOpen = !profileMenuOpen)}
        aria-label="Open profile menu"
      >▾</button>

      {#if profileMenuOpen}
        <div class="menu" role="menu">
          <a role="menuitem" href="/dashboard/admin/profile">Update Profile</a>
        </div>
      {/if}
    </div>
  </div>

  <!-- ===== DONUT ROW HEADER: Download on top-right ===== -->
  <div class="donut-row-header">
    <a class="download" href="#">Download</a>
  </div>

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
      </div>
    {/each}

    <!-- Bottom: Calendar (4) + Recent (8) -->
    <div class="card" style="grid-column: span 4;">
      <h3>Calendar of Application</h3>
      <div class="calendar calendar-small">
        <div class="month">{monthLabel}</div>

        <div class="weekdays">
          <div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div>
          <div>Fri</div><div>Sat</div><div>Sun</div>
        </div>

        <div class="days">
          {#each days as d (d.key)}
            <button
              class:muted={d.muted}
              class:today={d.today}
              disabled={atStartOfDay(d.date) < today}
              on:click={() => openLeaveForm(d.date)}
              aria-label={`Select ${d.date.toDateString()}`}
            >
              {d.label}
            </button>
          {/each}
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
      <select name="type" required>
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
        <input type="date" name="dateFrom" bind:value={dateFrom} required on:change={onFromChange} />
      </label>

      <label>
        <span>Date until</span>
        <input
          type="date"
          name="dateUntil"
          bind:value={dateUntil}
          min={dateFrom}
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
    <label><span>Attachment</span><input type="file" name="attachment" /></label>

    <button type="submit" class="submit-btn">SUBMIT</button>
  </form>
</dialog>

<style>
  /* page container */
  .main { padding: 18px; }

  /* donut-row header */
  .donut-row-header{
    display:flex; justify-content:flex-end; align-items:center;
    margin: 12px 0 6px;
  }

  /* grid spacing */
  .grid{ margin-top:6px; display:grid; gap:10px; grid-template-columns:repeat(12, minmax(0,1fr)); }

  /* profile cluster + dropdown */
  .profile{ position:relative; display:flex; align-items:center; gap:10px; }
  .icon-btn{ border:none; background:transparent; cursor:pointer; font-size:18px; line-height:1; padding:6px; border-radius:8px; color:#fff; }
  .icon-btn:hover{ background:rgba(255,255,255,.12); }
  .profile-info{ display:flex; align-items:center; gap:10px; color:#fff; position:relative; }
  .avatar-img{ height:70px; width:70px; border-radius:9999px; display:block; box-shadow:0 0 0 2px rgba(255,255,255,.25); }
  .who .name{  font-size: 20px; font-weight:700; }
  .who .sub{ font-size:16px; opacity:.95; }
  .caret{ font-size:16px; }
  .profile .menu{
    position:absolute; right:0; top:calc(100% + 8px);
    background:#fff; border:1px solid var(--ring); border-radius:10px; box-shadow:var(--shadow);
    min-width:200px; padding:6px; z-index:30;
  }
  .profile .menu a{ display:block; padding:10px 12px; border-radius:8px; color:#111827; font-weight:600; text-decoration:none; }
  .profile .menu a:hover{ background:#f3f4f6; }
  @media (max-width:640px){ .who .sub{ display:none; } }

  /* donut colors & size */
  :global(:root){ --spentRed:#ef4444; --restBlue:#3b82f6; }
  .donut.fancy{
    height: var(--size, 110px); width: var(--size, 110px);
    border-radius:9999px; margin:6px auto 8px;
    background: conic-gradient(var(--spent-color, #ef4444) calc(var(--spent) * 1%), var(--rest-color, #3b82f6) 0);
    display:grid; place-items:center; box-shadow:var(--shadow);
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

  /* calendar sizing */
  .calendar-small{ max-width:360px; margin:0 auto; }
  .calendar-small .days button{ padding:6px; }

  /* recent card */
  .recent-wrap{ display:grid; gap:12px; }
  .recent-item{ border:1px solid var(--ring); border-radius:12px; padding:12px; display:grid; gap:6px; background:#f9fafb; }
  .recent-item .when{ font-weight:700; color:#111827; }
  .recent-item .cols{ display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; font-size:12px; }
  .recent-item .muted{ color:#6b7280; }

  .download {
    color: #fff;
    text-decoration: underline;
    font-size: 14px;
  }
  .download:hover { opacity: 0.85; }

  /* row layout */
  .topbar{
    display:flex;
    align-items:flex-start;        /* keep right cluster aligned to top */
    justify-content:space-between; /* left title vs right profile */
    gap: 16px;
    margin-bottom: 8px;            /* tiny space before donut row */
  }

  /* left side */
  .title-wrap{ color:#fff; }
  .hello{
    font-size:18px;
    font-weight:400;
    margin: 4px 0 6px;
    opacity:.95;
  }
  .page-title{
    margin:0;
    font-size:60px;      /* big like your ref */
    line-height:0.80;
    color:#fff;
    letter-spacing:.3px;
  }

  /* right side cluster (reuses your existing profile/dropdown styles) */
  .profile{ position:relative; display:flex; align-items:center; gap:10px; }
  .icon-btn{ border:none; background:transparent; cursor:pointer; font-size:18px; line-height:1; padding:6px; border-radius:8px; color:#fff; }
  .icon-btn:hover{ background:rgba(255,255,255,.12); }
  .profile-info{ display:flex; align-items:center; gap:10px; color:#fff; }
  .avatar-img{ box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25); }
  .who .name{ font-weight:700; color:#fff; }
  .who .sub{ font-size:12px; opacity:.95; color:#fff; }
  .caret{ font-size:16px; color:#fff; }

  .profile .menu{
    position:absolute; right:0; top:calc(100% + 8px);
    background:#fff; border:1px solid var(--ring); border-radius:10px; box-shadow:var(--shadow);
    min-width:200px; padding:6px; z-index:30;
  }
  .profile .menu a{ display:block; padding:10px 12px; border-radius:8px; color:#111827; font-weight:600; text-decoration:none; }
  .profile .menu a:hover{ background:#f3f4f6; }

  /* responsive tweak: reduce title on small screens */
  @media (max-width: 740px){
    .page-title{ font-size:40px; }
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
</style>
