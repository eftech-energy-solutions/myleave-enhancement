import { redirect } from '@sveltejs/kit';

export const load = async ({ locals }) => {
  const user = locals.user;

  if (!user) {
    console.log('❌ No user found in locals, redirecting to /login');
    throw redirect(302, '/login');
  }

  if (user.role.toLowerCase() !== 'admin') {
    console.log(`⚠️ User role "${user.role}" not authorized for admin, redirecting`);
    throw redirect(302, '/dashboard');
  }

  console.log('✅ Admin layout loaded for user:', user);
  return { user };
};
