// src/routes/+layout.server.js
import { redirect } from '@sveltejs/kit';

export const load = async ({ locals, url }) => {
  const user = locals.user;
  const isLogin = url.pathname.startsWith('/login');
  if (!user && !isLogin) throw redirect(302, '/login');
  if (user && isLogin) throw redirect(302, '/dashboard');
  return { user };
};
