<script>
  import { onMount, tick } from 'svelte';
  // export let data; // DIBUANG: Komponen ini akan memuatkan data sendiri.
  const leaveTypeFullName = {
    AL: "Annual / Emergency",
    MC: "Medical",
    MAT: "Maternity",
    PAT: "Paternity",
    COMP_A: "Compassionate A (Parent/Child/Spouse)",
    COMP_B: "Compassionate B (Grandparent/Sibling)",
    MAR: "Marriage",
    HOSP: "Hospitalization",
    UNPAID: "Unpaid Leave"
  };

  function getLeaveFullName(code) {
    return leaveTypeFullName[code] || code;
  }

function calculateWorkingDays(fromDate, toDate) {
    if (!fromDate || !toDate) return 0;
    
    const start = new Date(fromDate);
    const end = new Date(toDate);
    
    let count = 0;
    let current = new Date(start);
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      // 0 = Sunday, 6 = Saturday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  }
  // ----- state -----
  let loading = true;
  let error = "";
  let recent = [];
  const formatCF = (x) => Number(x || 0).toString().replace(".0", "");
  let approvedAL = 0;
  let approvedMC = 0;
  let approvedHOSP = 0;
  let usedMC = 0;
  let usedHOSP = 0;
  let totalALUsed = 0;
  let totalMCUsed = 0;
  let totalHOSPUsed = 0;
  let pendingAL = 0;
  let pendingMC = 0;
  let pendingHOSP = 0;


  // ----- user/profile -----
  // 'data' telah dibuang, jadi kita guna nilai lalai secara terus.
  let user = null;
  onMount(async () => {
    try {
      loading = true;

      // 1) USER
      const meRes = await fetch("/api/me", { credentials: "include" });
      user = { ...(await meRes.json()) };
      console.log("HOSP DATA — entitlement:", user?.hosp_entitlement, "balance:", user?.hosp_balance);
      console.log("USER:", user);

      // 2) HOLIDAYS
      await loadHolidays();

      // 3) RECENT (depends on user)
      await loadRecent();
      await loadApprovedUsedDays();
      await loadAppliedLeave();

      // 🔥 force donut refresh after cancellation
      window.addEventListener("dashboardRefresh", async () => {
      await loadRecent();
      await loadAppliedLeave();
});


buildMonth(viewBase);
        buildMonth(viewBase);


      await loadAppliedLeave();
      buildMonth(viewBase);

    } catch (err) {
      console.error("onMount FAILED:", err);
      error = "Failed to load dashboard.";
    } finally {
      loading = false;
    }
  });

  // ----------- DONUT SUMMARY (FIXED) -----------
$: donuts = user ? [
  {
    title: "Annual Leave Summary",
    total: Number(user.leave_entitlement_annual_original ?? 14),
    spent: Number(approvedAL || 0),
    pending: Number(pendingAL || 0),
    
    // ✅ FIX: Check if CF expired
    carryForward: (() => {
      const cfOriginal = Number(user.carry_forward_original ?? 0); // Show 7
      const cfRemaining = Number(user.carry_forward_balance ?? 0); // Show 5
      const expiry = user.carry_forward_expiry ? new Date(user.carry_forward_expiry) : null;
      const today = new Date();
      
      // If expired, show 0 instead of actual balance
      if (expiry && today > expiry) return 0;
      
      return cfRemaining; // Or return `${cfRemaining}/${cfOriginal}` for "5/7" display
    })(),
    
    remaining: (() => {
      const al = Number(user.leave_entitlement_annual ?? 14);
      const remainingCF = Number(user.carry_forward_balance ?? 0); // Already has deductions
      const expiry = user.carry_forward_expiry ? new Date(user.carry_forward_expiry) : null;
      const today = new Date();
      
      const validCF = (expiry && today > expiry) ? 0 : remainingCF;
      
      // ✅ Don't subtract approvedAL - it's already reflected in carry_forward_balance
      return al + validCF;
    })()
  },
  {
    title: "Medical Leave Summary",
    total: Number(user.leave_entitlement_medical_original ?? user.leave_entitlement_medical ?? 14),
    spent: Number(approvedMC || 0),
    pending: Number(pendingMC || 0),  // ✅ ADD THIS
    remaining: Number((user.leave_entitlement_medical_original ?? 14) - (approvedMC || 0) - (pendingMC || 0))
  },
  {
    title: "Hospitalization Leave Summary",
    total: Number(user.hosp_entitlement ?? user.hosp_entitlement_original ?? 60),
    spent: Number(approvedHOSP || 0),
    pending: Number(pendingHOSP || 0),  // ✅ ADD THIS
    remaining: Number((user.hosp_entitlement ?? user.hosp_entitlement_original ?? 60) - (approvedHOSP || 0) - (pendingHOSP || 0))
  }
] : [];



  const pct = (s, t) => Math.min(100, Math.max(0, Math.round((s / t) * 100)));

  // ======= Pengurusan Cuti (Digabung dari API)
  let holidaysByYear = {}; // Akan diisi oleh loadHolidays
  let holidayDatesByYear = {};
  let holidayNamesByYear = {};
  let holidayDescsByYear = {}; // BARU: Untuk simpan description

  // Helpers: date math & local ISO (prevents UTC off-by-one)
  const atStartOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const sameDay = (a, b) => atStartOfDay(a).getTime() === atStartOfDay(b).getTime();

  // Local ISO (YYYY-MM-DD) without timezone conversion
  const localISO = (d) => {
    const x = atStartOfDay(d);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const dd = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  // parse 'YYYY-MM-DD' safely in local time (no UTC drift)
  const parseLocalISO = (iso) => {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, (m - 1), d);
  };

  // Count inclusive days excluding public holidays
  function countDaysExcludingPH(fromISO, untilISO) {
    // ... (Fungsi sedia ada dikekalkan) ...
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
  function isHoliday(d) {
    const y = d.getFullYear();
    const iso = localISO(d);
    return holidayDatesByYear[y]?.has(iso) ?? false;
  }

  function holidayTitle(d) {
    const y = d.getFullYear();
    const iso = localISO(d);
    return holidayNamesByYear[y]?.get(iso) || null;
  }
  // BARU: Fungsi untuk mendapatkan description
  function holidayDescription(d) {
    const y = d.getFullYear();
    const iso = localISO(d);
    return holidayDescsByYear[y]?.get(iso) || null;
  }
async function loadRecent() {
  try {
    // Reload latest user profile
    const meRes = await fetch("/api/me", { credentials: "include" });
    const freshUser = await meRes.json();
    user = { ...freshUser };   // 🚀 SVELTE REACTIVE UPDATE

    // Reload leave records
    // Reload leave records
const res = await fetch("/api/leave-requests", { credentials: "include" });
const all = await res.json();

// 🔻 PASTE HERE — APPROVED LEAVE CALCULATION
approvedAL = all
  .filter(l =>
    String(l.staff_id) === String(user.staff_id) &&
    (
      l.status?.toLowerCase() === "approved" ||
      l.status?.toLowerCase() === "cancellation_pending"
    ) &&
    (l.leave_type === "AL" || l.leave_type === "EL")
  )
  .reduce((sum, l) => sum + Number(l.total_days || 0), 0);

// prevent NaN
approvedAL = Number(approvedAL || 0);


approvedMC = all
  .filter(l =>
    String(l.staff_id) === String(user.staff_id) &&
    l.status?.toLowerCase() === "approved" &&
    l.leave_type === "MC"
  )
  .reduce((sum, l) => sum + Number(l.total_days), 0);

approvedHOSP = all
  .filter(l =>
    String(l.staff_id) === String(user.staff_id) &&
    l.status?.toLowerCase() === "approved" &&
    l.leave_type === "HOSP"
  )
  .reduce((sum, l) => sum + Number(l.total_days), 0);
// 🔺 END OF INSERT

    recent = all
      .filter(l => String(l.staff_id) === String(user.staff_id))
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
          l.status?.toLowerCase() === "approved" ? "Approved" :
          l.status === "rejected" ? "Rejected" :
          l.status === "cancelled" ? "Cancelled" :
          l.status === "cancellation_pending" ? "Cancellation Pending" :
          l.status
      }));

    recent = [...recent];  // force refresh

  } catch (err) {
    console.error("loadRecent ERROR:", err);
  }
}
  // ======= Logik Kalendar
  let minDate = new Date(new Date().getFullYear(), 0, 1);
  let maxDate = new Date(new Date().getFullYear(), 11, 31);
  const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  let minMonthStart = monthStart(minDate);
  let maxMonthStart = monthStart(maxDate);

  let today = atStartOfDay(new Date());
  // ========= 6 BULAN TERAWAL (LIMIT APPLY) =========
  let maxApplyDate = new Date(today);
  maxApplyDate.setMonth(maxApplyDate.getMonth() + 6);
  const maxApplyISO = localISO(maxApplyDate);

  const todayISO = localISO(today);

  let viewBase = atStartOfDay(new Date());
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
  viewBase = clampToWindowMonth(viewBase);

  const canGoPrev = () => monthStart(viewBase) > minMonthStart;
  const canGoNext = () => monthStart(viewBase) < maxMonthStart;
  const isWeekend = (d) => {
  const day = d.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
};

  // let monthLabel = ''; // DIBUANG
  let days = [];
  let modal;

  // Build month grid (6 weeks)
  function buildMonth(base = new Date()) {
    const y = base.getFullYear(), m = base.getMonth();
    const first = new Date(y, m, 1);
    const start = new Date(first);
    // Start on Monday
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));

    const arr = [];
    for (let i = 0; i < 35; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = localISO(d);

      // out-of-window flag
      const outOfWindow = d < minDate || d > maxDate;
      // ❌ BLOCK jika lebih 6 bulan dari tarikh hari ini
      const beyondSixMonths = d > maxApplyDate;
      const hol = isHoliday(d);
      const holName = hol ? holidayTitle(d) : null;
      const holDesc = hol ? holidayDescription(d) : null; // BARU
      const weekend = isWeekend(d);
      const appliedPH = hol && (blockedDates?.has?.(iso) ?? false);

      let title = undefined;
      if (hol) {
        title = holName;
        if (holDesc) title += ` - ${holDesc}`; // Gabung title dan desc
      }

      arr.push({
        key: iso,
        label: d.getDate(),
        date: d,
        muted: d.getMonth() !== m,
        today: sameDay(d, today),
        holiday: hol,
        holidayName: holName,
        holidayDescription: holDesc,
        title: title || (hol ? 'Public Holiday' : null),
        outOfWindow,
        blocked: blockedDates?.has?.(iso) ?? false,
        beyondSixMonths,
        weekend,
        appliedPH,
         limitMessage: beyondSixMonths
          ? "You can only apply for leave within the next 6 months."
          : null
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

  // ======= FUNGSI BARU: Muat turun data dari API
  /**
   * Fetches all holidays, processes them, and rebuilds the calendar.
   */
  async function loadHolidays() {
    loading = true;
    error = "";
    try {
      const res = await fetch("/api/holidays", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load holidays");
      const flatHolidays = await res.json(); // e.g., [{ id, date, title, description }]

      // Transform flat array into the by-year object structure
      const byYear = {};
      for (const hol of flatHolidays) {
        const year = hol.date.slice(0, 4);
        if (!byYear[year]) byYear[year] = [];
        byYear[year].push({
            id: hol.id,
            date: hol.date,
            name: hol.title,
            description: hol.description || '' // Ambil description
        });
      }
      holidaysByYear = byYear;
      
      // Process the new data
      processHolidayData();
      
      // Re-build the calendar view
      // if (!viewBase) {
      //   viewBase = clampToWindowMonth(atStartOfDay(new Date()));
      // }
      // buildMonth(viewBase);

    } catch (e) {
      error = e.message || "Error";
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
    const newHolidayDescsByYear = {}; // BARU
    
    // ⬇️ LOGIK BARU: TAHUN SEMASA + 3 TAHUN (Sama seperti admin)
    const currentYear = new Date().getFullYear();
    const minYear = currentYear;
    const maxYear = currentYear + 3;
    
    // Kemaskini pembolehubah global
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
      newHolidayDescsByYear[y] = new Map(arr.map(h => [h.date, h.description || ''])); // BARU
    }
    
    holidayDatesByYear = newHolidayDatesByYear;
    holidayNamesByYear = newHolidayNamesByYear;
    holidayDescsByYear = newHolidayDescsByYear; // BARU
  }

  // Nav
  function prevMonth() {
    if (!canGoPrev()) return;
    const d = new Date(viewBase);
    d.setMonth(d.getMonth() - 1, 1);
    viewBase = clampToWindowMonth(d);
    buildMonth(viewBase);
  }
  function nextMonth() {
    if (!canGoNext()) return;
    const d = new Date(viewBase);
    d.setMonth(d.getMonth() + 1, 1);
    viewBase = clampToWindowMonth(d);
    buildMonth(viewBase);
  }
  function prevYear() {
    if (!canGoPrev()) return;
    const d = new Date(viewBase);
    d.setFullYear(d.getFullYear() - 1, d.getMonth(), 1);
    viewBase = clampToWindowMonth(d);
    buildMonth(viewBase);
  }
  function nextYear() {
    if (!canGoNext()) return;
    const d = new Date(viewBase);
    d.setFullYear(d.getFullYear() + 1, d.getMonth(), 1);
    viewBase = clampToWindowMonth(d);
    buildMonth(viewBase);
  }
  function goToday() {
    viewBase = clampToWindowMonth(atStartOfDay(new Date()));
    buildMonth(viewBase);
  }

  // ===== Leave form (demo)
  let duration = 'Full';      // 'Full' | 'Half'
  let dateFrom = '';
  let dateUntil = '';
  let totalDays = 1;

  let leaveType = 'AL';
  let requestType = "new";  // default apply leave
  let endLocked = false;

  let attachmentFiles; // FileList
  let fileInputEl;     // <input type="file">
  $: showAttachmentReminder =
    (leaveType === 'MC') && (!attachmentFiles || attachmentFiles.length === 0);

  const fixedDurations = {
    MAT : 98,
    PAT : 7,
    COMP_A: 3,
    COMP_B: 1,
    MAR : 3
};

  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = (from, until) => {
    if (!from) return 0;
    const a = atStartOfDay(from);
    const b = atStartOfDay(until || from);
    return Math.max(1, Math.floor((b - a) / dayMs) + 1); // inclusive
  };
  const addDaysISO = (iso, days) => {
    const d = parseLocalISO(iso); // Guna parseLocalISO
    d.setDate(d.getDate() + (days - 1)); // -1 sebab 'inclusive'
    return localISO(d);
  };

  $: if (dateFrom && dateUntil && parseLocalISO(dateUntil) < parseLocalISO(dateFrom)) {
    dateUntil = dateFrom;
  }
  $: {
  const n = fixedDurations[leaveType];
  endLocked = Boolean(n);

  // ALWAYS reset dateUntil when leaveType changes AND it's a fixed-duration type
  if (dateFrom && endLocked) {
    dateUntil = addDaysISO(dateFrom, n);
  }
}

  $: {
  if (duration === 'Half') {
    totalDays = 0.5;
    if (dateFrom) dateUntil = dateFrom;
  } else if (leaveType === 'MAR') {
    // ✅ FOR MARRIAGE LEAVE: Auto-calculate 3 working days from start date
    totalDays = 3; // Fixed at 3 days
    
    if (dateFrom) {
      // Calculate the end date that gives exactly 3 working days
      let count = 0;
      let current = new Date(dateFrom);
      
      while (count < 3) {
        const dayOfWeek = current.getDay();
        // Count only weekdays (Mon-Fri)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          count++;
        }
        
        // If we haven't reached 3 working days yet, move to next day
        if (count < 3) {
          current.setDate(current.getDate() + 1);
        }
      }
      
      dateUntil = current.toISOString().split('T')[0];
    }
  } else if (endLocked) {
    totalDays = dateFrom ? fixedDurations[leaveType] : 0;
  } else {
    totalDays = dateFrom ? diffDays(parseLocalISO(dateFrom), parseLocalISO(dateUntil || dateFrom)) : 0;
  }
}

  function onFromChange() {
    if (!dateFrom) return;
    if (duration === 'Half') dateUntil = dateFrom;
    if (!dateUntil) dateUntil = dateFrom;
  }

  async function openLeaveForm(date) {
  // Leave type limits
  const limit = {
    AL: Number(user.leave_entitlement_annual_original ?? 14),
    MC: Number(user.leave_entitlement_medical_original ?? 14),
    HOSP: 60,
    MAT: 98,
    PAT: 7,
    COMP_A: 3,
    COMP_B: 1,
    MAR: 3,
    UNPAID: Infinity 
  }[leaveType];

  // Current usage including pending
const totalUsed = {
  AL: totalALUsed,
  MC: totalMCUsed,
  HOSP: totalHOSPUsed,

  // FIXED LEAVE → start as 0 used
  MAT: totalMCUsed,   // OR 0 → lagi selamat 
  PAT: 0,
  COMP_A: 0,
  COMP_B: 0,
  MAR: 0,
  
  UNPAID: 0
}[leaveType];


  // ❌ If max reached, block
  // if (totalUsed >= limit) {
  //   alert(`${getLeaveFullName(leaveType)} limit (${limit} days) has been reached.`);
  //   return;
  // }

  // ✅ Open form normally
  const iso = localISO(date);

  leaveType = leaveType || 'AL'; // keep selected type
  duration  = 'Full';
  dateFrom  = iso;
  dateUntil = iso;
  totalDays = 1;
  attachmentFiles = undefined;

  if (!modal?.open) modal.showModal();
  await tick();
}

// Place this AFTER openLeaveForm function (around line 570)
// DELETE any duplicate submitLeave functions!

async function submitLeave(e) {
  const formEl = e.currentTarget;
  e.preventDefault();

  if (!formEl.reportValidity()) return;

  // ✅ CHECK FOR OVERLAPPING DATES
  const overlapping = checkDateRangeOverlap(dateFrom, dateUntil);
  if (overlapping.length > 0) {
    const dates = overlapping.map(iso => {
      const d = parseLocalISO(iso);
      return d.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }).join(', ');
    
    alert(`You have already applied for leave on the following date(s):\n${dates}\n\nPlease select different dates.`);
    return;
  }
  const limit = {
    AL: Number(user.leave_entitlement_annual_original ?? 14),
    MC: Number(user.leave_entitlement_medical_original ?? 14),
    HOSP: Number(user.hosp_entitlement ?? 60),
    MAT: 98,
    PAT: 7,
    COMP_A: 3,
    COMP_B: 1,
    MAR: 3,
    UNPAID: Infinity
  }[leaveType];

  const totalUsed = {
    AL: totalALUsed,
    MC: totalMCUsed,
    HOSP: totalHOSPUsed,
    MAT: 0,
    PAT: 0,
    COMP_A: 0,
    COMP_B: 0,
    MAR: 0,
    UNPAID: 0
  }[leaveType];

  if (limit !== Infinity && (totalUsed + totalDays) > limit) {
    alert(`${getLeaveFullName(leaveType)} leave application limit (${limit} days) has been reached.`);
    return;
  }

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
      const data = await res.json().catch(() => null);

      if (data?.message) {
        alert(data.message);
      } else {
        alert(
          `${getLeaveFullName(leaveType)} limit exceeded.\n` +
          `Entitlement: ${data?.entitlement || 'N/A'} days\n` +
          `Used: ${data?.used || 'N/A'} days\n` +
          `Requested: ${data?.requested || 'N/A'} days\n\n` +
          `Remaining balance: ${data?.remaining || 'N/A'} days`
        );
      }
      return;
    }

    const created = await res.json().catch(() => null);
    console.log("Leave created:", created);

    alert("Your leave application has been successfully submitted!");

    await loadAppliedLeave();
    buildMonth(viewBase);

    modal?.close();

  } catch (err) {
    console.error("Error submit leave:", err);
    alert("Something went wrong while submitting your leave.");
  }
}

// Continue with fmt function...
const fmt = (iso) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
let blockedDates = new Set();

async function loadAppliedLeave() {
  const res = await fetch("/api/leave-requests", {
    credentials: "include"
  });
  const list = await res.json();
  const allMine = list.filter(r => r.staff_id === user.staff_id);

  totalALUsed = allMine
  .filter(r => ["AL", "EL"].includes(r.leave_type))
  .filter(r => ["approved", "pending", "cancellation_pending"].includes(r.status))
  .reduce((s, r) => s + Number(r.total_days || 0), 0);

  totalMCUsed = allMine
    .filter(r => r.leave_type === "MC")
    .filter(r => ["approved", "pending", "cancellation_pending"].includes(r.status))
    .reduce((s, r) => s + Number(r.total_days || 0), 0);

  totalHOSPUsed = allMine
    .filter(r => r.leave_type === "HOSP")
    .filter(r => ["approved", "pending", "cancellation_pending"].includes(r.status))
    .reduce((s, r) => s + Number(r.total_days || 0), 0);

  blockedDates = new Set();

  list
    .filter(r => r.staff_id === user.staff_id)
    .forEach(r => {
      // Only block if these statuses
      if (["pending", "approved", "cancellation_pending"].includes(r.status)) {
        const start = new Date(r.date_from);
        const end = new Date(r.date_until);

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const iso = localISO(d);

            // ❌ Skip public holiday
            if (isHoliday(d)) continue;

            // ❌ Skip weekend (Sat & Sun)
            if (isWeekend(d)) continue;

            // ✅ Only actual leave days
            blockedDates.add(iso);
          }
      }
    });
}

