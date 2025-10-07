// src/routes/dashboard/admin/main/+page.server.js
import { error } from '@sveltejs/kit';

export const load = async ({ locals }) => {
  try {
    const user = locals.user ?? { name: 'admin', role: 'admin', id: 'U001', staffId: 'E8505' };

    // Keep ONLY manager/admin-specific data here (e.g., donuts, stats, approvals)
    const carryForwardAnnual = 5;
    const donuts = [
      { title: 'Annual Leave Summary',          spent: 3, total: 14, carryForward: carryForwardAnnual },
      { title: 'Medical Leave Summary',         spent: 0, total: 14 },
      { title: 'Hospitalization Leave Summary', spent: 0, total: 60 }
    ];

    // ❌ DO NOT build holidays here anymore.
    // ✅ Holidays now come from /dashboard/+layout.server.js as data.holidaysByYear

    return { user, donuts };
  } catch (e) {
    console.error(e);
    throw error(500, 'Failed to load page');
  }
};
