
import type { Provider } from '@auth/sveltekit/providers';
import Cognito from '@auth/sveltekit/providers/cognito';
import Google from '@auth/sveltekit/providers/google';
import GitHub from '@auth/sveltekit/providers/github';
import { z } from 'zod';
import { dev } from '$app/environment';
import { readFile } from 'fs/promises';

// Define a schema for auth provider configuration
export const AuthProviderConfigSchema = z.object({
  enabled: z.boolean().default(false),
  id: z.string().optional(),
  secret: z.string().optional(),
  issuer: z.string().optional(),
  clientId: z.string().optional(),
  tenantId: z.string().optional(),
  region: z.string().optional(),
  userPoolId: z.string().optional(),
  scope: z.string().optional(),
  authorization: z.object({
    params: z.record(z.string(), z.any()).optional(),
  }).optional(),
});

export type AuthProviderConfig = z.infer<typeof AuthProviderConfigSchema>;

// Define the available auth providers
export const AvailableAuthProviders = ['cognito', 'google', 'github'] as const;
export type AuthProviderType = typeof AvailableAuthProviders[number];

// Define the schema for the auth configuration
export const AuthConfigSchema = z.object({
  providers: z.record(z.string(), AuthProviderConfigSchema),
  defaultProviders: z.array(z.string()).default([]),
});

export type AuthConfig = z.infer<typeof AuthConfigSchema>;

// Create a default configuration object
export const defaultAuthConfig: AuthConfig = {
  providers: {
    cognito: {
      enabled: false,
    },
    google: {
      enabled: false,
    },
    github: {
      enabled: false,
    },
  },
  defaultProviders: [],
};

// Function to load configuration from environment variables
export function loadAuthConfigFromEnv(): AuthConfig {
  const config = { ...defaultAuthConfig };
  
  // Cognito configuration
  if (process.env.AUTH_COGNITO_ENABLED === 'true') {
    config.providers.cognito = {
      enabled: true,
      region: process.env.AWS_REGION || '',
      userPoolId: process.env.AUTH_COGNITO_USER_POOL_ID || '',
    };
  }
  
  // Google configuration
  if (process.env.AUTH_GOOGLE_ENABLED === 'true') {
    config.providers.google = {
      enabled: true,
      id: process.env.AUTH_GOOGLE_ID || '',
      secret: process.env.AUTH_GOOGLE_SECRET || '',
    };
  }
  
  // GitHub configuration
  if (process.env.AUTH_GITHUB_ENABLED === 'true') {
    config.providers.github = {
      enabled: true,
      id: process.env.AUTH_GITHUB_ID || '',
      secret: process.env.AUTH_GITHUB_SECRET || '',
    };
  }
  
  // Set default providers
  if (process.env.AUTH_DEFAULT_PROVIDERS) {
    config.defaultProviders = process.env.AUTH_DEFAULT_PROVIDERS.split(',');
  }
  
  return config;
}

// Function to load configuration from an external source or API
export async function loadAuthConfigFromExternalSource(source: string | URL): Promise<AuthConfig> {
  try {
    const response = await fetch(source);
    const data = await response.json();
    return AuthConfigSchema.parse(data);
  } catch (error) {
    console.error('Failed to load auth config:', error);
    return defaultAuthConfig;
  }
}

export async function loadAuthConfigFromLocal(source: string): Promise<AuthConfig> {
  try {
    const data = await readFile(source, 'utf-8');
    const obj = JSON.parse(data);
    return AuthConfigSchema.parse(obj);
  } catch (error) {
    console.error('Failed to load auth config:', error);
    return defaultAuthConfig;
  }
}

// Function to get active providers based on configuration
export function getActiveProviders(config: AuthConfig): Provider[] {
  const providers: Provider[] = [];
  
  // Add enabled providers
  for (const [key, providerConfig] of Object.entries(config.providers)) {
    if (!providerConfig.enabled) continue;
    
    switch (key) {
      case 'cognito':
        if (providerConfig.region && providerConfig.userPoolId) {
          providers.push(
            Cognito({
              issuer: `https://cognito-idp.${providerConfig.region}.amazonaws.com/${providerConfig.userPoolId}`,
              clientId: providerConfig.id,
              clientSecret: providerConfig.secret,
              authorization: {
                params: {
                  scope: providerConfig.scope || 'openid email profile'
                }
              }
            })
          );
        }
        break;
      
      case 'google':
        if (providerConfig.id && providerConfig.secret) {
          providers.push(
            Google({
              clientId: providerConfig.id,
              clientSecret: providerConfig.secret,
              authorization: {
                params: {
                  prompt: 'consent',
                  access_type: 'offline',
                  response_type: 'code'
                }
              }
            })
          );
        }
        break;
      
      case 'github':
        if (providerConfig.id && providerConfig.secret) {
          providers.push(
            GitHub({
              clientId: providerConfig.id,
              clientSecret: providerConfig.secret,
            })
          );
        }
        break;
      
      default:
        if (dev) {
          console.warn(`Unknown provider type: ${key}`);
        }
        break;
    }
  }
  
  return providers;
}