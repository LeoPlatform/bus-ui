import { json } from "@sveltejs/kit";
import {
  type AuthConfig,
  type AuthProviderType,
  defaultAuthConfig,
  loadAuthConfigFromEnv,
  loadAuthConfigFromExternalSource,
  loadAuthConfigFromLocal,
} from "$lib/auth/config";
import { AUTH_CONFIG_SOURCE, LOCAL } from "$env/static/private";

// Cache auth config to avoid redundant loading
let cachedAuthConfig: AuthConfig | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

async function getAuthConfig(): Promise<AuthConfig> {
  const now = Date.now();

  // Return cached config if it's still valid
  if (cachedAuthConfig && now - cacheTime < CACHE_TTL) {
    return cachedAuthConfig;
  }

  // Load auth config
  let config = loadAuthConfigFromEnv();

  // Try to load from remote source if specified
  try {
    if (AUTH_CONFIG_SOURCE && !LOCAL) {
        config = await loadAuthConfigFromExternalSource(AUTH_CONFIG_SOURCE);
    } else {
      config = await loadAuthConfigFromLocal(AUTH_CONFIG_SOURCE);
    }
  } catch (error) {
    console.error("Failed to load auth config from source:", error);
    // Fall back to env config
  }

  // Update cache
  cachedAuthConfig = config;
  cacheTime = now;

  return config;
}

export async function GET() {
  const config = await getAuthConfig();

  // Filter enabled providers
  const enabledProviders = Object.entries(config.providers)
    .filter(([_, providerConfig]) => providerConfig.enabled)
    .map(([key]) => key as AuthProviderType);

  return json(enabledProviders);
}
