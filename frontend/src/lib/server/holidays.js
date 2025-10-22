// src/lib/server/holidays.js

let cache = {
  loaded: false,
  lastFetch: null,
  byYear: {}
};

const TTL_MS = 24 * 60 * 60 * 1000; // refresh every 24h

function ttlExpired() {
  if (!cache.lastFetch) return true;
  return Date.now() - cache.lastFetch > TTL_MS;
}

// Very small ICS parser for all-day holidays
function parseICS(icsText) {
  const lines = icsText.split(/\r?\n/);
  const byYear = {};
  let inEvent = false, dt = null, summary = null;

  function flush() {
    if (!dt) return;
    const iso = `${dt.slice(0,4)}-${dt.slice(4,6)}-${dt.slice(6,8)}`;
    const y = parseInt(iso.slice(0,4));
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push({ date: iso, name: summary || 'Public Holiday' });
  }

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { inEvent = true; dt = null; summary = null; continue; }
    if (line === 'END:VEVENT') { inEvent = false; flush(); continue; }
    if (!inEvent) continue;

    if (line.startsWith('DTSTART')) {
      const m = line.match(/DTSTART(?:;VALUE=DATE)?:(\d{8})/);
      if (m) dt = m[1];
    }
    if (line.startsWith('SUMMARY:')) {
      summary = line.slice(8);
    }
  }
  return byYear;
}

async function fetchICS(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch holidays ICS: ${res.status}`);
  return await res.text();
}

export async function getHolidays(yearsAhead = 5) {
  const url = process.env.HOLIDAYS_ICS_URL; // set in your .env
  if (!url) throw new Error('HOLIDAYS_ICS_URL not set');

  if (!cache.loaded || ttlExpired()) {
    const ics = await fetchICS(url);
    const all = parseICS(ics);

    const now = new Date();
    const startYear = now.getFullYear();
    const endYear = startYear + yearsAhead;

    const byYear = {};
    for (let y = startYear; y <= endYear; y++) {
      byYear[y] = all[y] || [];
    }

    cache = {
      loaded: true,
      lastFetch: Date.now(),
      byYear
    };
  }

  return cache.byYear;
}
