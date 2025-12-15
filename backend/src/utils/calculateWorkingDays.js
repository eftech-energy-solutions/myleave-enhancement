import pool from "../db.js";
import { fetchMalaysiaHolidays } from "./fetchMalaysiaHolidays.js";

/**
 * Calculate working days between two dates, excluding:
 * - Weekends (Saturday & Sunday)
 * - Official Malaysia holidays (not hidden)
 * - Custom public holidays added by admin
 * 
 * @param {string} startDate - Format: YYYY-MM-DD
 * @param {string} endDate - Format: YYYY-MM-DD
 * @returns {Promise<number>} - Number of working days
 */
export async function calculateWorkingDays(startDate, endDate) {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Invalid date format");
    }

    if (start > end) {
      throw new Error("Start date must be before or equal to end date");
    }

    // Fetch all holidays (official + custom, minus hidden)
    const holidays = await getAllHolidays();
    const holidaySet = new Set(holidays.map(h => h.date));

    let workingDays = 0;
    const current = new Date(start);

    // Loop through each day in the range
    while (current <= end) {
      const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
      const dateStr = formatDate(current);

      // Check if it's NOT a weekend and NOT a holiday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = holidaySet.has(dateStr);

      if (!isWeekend && !isHoliday) {
        workingDays++;
      }

      // Move to next day
      current.setDate(current.getDate() + 1);
    }

    return workingDays;
  } catch (error) {
    console.error("Error calculating working days:", error);
    throw error;
  }
}

/**
 * Get all holidays (official minus hidden + custom)
 * Same logic as your GET /api/holidays route
 */
async function getAllHolidays() {
  // Fetch official Malaysia holidays
  const official = await fetchMalaysiaHolidays();

  // Get hidden official holidays
  const { rows: hidden } = await pool.query(
    "SELECT uid, date::text FROM holiday_overrides WHERE action='hide'"
  );
  const hiddenSet = new Set(hidden.map(h => `${h.uid}|${h.date}`));

  // Filter out hidden holidays
  const visibleOfficial = official.filter(
    h => !hiddenSet.has(`${h.uid}|${h.date}`)
  );

  // Get custom holidays
  const { rows: custom } = await pool.query(
    "SELECT date::text FROM public_holidays"
  );

  // Combine all holidays
  const allHolidays = [
    ...visibleOfficial.map(h => ({ date: h.date })),
    ...custom
  ];

  return allHolidays;
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Check if a specific date is a working day
 * @param {string} date - Format: YYYY-MM-DD
 * @returns {Promise<boolean>}
 */
export async function isWorkingDay(date) {
  const d = new Date(date);
  const dayOfWeek = d.getDay();

  // Check weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  // Check holidays
  const holidays = await getAllHolidays();
  const isHoliday = holidays.some(h => h.date === date);

  return !isHoliday;
}

/**
 * Get list of non-working days in a date range
 * Useful for showing blocked dates in UI
 * @param {string} startDate - Format: YYYY-MM-DD
 * @param {string} endDate - Format: YYYY-MM-DD
 * @returns {Promise<Array>} - Array of dates with reasons
 */
export async function getNonWorkingDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const holidays = await getAllHolidays();
  const holidaySet = new Set(holidays.map(h => h.date));

  const nonWorkingDays = [];
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = formatDate(current);

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      nonWorkingDays.push({
        date: dateStr,
        reason: dayOfWeek === 0 ? "Sunday" : "Saturday",
        type: "weekend"
      });
    } else if (holidaySet.has(dateStr)) {
      nonWorkingDays.push({
        date: dateStr,
        reason: "Public Holiday",
        type: "holiday"
      });
    }

    current.setDate(current.getDate() + 1);
  }

  return nonWorkingDays;
}