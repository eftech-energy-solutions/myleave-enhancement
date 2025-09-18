// src/routes/dashboard/+page.server.js
import { redirect } from '@sveltejs/kit';

export const load = async ({ locals }) => {
  const role = locals.user?.role;
  if (!role) throw redirect(302, '/login');

  switch (role.toLowerCase()) {
    case 'admin':
      // send admin to its dashboard root (sidebar handles 2 sub-dashboards)
      throw redirect(302, '/dashboard/admin');
    case 'manager':
      throw redirect(302, '/dashboard/manager');
    case 'staff':
      throw redirect(302, '/dashboard/staff');
    default:
      // unknown role → fallback
      throw redirect(302, '/login');
  }
};
