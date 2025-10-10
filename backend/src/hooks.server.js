// hooks.server.js
import 'dotenv/config';

export const handle = async ({ event, resolve }) => {
  return resolve(event);
};

// export async function handle({ event, resolve }) {
//   const email = event.cookies.get('session') || null;
//   const role  = event.cookies.get('role') || null;

//   const displayFromEmail = (e) => {
//     if (!e) return null;
//     const raw = e.split('@')[0];                    // "afiq.mikail" | "admin"
//     return raw
//       .replace(/[._-]+/g, ' ')                      // dots/underscores -> spaces
//       .split(' ')
//       .filter(Boolean)
//       .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
//       .join(' ');
//   };

//   event.locals.user = email && role
//     ? {
//         id: 'U001',
//         email,
//         role,
//         name: displayFromEmail(email),               // <-- nicer name
//         staffId: 'E8505'                             // optional: add more fields
//       }
//     : null;

//   if (event.url.pathname.startsWith('/dashboard') && !event.locals.user) {
//     return Response.redirect(new URL('/login', event.url), 303);
//   }
//   return resolve(event);
// }
