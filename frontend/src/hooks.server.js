/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  const email = event.cookies.get('session') || null;
  const role  = event.cookies.get('role') || null;
  event.locals.user = email && role ? { email, role } : null;

  // ❗ Only block dashboard when not logged in.
  if (event.url.pathname.startsWith('/dashboard') && !event.locals.user) {
    return Response.redirect(new URL('/login', event.url), 303);
  }

  // ✅ Do NOT auto-redirect /login to a dashboard. Let user see login first.
  return resolve(event);
}
