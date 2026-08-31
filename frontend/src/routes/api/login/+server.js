import { json } from '@sveltejs/kit';

// hard-coded users
const users = {
  'admin@demo.com':    { password: 'admin123', role: 'admin', name: 'Alice Admin' },
  'director@demo.com': { password: 'director123', role: 'director', name: 'Dan Director' },
  'manager@demo.com':  { password: 'manager123', role: 'manager', name: 'Maya Manager' },
  'staff@demo.com':    { password: 'staff123', role: 'staff', name: 'Sam Staff' }
};

export async function POST({ request, cookies }) {
  const { email, password } = await request.json();
  const user = users[email];

  if (!user || user.password !== password) {
    return json({ success: false, message: 'Invalid email or password' }, { status: 401 });
  }

  // For demo: store role in a cookie (fake JWT/session)
  cookies.set('auth_token', JSON.stringify({ email, role: user.role, name: user.name }), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 60 * 60 * 8
  });

  return json({ success: true });
}
