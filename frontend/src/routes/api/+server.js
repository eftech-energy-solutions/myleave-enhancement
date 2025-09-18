import { json } from '@sveltejs/kit';
import { API_BASE } from '$lib/server/env';

export async function POST({ request, cookies, fetch }) {
  const body = await request.json(); // { email, password }

  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();

  if (!res.ok || !data?.success) {
    return json({ success: false, message: data?.message ?? 'Login failed' }, { status: 401 });
  }

  if (data.token) {
    cookies.set('auth_token', data.token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: 60 * 60 * 8
    });
  }

  return json({ success: true });
}
