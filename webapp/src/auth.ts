import { SvelteKitAuth } from "@auth/sveltekit";
import Cognito from "@auth/sveltekit/providers/cognito";
import Google from "@auth/sveltekit/providers/google";
// Use process.env so build succeeds without .env; set at runtime for auth to work.
const e = () => process.env;
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import { error } from "@sveltejs/kit";
import type { OAuthConfig, OAuthUserConfig } from "@auth/sveltekit/providers";
import {
  getActiveProviders,
  loadAuthConfigFromEnv,
  loadAuthConfigFromExternalSource,
  loadAuthConfigFromLocal,
  type AuthConfig,
} from "$lib/auth/config";

// Define the shape of the profile data your custom provider returns
// export interface CustomProviderProfile extends Record<string, any> {
//   id: string;
//   email: string;
//   name?: string;
//   image?: string;
//   // Add any other fields your provider returns
// }

// Create the custom provider
// export default function CustomProvider(
//   options: OAuthUserConfig<CustomProviderProfile>
// ): OAuthConfig<CustomProviderProfile> {
//   return {
//     id: 'custom', // Unique ID for your provider
//     name: 'Custom Provider', // Display name for your provider
//     type: 'oauth', // Auth type - 'oauth' is most common

//     // The authorization endpoint for your service
//     authorization: {
//       url: 'https://your-custom-auth-service.com/oauth/authorize',
//       params: {
//         scope: 'openid email profile',
//         // Additional parameters as needed
//       },
// 	  async request({args, provider}) {
// 		// need to do a GET to a custom URL while including the session_id
// 		console.log('hit the request');
// 		throw error(500, 'UNIMPLIMENTED');
// 	  }
//     },

//     // The token endpoint for your service
//     token: {
//       url: 'https://your-custom-auth-service.com/oauth/token',
//     },

//     // The userinfo endpoint for your service
//     userinfo: {
//       url: 'https://your-custom-auth-service.com/oauth/userinfo',
//       async request({ tokens, provider }) {
//         // You can customize how to fetch the profile
//         const res = await fetch(provider.userinfo?.url as URL, {
//           headers: {
//             Authorization: `Bearer ${tokens.access_token}`
//           }
//         });
//         const profile = await res.json();
//         return profile;
//       }
//     },

//     // Map profile data to standardized user object
//     profile(profile) {
//       return {
//         id: profile.id,
//         name: profile.name,
//         email: profile.email,
//         image: profile.image
//       };
//     },

//     // Any custom options from the config
//     options
//   };
// }

async function initAuthConfig(): Promise<AuthConfig> {
  let config = loadAuthConfigFromEnv();
  const AUTH_CONFIG_SOURCE = process.env.AUTH_CONFIG_SOURCE;
  const LOCAL = process.env.LOCAL;

  try {
    if (AUTH_CONFIG_SOURCE && !LOCAL) {
      config = await loadAuthConfigFromExternalSource(AUTH_CONFIG_SOURCE);
    } else if (AUTH_CONFIG_SOURCE) {
      config = await loadAuthConfigFromLocal(AUTH_CONFIG_SOURCE);
    }
  } catch (error) {
    console.error("Error loading auth config from source:", error);
  }
  return config;
}

const authConfig = await initAuthConfig();
const activeProviders = getActiveProviders(authConfig);

// Helper function for local credential expiration
function endOfToday(): Date {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now;
}

async function getAwsCredentials(
  idToken: string,
  provider: string = "cognito"
) {
  const logins: Record<string, string> = {};

  if (provider === "google") {
    logins["accounts.google.com"] = idToken;
  } else if (provider === "cognito") {
    logins[
      `cognito-idp.${e().AWS_REGION}.amazonaws.com/${e().AUTH_COGNITO_USER_POOL_ID}`
    ] = idToken;
  } else if (provider === "github") {
    console.warn(
      "GitHub provider detected. This provider is untested currently"
    );
    logins["github.com"] = idToken;
  } else {
    logins["cognito-identity.amazonaws.com"] = idToken;
    throw new Error(`Unknown provider: ${provider}`);
  }

  const cognitoIdentityPool = fromCognitoIdentityPool({
    clientConfig: { region: e().AWS_REGION ?? 'us-east-1' },
    identityPoolId: e().AUTH_COGNITO_IDENTITY_POOL_ID ?? '',
    logins,
  });

  return cognitoIdentityPool();
}

