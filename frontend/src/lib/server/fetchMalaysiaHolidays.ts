
import ical from 'node-ical';

const ICS_URL =
  'https://calendar.google.com/calendar/ical/en.malaysia%23holiday@group.v.calendar.google.com/public/basic.ics';

// helper: YYYY-MM-DD without timezone shifts
function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Download and parse ICS, return { [year]: [{date, name}] } */
export async function fetchMalaysiaHolidaysByYear(
  years: number[] // e.g. [2025, 2026, 2027]
) {
  const data = await ical.async.fromURL(ICS_URL);
  // node-ical returns a map of components; VEVENTs are holidays
  const out: Record<number, Array<{ date: string; name: string }>> = {};
  for (const y of years) out[y] = [];

  for (const key of Object.keys(data)) {
    const ev = data[key] as any;
    if (!ev || ev.type !== 'VEVENT') continue;

    // All-day holidays come through as date or dateTime; we want the day portion
    const start: Date | undefined = ev.start;
    if (!start) continue;

    const iso = ymdLocal(start);
    const yr = Number(iso.slice(0, 4));
    if (!years.includes(yr)) continue;

    const name: string = ev.summary || 'Public Holiday';
    out[yr].push({ date: iso, name });
  }

  // optional: sort by date
  for (const y of years) {
    out[y].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  return out;
}
