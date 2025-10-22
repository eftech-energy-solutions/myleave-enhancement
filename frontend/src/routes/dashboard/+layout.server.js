import { error } from '@sveltejs/kit';
import { fetchMalaysiaHolidaysByYear } from '$lib/server/fetchMalaysiaHolidays.js';

function yearsWindow(anchor = new Date().getFullYear()) {
  return [anchor, anchor + 1, anchor + 2];
}

export async function load({ locals }) {
  try {
    // ambil maklumat user (kalau sistem login ada)
    const user = locals.user;

    // ambil public holiday dari API
    const years = yearsWindow();
    const holidaysByYear = await fetchMalaysiaHolidaysByYear(years);

    // return dua data ni untuk semua dashboard (admin, manager, staff)
    return { user, holidaysByYear };
  } catch (e) {
    console.error('Load holidays failed:', e);
    throw error(500, 'Failed to load dashboard data');
  }
}
