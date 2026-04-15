import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		proxy: {
			// Proxy DSCO auth token endpoints to avoid CORS in local dev.
			// The client-auth page fetches /dsco-proxy/micro-service/dw-auth-token etc.
			'/dsco-proxy': {
				target: 'https://test-core.dsco.io',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/dsco-proxy/, ''),
				secure: true,
			},
		},
	},
});
