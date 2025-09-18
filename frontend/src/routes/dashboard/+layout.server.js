// routes/dashboard/+layout.server.js
export async function load({ locals }) {
  return { user: locals.user }; // { email, role } from hooks.server.js
}
