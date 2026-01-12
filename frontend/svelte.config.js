import adapter from '@sveltejs/adapter-static';

const config = {
  kit: {
    adapter: adapter({
      fallback: 'index.html'
    }),

    appDir: 'app',   // ✅ BETUL (elak clash dgn /app folder server)

    paths: {
      base: '',
      assets: ''
    }
  }
};

export default config;
