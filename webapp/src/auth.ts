import { SvelteKitAuth } from "@auth/sveltekit";
import Cognito from "@auth/sveltekit/providers/cognito";
import Google from "@auth/sveltekit/providers/google";
import {
  AUTH_SECRET,
  AWS_REGION,
  AUTH_COGNITO_USER_POOL_ID,
  AUTH_COGNITO_IDENTITY_POOL_ID,
  AUTH_GOOGLE_ID,
  AUTH_GOOGLE_SECRET,
  AUTH_GITHUB_ID,
  AUTH_GITHUB_SECRET,
  LOCAL,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_SESSION_TOKEN,
  AUTH_CONFIG_SOURCE,
  DEBUG_AUTH,
} from "$env/static/private";
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

  try {
      if (AUTH_CONFIG_SOURCE && !LOCAL) {
        config = await loadAuthConfigFromExternalSource(AUTH_CONFIG_SOURCE);
    } else {
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
      `cognito-idp.${AWS_REGION}.amazonaws.com/${AUTH_COGNITO_USER_POOL_ID}`
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
    clientConfig: { region: AWS_REGION },
    identityPoolId: AUTH_COGNITO_IDENTITY_POOL_ID,
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
          client_id: AUTH_GOOGLE_ID,
          client_secret: AUTH_GOOGLE_SECRET,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        });
        break;
      case "cognito":
        url = `https://cognito-idp.${AWS_REGION}.amazonaws.com/${AUTH_COGNITO_USER_POOL_ID}/oauth2/token`;
        params = new URLSearchParams({
          client_id: process.env.AUTH_COGNITO_CLIENT_ID || "",
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        });
        break;
      case "github":
        url = "https://github.com/login/oauth/access_token";
        params = new URLSearchParams({
          client_id: AUTH_GITHUB_ID,
          client_secret: AUTH_GITHUB_SECRET,
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
  secret: AUTH_SECRET,
  trustHost: true,
  debug: DEBUG_AUTH == "true",
  callbacks: {
    async session({ session, token }) {
      session.user && (session.user.sub = token.sub);
      session.access_token = token.access_token;
      session.id_token = token.id_token;

      // If we are local use our local credentials
      if (LOCAL && AWS_SESSION_TOKEN) {
        session.aws_credentials = {
          accessKeyId: AWS_ACCESS_KEY_ID,
          secretAccessKey: AWS_SECRET_ACCESS_KEY,
          sessionToken: AWS_SESSION_TOKEN,
          expiration: endOfToday(),
        };
        // Get temp AWS credentials if we have the token from any provider
      } else if (token.id_token) {
        try {
          //Ensure the provider is enabled
          if (!authConfig.providers[token.provider as string]?.enabled) {
            error(403, `Provider ${token.provider} is disabled`);
          }

          // Get temp AWS creds from the configured Identity Pool
          const credentials = await getAwsCredentials(
            token.id_token as string,
            token.provider
          );

          if (credentials.sessionToken && credentials.expiration) {
            session.aws_credentials = {
              accessKeyId: credentials.accessKeyId,
              secretAccessKey: credentials.secretAccessKey,
              sessionToken: credentials.sessionToken,
              expiration: credentials.expiration,
            };
          } else {
            error(403, "Session tokens are missing from call to identity pool");
          }
        } catch (error) {
          console.error("Error getting AWS credentials:", error);
        }
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
