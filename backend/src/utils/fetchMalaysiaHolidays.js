import ical from "node-ical";

const ICS_URL =
  "https://calendar.google.com/calendar/ical/en.malaysia%23holiday@group.v.calendar.google.com/public/basic.ics";

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function fetchMalaysiaHolidays() {
  const data = await ical.async.fromURL(ICS_URL);
  const out = [];
  for (const k in data) {
    const ev = data[k];
    if (ev?.type === "VEVENT" && ev.start) {
      out.push({
        uid: ev.uid || k,                  // <-- IMPORTANT for hiding
        date: ymd(ev.start),
        title: ev.summary || "Public Holiday",
        description: "Official Malaysia public holiday",
        source: "official"
      });
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}