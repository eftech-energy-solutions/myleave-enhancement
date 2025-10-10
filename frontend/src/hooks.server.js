export const handle = async ({ event, resolve }) => {
  // ambil cookie
  const token = event.cookies.get('auth_token');
  if (token) {
    try {
      event.locals.user = JSON.parse(token);
      console.log('✅ hooks.server.js: user loaded from cookie', event.locals.user);
    } catch (err) {
      console.error('⚠️ hooks.server.js: failed to parse cookie', err);
    }
  } else {
    event.locals.user = null;
  }

  return resolve(event);
};
