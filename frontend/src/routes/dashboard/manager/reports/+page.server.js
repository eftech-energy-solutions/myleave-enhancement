// src/routes/dashboard/admin/main/+page.server.js

/** First Monday of a given month (0=Jan) */
function firstMonday(year, monthIndex) {
  const d = new Date(year, monthIndex, 1);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const offset = (8 - day) % 7; // days to Monday (1)
  d.setDate(1 + offset);
  return d;
}

/** If the given date falls on Sunday, return the next day (in-lieu); else null */
function inLieuIfSunday(date) {
  if (date.getDay() === 0) { // Sunday
    const n = new Date(date);
    n.setDate(n.getDate() + 1);
    return n;
  }
  return null;
}

/** Format YYYY-MM-DD (local) */
function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Minimal-but-correct fixed-date KL holidays for a given year */
function getKLFixedHolidays(year) {
  const items = [];

  // 1) New Year's Day (Jan 1)
  items.push({ date: iso(new Date(year, 0, 1)), name: "New Year's Day" });

  // 2) Federal Territory Day (Feb 1) - KL/Putrajaya/Labuan
  items.push({ date: iso(new Date(year, 1, 1)), name: 'Federal Territory Day' });

  // 3) Labour Day (May 1)
  items.push({ date: iso(new Date(year, 4, 1)), name: 'Labour Day' });

  // 4) YDPA (Agong) Birthday - first Monday of June
  const agong = firstMonday(year, 5);
  items.push({ date: iso(agong), name: "YDP Agong's Birthday" });

  // 5) Merdeka Day (Aug 31) + in-lieu if Sunday
  const merdeka = new Date(year, 7, 31);
  items.push({ date: iso(merdeka), name: 'Merdeka Day' });
  const merdekaLieu = inLieuIfSunday(merdeka);
  if (merdekaLieu) items.push({ date: iso(merdekaLieu), name: 'Merdeka Day (in lieu)' });

  // 6) Malaysia Day (Sep 16)
  items.push({ date: iso(new Date(year, 8, 16)), name: 'Malaysia Day' });

  // 7) Christmas Day (Dec 25)
  items.push({ date: iso(new Date(year, 11, 25)), name: 'Christmas Day' });

  // NOTE: Movable/religious holidays (CNY, Aidilfitri, Haji, Awal Muharram,
  // Maulidur Rasul, Wesak, Thaipusam, Nuzul Al-Quran) need an external source.
  return items;
}

/** Build rolling [currentYear .. currentYear+5] holiday map (fixed dates only) */
function buildHolidaysByYear() {
  const startYear = new Date().getFullYear();
  const endYear = startYear + 5;
  const byYear = {};
  for (let y = startYear; y <= endYear; y++) {
    byYear[y] = getKLFixedHolidays(y);
  }
  return byYear;
}

/** Known movable KL holidays (example: your 2025 list) to merge in when available */
function getKnownMovableFor(year) {
  if (year !== 2025) return [];
  return [
    { date: '2025-01-29', name: 'Chinese New Year (Day 1)' },
    { date: '2025-01-30', name: 'Chinese New Year (Day 2)' },
    { date: '2025-02-11', name: 'Thaipusam' },
    { date: '2025-03-18', name: 'Nuzul Al-Quran' },
    { date: '2025-03-31', name: 'Hari Raya Aidilfitri' },
    { date: '2025-04-01', name: 'Hari Raya Aidilfitri (Day 2)' },
    { date: '2025-05-12', name: 'Wesak Day' },
    { date: '2025-06-02', name: "YDP Agong's Birthday" }, // same as fixed calc for 2025 but okay to duplicate-check
    { date: '2025-06-07', name: 'Hari Raya Haji' },
    { date: '2025-06-27', name: 'Awal Muharram' },
    { date: '2025-09-05', name: 'Maulidur Rasul' },
    { date: '2025-10-20', name: 'Deepavali' }
  ];
}

/** Merge helper to avoid duplicate dates with different labels */
function mergeHolidayLists(base = [], extra = []) {
  const seen = new Set(base.map(h => `${h.date}|${h.name}`));
  const out = [...base];
  for (const h of extra) {
    const key = `${h.date}|${h.name}`;
    if (!seen.has(key)) out.push(h);
  }
  // Optional: sort by date
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export const load = async ({ locals }) => {
  const user = locals.user ?? { name: 'admin', role: 'admin', id: 'U001', staffId: 'E8505' };

  // Dummy per-staff carry-forward (0..7)
  const carryForwardAnnual = 5;

  // Donuts (Annual includes carryForward)
  const donuts = [
    { title: 'Annual Leave Summary',          spent: 3, total: 14, carryForward: carryForwardAnnual },
    { title: 'Medical Leave Summary',         spent: 0, total: 14 },
    { title: 'Hospitalization Leave Summary', spent: 0, total: 60 }
  ];

  // Rolling 5-year holidays (fixed dates) + merge known 2025 movable holidays
  const holidaysByYear = buildHolidaysByYear();
  if (holidaysByYear[2025]) {
    holidaysByYear[2025] = mergeHolidayLists(holidaysByYear[2025], getKnownMovableFor(2025));
  }

  return { user, donuts, holidaysByYear };
};