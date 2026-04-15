import adapter from 'svelte-kit-sst';
import { sveltePreprocess } from 'svelte-preprocess';
import path from 'path';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: [sveltePreprocess({ postcss: true })],

	kit: {
		adapter: adapter(),
		// Base path for deployment behind API Gateway custom domain mappings.
		// e.g., test-apps.dsco.io/botmonAlpha → paths.base = '/botmonAlpha'
		// Set via SVELTE_BASE_PATH env var; empty for local dev.
		// The HTTP_PROXY integration restores the stripped prefix via
		// requestParameters, so SvelteKit receives the full path natively.
		paths: {
			base: process.env.SVELTE_BASE_PATH || '',
			// Absolute CloudFront URL for static assets. When deployed behind
			// API Gateway, assets can't be served through the path mapping.
			// Set via SVELTE_ASSETS_URL; empty for local dev (relative paths).
			assets: process.env.SVELTE_ASSETS_URL || '',
		},
		alias: {
			$lib: path.resolve('./src/lib'),
			$ui: path.resolve("./src/lib/client/components/ui"),
			$client: path.resolve('./src/lib/client'),
			$comps: path.resolve('./src/lib/client/components'),
		}
	}
};

export default config;
