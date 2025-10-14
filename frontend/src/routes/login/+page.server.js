import { fail, redirect } from '@sveltejs/kit';

const USERS = {
  'admin@demo.com':   { password: 'admin123',    role: 'admin',    redirect: '/dashboard/admin', name: 'Admin User' },
  'director@demo.com':{ password: 'director123', role: 'director', redirect: '/dashboard/director', name: 'Director Name' },
  'manager@demo.com': { password: 'manager123',  role: 'manager',  redirect: '/dashboard/manager/main', name: 'Manager Name' },
  'staff@demo.com':   { password: 'staff123',    role: 'staff',    redirect: '/dashboard/staff', name: 'Staff Member' }
};

// --- Fungsi Placeholder (gantikan dengan logik sebenar) ---
async function sendEmail({ to, subject, body }) {
  console.log(`--- MENGHANTAR EMEL ---`);
  console.log(`Kepada: ${to}`);
  console.log(`Subjek: ${subject}`);
  console.log(`---------------------`);
}

export const actions = {
  // Tindakan 1: Untuk borang log masuk
  login: async ({ request, cookies }) => {
    const fd = await request.formData();
    const email = String(fd.get('username') || '').trim().toLowerCase();
    const password = String(fd.get('password') || '').trim();

    const record = USERS[email];
    if (!record || record.password !== password) {
      return fail(400, { error: 'Invalid email or password' });
    }

    cookies.set('session', email, { path: '/', httpOnly: true, sameSite: 'lax', secure: false, maxAge: 60 * 60 * 8 });
    cookies.set('role', record.role, { path: '/', httpOnly: true, sameSite: 'lax', secure: false, maxAge: 60 * 60 * 8 });

    throw redirect(303, record.redirect);
  },

  // Tindakan 2: Untuk borang 'Forgot Password'
  forgotPassword: async ({ request }) => {
    const data = await request.formData();
    const email = String(data.get('email') || '').trim().toLowerCase();

    const user = USERS[email];

    if (user) {
      const temporaryPassword = Math.random().toString(36).slice(-8);
      const expiryDate = new Date(Date.now() + 30 * 60 * 1000); // 30 minit dari sekarang

      // Hantar emel kepada pengguna
      await sendEmail({
        to: email,
        subject: 'Your Temporary Password for MyLeave',
        body: `Hi ${user.name}, your temporary password is: ${temporaryPassword}. It is valid for 30 minutes.`
      });

      // Hantar notifikasi kepada admin
      await sendEmail({
        to: 'admin@yourcompany.com',
        subject: `[MyLeave Notification] Password Reset for ${user.name}`,
        body: `A temporary password was just issued for the user: ${user.name} (${email}).`
      });
    }

    // Sentiasa kembalikan mesej kejayaan untuk keselamatan
    return { success: true };
  }
};