async function refreshAccessToken(refreshToken: string, provider: string) {
  try {
    let url, params;

    const providerConfig = authConfig.providers[provider];
    if (!providerConfig || !providerConfig.enabled) {
      throw new Error(`Provider ${provider} is not enabled`);
    }

    switch (provider) {
      case "google":
        url = "https://oauth2.googleapis.com/token";
        params = new URLSearchParams({
          client_id: e().AUTH_GOOGLE_ID ?? '',
          client_secret: e().AUTH_GOOGLE_SECRET ?? '',
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        });
        break;
      case "cognito":
        url = `https://cognito-idp.${e().AWS_REGION}.amazonaws.com/${e().AUTH_COGNITO_USER_POOL_ID}/oauth2/token`;
        params = new URLSearchParams({
          client_id: e().AUTH_COGNITO_CLIENT_ID || "",
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        });
        break;
      case "github":
        url = "https://github.com/login/oauth/access_token";
        params = new URLSearchParams({
          client_id: e().AUTH_GITHUB_ID ?? '',
          client_secret: e().AUTH_GITHUB_SECRET ?? '',
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        });
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const tokens = await response.json();

    return {
      access_token: tokens.access_token,
      id_token: tokens.id_token,
      expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
    };
  } catch (err) {
    console.error("Error refreshing token:", err);
    throw err;
  }
}

export const { handle, signIn, signOut } = SvelteKitAuth({
  providers: activeProviders,
  secret: e().AUTH_SECRET ?? '',
  trustHost: true,
  debug: e().DEBUG_AUTH === "true",
  callbacks: {
    async session({ session, token }) {
      session.user && (session.user.sub = token.sub);
      session.access_token = token.access_token;
      session.id_token = token.id_token;
      (session as { refresh_token?: string }).refresh_token = token.refresh_token;
      (session as { expires_at?: number }).expires_at = token.expires_at;
      (session as { provider?: string }).provider = token.provider;

      // AWS credentials are now provided on-demand via /api/aws-creds and getSession (Stage 2).
      // For local dev with env creds, still attach so getSession can use them.
      if (process.env.LOCAL && e().AWS_SESSION_TOKEN) {
        session.aws_credentials = {
          accessKeyId: e().AWS_ACCESS_KEY_ID ?? '',
          secretAccessKey: e().AWS_SECRET_ACCESS_KEY ?? '',
          sessionToken: e().AWS_SESSION_TOKEN ?? '',
          expiration: endOfToday(),
        };
      }
      return session;
    },

    async jwt({ token, account }) {
      if (account) {
        //Ensure the provider is enabled
        if (!authConfig.providers[account.provider as string]?.enabled) {
          error(403, `Provider ${account.provider} is disabled`);
        }

        return {
          ...token,
          access_token: account.access_token,
          id_token: account.id_token,
          provider: account.provider,
          refresh_token: account.refresh_token,
          expires_at: account.expires_at,
        };
      } else if (Date.now() < token.expires_at * 1000) {
        return token;
      } else {
        //TODO: figure out how to handle this and redirect to sign in page
        if (!token.refresh_token) error(403, "No refresh token. Sign in again");

        try {
          //Ensure the provider is enabled
          if (!authConfig.providers[token.provider as string]?.enabled) {
            error(403, `Provider ${token.provider} is disabled`);
          }

          const refreshedTokens = await refreshAccessToken(
            token.refresh_token,
            token.provider!
          );

          return {
            ...token,
            access_token: refreshedTokens.access_token,
            id_token: refreshedTokens.id_token,
            expires_at: refreshedTokens.expires_at,
          };
        } catch (err) {
          console.error("Error refreshing token:", err);
          error(403, "Failed to refresh token. Please sign in again");
        }
      }
      // return token;
    },
  },
});
