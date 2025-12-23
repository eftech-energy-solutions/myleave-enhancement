import { redirect } from '@sveltejs/kit';

export const load = ({ url }) => {
  // Jangan redirect kalau API
  if (url.pathname.startsWith('/api')) {
    return;
  }

  throw redirect(307, '/login');
};
