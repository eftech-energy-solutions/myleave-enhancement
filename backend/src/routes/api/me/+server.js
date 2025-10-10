import { json, redirect } from '@sveltejs/kit';

export async function GET({ cookies }) {
  // baca cookie yang dah set masa login
  const token = cookies.get('auth_token');

  if (!token) {
    // kalau tak ada cookie, redirect ke login
    throw redirect(303, '/login');
  }

  // parse cookie → dapat user info
  const user = JSON.parse(token);

  // hantar balik ke frontend
  return json(user);
}
