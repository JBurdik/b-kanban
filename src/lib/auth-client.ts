import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { fixedCrossDomainClient } from "./fixed-cross-domain-client";
import { isNative } from "./platform";

// Storage key for bearer token
const BEARER_TOKEN_KEY = "better_auth_bearer_token";

// Get bearer token from storage
const getBearerToken = (): string => {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(BEARER_TOKEN_KEY) || "";
};

// Store bearer token
export const storeBearerToken = (token: string | null): void => {
  if (typeof localStorage === "undefined") return;
  if (token) {
    localStorage.setItem(BEARER_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(BEARER_TOKEN_KEY);
  }
};

// Configure auth client with Bearer token support for Electrobun desktop
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_CONVEX_SITE_URL as string,
  plugins: [convexClient(), fixedCrossDomainClient()],
  // Use Bearer auth in native shells (cookies don't work under tauri:// / views://)
  fetchOptions: isNative
    ? {
        auth: {
          type: "Bearer" as const,
          token: getBearerToken,
        },
      }
    : undefined,
});

export const { signIn, signUp, signOut, useSession, changePassword } =
  authClient;
