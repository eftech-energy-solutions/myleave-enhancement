// src/routes/dashboard/admin/+layout.server.js
import { redirect } from '@sveltejs/kit';

export const load = ({ url, locals }) => {
  // Uncomment these if you have auth in place
  // if (!locals.user) throw redirect(302, '/login');
  // if (locals.user.role !== 'admin') throw redirect(302, '/dashboard');

  return { user: locals.user ?? null };
};
