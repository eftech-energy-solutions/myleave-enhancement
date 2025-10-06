// src/routes/dashboard/admin/+layout.server.js
import { redirect } from '@sveltejs/kit';

export const load = ({ url, locals }) => {
  // if you don’t have auth yet, comment these two lines temporarily
  // if (!locals.user) throw redirect(302, '/login');
  // if (locals.user.role !== 'admin') throw redirect(302, '/dashboard');

  if (url.pathname === '/dashboard/manager') {
    throw redirect(302, '/dashboard/manager/main');
  }
  return { user: locals.user ?? null };
};