function checkDateRangeOverlap(fromISO, untilISO) {
  const start = parseLocalISO(fromISO);
  const end = parseLocalISO(untilISO || fromISO);
  
  const overlappingDates = [];
  const current = new Date(start);
  
  while (current <= end) {
    const iso = localISO(current);
    if (blockedDates.has(iso)) {
      overlappingDates.push(iso);
    }
    current.setDate(current.getDate() + 1);
  }
  
  return overlappingDates;
}

async function loadApprovedUsedDays() {
  const res = await fetch("/api/leave-requests", { credentials: "include" });
  const all = await res.json();

  // MC + HOSP behave EXACTLY like AL:
  // Count approved + cancellation_pending
  const active = all.filter(r =>
    String(r.staff_id) === String(user.staff_id) &&
    (
      r.status?.toLowerCase() === "approved" ||
      r.status?.toLowerCase() === "cancellation_pending"
    )
  );

  usedMC = active
    .filter(r => r.leave_type === "MC")
    .reduce((sum, r) => sum + Number(r.total_days || 0), 0);

  usedHOSP = active
    .filter(r => r.leave_type === "HOSP")
    .reduce((sum, r) => sum + Number(r.total_days || 0), 0);
}

</script>
<svelte:head>
  <style>
    body {
      overflow-y: hidden;
    }
  </style>
