import { fail, redirect } from '@sveltejs/kit';

const USERS = {
  'admin@demo.com':   { password: 'admin123',    role: 'admin',    redirect: '/dashboard/admin' },
  'director@demo.com':{ password: 'director123', role: 'director', redirect: '/dashboard/director' },
  'manager@demo.com': { password: 'manager123',  role: 'manager',  redirect: '/dashboard/manager' },
  'staff@demo.com':   { password: 'staff123',    role: 'staff',    redirect: '/dashboard/staff' }
};

export const actions = {
  default: async ({ request, cookies }) => {
    const fd = await request.formData();
    const email = String(fd.get('username') || '').trim().toLowerCase(); // your UI uses "username" input
    const password = String(fd.get('password') || '').trim();

    const record = USERS[email];
    if (!record || record.password !== password) {
      return fail(400, { error: 'Invalid email or password' });
    }

    // Minimal session via cookies (dev-friendly; set secure:true on HTTPS)
    cookies.set('session', email, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 60 * 60 * 8
    });
    cookies.set('role', record.role, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 60 * 60 * 8
    });

    throw redirect(303, record.redirect);
  }
};
