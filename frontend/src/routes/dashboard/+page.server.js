import { redirect } from '@sveltejs/kit';

export const load = async ({ locals, url }) => {
  const role = (locals.user?.role || '').toLowerCase();
  if (!role) throw redirect(302, '/login');

  // redirect only if on /dashboard (root)
  if (url.pathname === '/dashboard') {
    switch (role) {
      case 'admin':   throw redirect(302, '/dashboard/admin/main');
      case 'manager': throw redirect(302, '/dashboard/manager');
      case 'staff':   throw redirect(302, '/dashboard/staff');
      default:        throw redirect(302, '/login');
    }
  }

  return { user: locals.user };
};
