import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { fixedCrossDomainClient } from "./fixed-cross-domain-client";

// Detect if running in Electrobun desktop app (views:// protocol)
const isDesktopApp =
  typeof window !== "undefined" &&
  window.location.protocol === "views:";

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
  // Use Bearer auth in desktop app (cookies may not work with views:// protocol)
  fetchOptions: isDesktopApp
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
