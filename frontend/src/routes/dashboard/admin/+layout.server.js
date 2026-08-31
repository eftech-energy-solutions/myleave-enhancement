// src/routes/dashboard/admin/+layout.server.js
import { redirect } from '@sveltejs/kit';

export const load = ({ url, locals }) => {
  // if you don’t have auth yet, comment these two lines temporarily
  // if (!locals.user) throw redirect(302, '/login');
  // if (locals.user.role !== 'admin') throw redirect(302, '/dashboard');

  if (url.pathname === '/dashboard/admin') {
    throw redirect(302, '/dashboard/admin/main');
  }
  return { user: locals.user ?? null };
};
