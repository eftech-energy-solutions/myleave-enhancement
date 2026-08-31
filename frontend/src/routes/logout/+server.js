import { redirect } from '@sveltejs/kit';
export const GET = ({ cookies }) => {
  cookies.delete('session', { path: '/' });
  cookies.delete('role',    { path: '/' });
  throw redirect(303, '/login');
};
