import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { fixedCrossDomainClient } from "./fixed-cross-domain-client";

// Detect if running in Tauri desktop app
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

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

// Configure auth client with Bearer token support for Tauri
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_CONVEX_SITE_URL as string,
  plugins: [convexClient(), fixedCrossDomainClient()],
  // Use Bearer auth when in Tauri (cookies don't work with tauri:// protocol)
  fetchOptions: isTauri
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