</svelte:head>
<main class="main">
  <!-- POKOK 'if loading' DIBUANG DARI SINI UNTUK MEMASTIKAN UI SENTIASA KELIHATAN -->
  <div class="grid">
    {#each donuts as d, i}
    <div class="card chart-card" style="grid-column: span 4;">
            <!-- <div class="card" style="grid-column: span 4;"> -->
              <div class="card-header">
        <h3 class="donut-title">{d.title}</h3>

        {#if d.title.toLowerCase().includes('annual')}
          <div class="cf-top">
        <span>Carry forward: {formatCF(d.carryForward)}/{formatCF(user?.carry_forward_original ?? user?.carry_forward_balance_original ?? user?.carry_forward ?? 0)}</span>

        <div class="cf-tip-wrap">
          <button class="info-btn tiny">ⓘ</button>
          <span class="tooltip">
            Carry-forward is capped at 7 days and expires before 1st of April.
          </span>
        </div>
      </div>

{/if}
      </div>
        <div
          class="donut fancy"
          style="--size:110px; --spent:{pct(d.spent,d.total)}; --spent-color: var(--spentRed); --rest-color: var(--restBlue);"
        ></div>
        <div class="legend-row">
          <div class="legend-item"><span class="chip spent"></span><span>Taken Leave</span></div>
          <div class="legend-item"><span class="chip unspent"></span><span>Remaining Leave</span></div>
        </div>
        <div class="total-line">
          Provided: {d.total} |
          Spent: {d.spent} |
          {#if d.pending > 0}
            Pending: {d.pending} |
          {/if}
          Remaining: {d.remaining}
      </div>
      </div>
    {/each}

    <!-- Calendar -->
    <div class="card calendar-card" style="grid-column: span 4;">
      <h3>Leave Application</h3>
      {#if loading}
        <p>Loading holidays...</p>
      {:else if error}
        <p class="text-red-600">{error}</p>
      {:else}
      <div class="calendar calendar-small">
        <div class="month">
          <div class="nav">
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
              class:holiday={d.holiday && !d.appliedPH}
              class:out={d.outOfWindow}
              class:blocked={d.blocked && !d.appliedPH}
              class:applied-ph={d.appliedPH}
              class:weekend={d.weekend && !d.blocked} 
              disabled={
                d.outOfWindow ||
                d.beyondSixMonths ||
                d.holiday ||
                (!d.blocked && d.weekend) ||   // 👈 KEY PART
                (!d.today && atStartOfDay(d.date) < today)
              }
              on:click={() => {
                if (d.beyondSixMonths) {
                  alert("You can only apply for leave within the next 6 months.");
                  return;
                }

                if (d.blocked) {
                  alert("You already applied leave on this date.");
                  return;
                }

                if (d.holiday) {
                  alert("You cannot apply leave on a public holiday.");
                  return;
                }

                if (d.weekend) {
                  alert("You cannot apply for leave on weekends.");
                  return;
                }

                if (!d.today && atStartOfDay(d.date) < today) {
                  alert("You cannot apply for past dates.");
                  return;
                }

                // ✅ Always allow form to open
                openLeaveForm(d.date);
              }}

              title={
                d.limitMessage
                  ? d.limitMessage
                  : d.title
              }
            >
              {d.label}
            </button>
          {/each}
        </div>
        <div class="legend small">
          <span><i class="swatch sw-blue"></i> Public / Additional leave</span>
          <span><i class="swatch sw-applied"></i> Applied Leave</span>
          <span><i class="swatch sw-today"></i> Today</span>
        </div>
      </div>
      {/if}
    </div>

    <!-- Recent -->
    <div class="card recent-card small-card" style="grid-column: span 8;">
      <h3>Recent Application</h3>
      <div class="recent-wrap">
        {#each recent as r}
          <div class="recent-item">
            <div class="when">{fmt(r.from)} – {fmt(r.to)}</div>
            <div class="cols">
              <div><div class="muted">Total Days:</div><div>{r.totalDays}</div></div>
              <div>
              <div class="muted">Leave Type:</div>
              <div>{getLeaveFullName(r.type)}</div>
            </div>
              <div><div class="muted">Status:</div><div>{r.status}</div></div>
            </div>
          </div>
        {/each}
      </div>
      <div class="recent-footer">
  <a class="view-more" href="/dashboard/manager/myhistory">View more →</a>
</div>
    </div>
  </div>
</main>

<!-- Modal -->
<dialog bind:this={modal} class="leave-modal" aria-labelledby="leave-title">
  <form class="leave-form" on:submit={submitLeave}>
    <button type="button" class="close-btn" on:click={() => modal.close()} aria-label="Close">✕</button>
    <h2 id="leave-title" class="title">Leave Application Form</h2>

    <label>
      <span>Type</span>
      <select name="type" bind:value={leaveType} required>
        <option value="AL">Annual / Emergency</option>
        <option value="MC">Medical</option>
        <option value="MAT">Maternity</option>
        <option value="PAT">Paternity</option>
        <option value="COMP_A">Compassionate A (Parent/Child/Spouse)</option>
        <option value="COMP_B">Compassionate B (Grandparent/Sibling)</option>
        <option value="MAR">Marriage</option>
        <option value="HOSP">Hospitalization</option>
        <option value="UNPAID">Unpaid Leave</option>
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
        <input type="date" name="dateFrom" bind:value={dateFrom} required min={todayISO} on:change={onFromChange} />
      </label>

      <label>
        <span>Date until</span>
        <input
          type="date"
          name="dateUntil"
          bind:value={dateUntil}
          min={dateFrom || todayISO}
          disabled={duration === 'Half' || endLocked}
          aria-disabled={duration === 'Half' || endLocked}
          readonly={endLocked}
        />
        {#if duration === 'Half'}
          <input type="hidden" name="dateUntil" value={dateUntil} />
        {/if}
      </label>
    </div>

    <label>
      <span>Total day</span>
      <input type="number" name="totalDays" bind:value={totalDays} min="0.5" step="0.5" required readonly />
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
  .main { padding: 18px; }

  .sw-blue{ background:#71c0f5; border:1px solid #71c0f5; }
  .sw-today{ background:#fff; border:1px solid #49bdb3; }
  .sw-applied {
  background: #fef08a;   /* yellow */
  border: 1px solid #facc15;
}
  .legend.small{
    display:flex; justify-content:center; gap:14px; margin-top:8px; font-size:11.5px; color:#6b7280;
  }
  .swatch{ display:inline-block; width:14px; height:9px; border-radius:3px; margin-right:6px; vertical-align:middle; }

  .grid{ margin-top:-30px; display:grid; gap:10px; grid-template-columns:repeat(12, minmax(0,1fr)); }

  :global(:root){ --spentRed:#ef4444; --restBlue:#3b82f6; --ring:#e5e7eb; --shadow:0 2px 12px rgba(0,0,0,.06); }
  html, body {
  overflow: hidden;
  height: 100%;
}
  .card{ border:1px solid var(--ring); border-radius:12px; padding:8px; background:#fff; box-shadow:var(--shadow); overflow: visible; }
  .text-red-600 { color: #dc2626; }

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
  .legend-row{ display:flex; gap:18px; justify-content:center; align-items:center; margin:6px 0 2px; font-size:12px; color:#6b7280;  }
  .legend-item{ display:flex; align-items:center; gap:8px;  }
  .chip{ display:inline-block; width:24px; height:8px; border-radius:4px; }
  .chip.spent{ background: var(--spentRed); }
  .chip.unspent{ background: var(--restBlue); }
  .total-line{ text-align:center; font-size:12px; color:#6b7280; margin-top:4px; }

  /* carry-forward line + tooltip (added) */
  .card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.cf-top {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

/* wrap ensures hover works */
.cf-tip-wrap {
  position: relative;
  display: inline-block;
}

.cf-tip-wrap .tooltip {
  position: absolute;
  bottom: -55px; /* boleh adjust */
  left: 50%;
  transform: translateX(-50%);
  background: #111827;
  color: #fff;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 10px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  box-shadow: 0 4px 18px rgba(0,0,0,.2);
  transition: opacity .15s ease;
  z-index: 50;
  white-space: normal;      /* allow multiple lines */
width: max-content;       /* expand naturally */
max-width: 150px;         /* optional — so it wraps instead of going super long */

}

.cf-tip-wrap .tooltip::after {
  content: "";
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-bottom-color: #111827;
}

/* Hover logic */
.cf-tip-wrap:hover .tooltip,
.cf-tip-wrap:focus-within .tooltip {
  opacity: 1;
  visibility: visible;
}


.info-btn.tiny {
  width: 14px;
  height: 14px;
  font-size: 10px;
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
}

.info-btn:hover {
  background: #e5e7eb;    /* light gray only when hovered */
}

.recent-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.view-more {
  font-size: 13px;
  font-weight: 600;
  color: #2563eb;          /* blue */
  cursor: pointer;
}
.view-more:hover {
  color: #1d4ed8;
}

.chart-card {
  padding: 8px 10px;         /* kecilkan padding card */
}

.chart-card .donut.fancy {
  --size: 90px !important;   /* donut kecil (default 110px) */
}

.chart-card .donut-title {
  font-size: 13px !important;
  margin-bottom: 4px;
}

.chart-card .legend-row {
  font-size: 11px !important;
  margin: 4px 0;
}

.chart-card .total-line {
  font-size: 11px !important;
  margin-top: 2px;
}


  .tooltip{
    position:absolute; bottom:130%; left:50%; transform:translateX(-50%);
    background:#111827; color:#fff; padding:6px 8px; border-radius:6px; font-size:12px; white-space:nowrap;
    box-shadow:0 4px 18px rgba(0,0,0,.18); opacity:0; visibility:hidden; transition:opacity .15s, visibility .15s;
    pointer-events:none;
  }
  .tooltip::after{
    content:""; position:absolute; top:100%; left:50%; transform:translateX(-50%);
    border:6px solid transparent; border-top-color:#111827;
  }
  .info-btn:hover + .tooltip, .info-btn:focus + .tooltip{ opacity:1; visibility:visible; }

  .calendar-small{ max-width:370px; margin:0 auto; }
  .calendar .month{
    display:flex; align-items:center; justify-content:space-between;
    font-weight:700; margin-bottom:2px; gap:8px;margin-top: -10px; height: 60px;
  }
.calendar-card {height: 390px;}

  /* --- BARU: Style untuk Dropdown Bulan/Tahun --- */
  /* (Rupa ini disesuaikan agar sepadan dengan .nav-btn manager) */
  .month-select-wrapper {
    display: flex;
    gap: 6px;
    flex-grow: 1; /* Benarkan wrapper membesar */
    justify-content: center; /* Pusatkan dropdowns */
    min-width: 120px; /* Pastikan ia ada ruang */
  }
  .month-select {
    border: none;
    background: #eef2ff;
    padding: 4px 8px; /* Sesuai dengan .nav-btn manager */
    border-radius: 8px;
    cursor: pointer;
    font-weight: 700;
    line-height: 1.4; /* Ketinggian lebih baik untuk <select> */
    font-size: 12px; /* Biar default, sama seperti .nav-btn */
    min-height: 26px;
    /* Overrides khusus untuk <select> */
    padding-right: 28px; /* Ruang untuk arrow */
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.5rem center;
    background-size: 1.25em 1.25em;
    text-align: center;
    flex-grow: 1; /* Bulan ambil baki ruang */
    padding:3px 8px;
  }
  .month-select:hover {
    background: #e5e7eb;
  }
  .month-select.year-select {
    flex-grow: 0; /* Tahun tidak perlu membesar */
    min-width: 65px; /* Lebar tetap untuk tahun */
    padding-left: 10px;
    text-align: left;
    
  }
  /* --- Tamat Style Dropdown --- */

  .calendar .month .nav{ display:flex; gap:6px; flex-wrap:wrap; }
  .calendar .month .nav-btn{
    border:none; background:#eef2ff; padding:3px 8px; border-radius:4px; cursor:pointer;
    font-weight:700; line-height:1; font-size: 10px;
  }
  .calendar .month .nav-btn:hover{ background:#e5e7eb; }
  .nav-btn:disabled{ opacity:.5; cursor:not-allowed; }

  .weekdays{ display:grid; grid-template-columns:repeat(7,1fr); gap:4px; font-size:12px; color:#6b7280; margin-bottom:2px; }
.days{ display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
  .days button{
  height: 43px; /* ✅ kawal tinggi */
  width: 50px;   
  font-size: 13px;
  padding: 4px 4px;
  }

  .days button.today {
    border: 2px solid #49bdb3; font-weight: 700; color: #111827; background: #ffff;
  }
  .days button.muted{ opacity:.5; }
  .days button:disabled{ background:#f3f4f6; color:#9ca3af; cursor:not-allowed; }

  /* Public holiday highlight — SAME as Admin */
  .days button.holiday { background: #71c0f5; border-color: #71c0f5; color: #fff; }
  .days button.today.holiday { background: #71c0f5; }

  /* Out-of-window dates */
  .days button.out {
    background: #f9fafb; color: #9ca3af; border-color: #e5e7eb;
    cursor: not-allowed; opacity: .75;
  }

  .days button.blocked {
  background: #fef08a !important;
  border-color: #facc15 !important; 
  color: #78350f !important;
  cursor: not-allowed !important;
  opacity: 1;
}
.days button.applied-ph {
  background: #fed83fdb !important;   /* pekat */
  border-color: #fed83fdb !important;
  color: #000 !important;
  cursor: not-allowed !important;
}

  .recent-wrap{ display:grid; gap: 6px;  }
  .recent-card { height: 390px;}
  .recent-item{ border:1px solid var(--ring); border-radius:12px; padding:10px; display:grid; gap:6px; background:#f9fafb; }
  .recent-item .when{ font-weight:700; color:#111827; font-size: 13.5px;}
  .recent-item .cols{ display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; font-size:11px; }
  .recent-item .muted{ color:#6b7280; }


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
  
  .leave-form .duration { display:flex; flex-direction:column; gap:.5rem; align-items:flex-start; }
  .leave-form .duration label{ display:inline-flex; flex-direction:row; align-items:center; gap:.5rem; cursor:pointer; text-align:left; font-weight: 400; }
  .leave-form .duration input[type="radio"]{ accent-color:#3FADA4; width:16px; height:16px; margin:0; }
  .leave-form input[readonly], .leave-form input:disabled{ background:#f3f4f6; color:#6b7280; cursor:not-allowed; }
  
  .dates { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

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