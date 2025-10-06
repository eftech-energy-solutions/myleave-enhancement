// src/routes/dashboard/admin/+page.server.js
import { error } from '@sveltejs/kit';
import { fetchMalaysiaHolidaysByYear } from '$lib/server/fetchMalaysiaHolidays';

function yearsWindow(anchor = new Date().getFullYear()) {
  return [anchor, anchor + 1, anchor + 2];
}

export async function load() {
  try {
    const years = yearsWindow();
    const holidaysByYear = await fetchMalaysiaHolidaysByYear(years);

    // if you also store Additional Leave in your DB, merge it here later
    return { holidaysByYear };
  } catch (e) {
    console.error('Load holidays failed:', e);
    throw error(500, 'Failed to load dashboard');
  }
}
