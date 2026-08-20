import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [tailwindcss(), sveltekit()],
    server: {
      allowedHosts: true,
      fs: {
        allow: ['.']
      },
      proxy: {
        '/api': {
          target: env.PUBLIC_VITE_API_BASE,
          changeOrigin: true,
          secure: false
        },
        '/uploads': {
          target: env.PUBLIC_VITE_API_BASE,
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});
