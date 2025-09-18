import { redirect } from '@sveltejs/kit';

export async function load({ locals, url }) {
  if (!locals.user) throw redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
  if (locals.user.role !== 'admin') throw redirect(303, '/dashboard');
  return { user: locals.user };
}
