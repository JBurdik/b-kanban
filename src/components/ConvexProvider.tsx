import { ReactNode, useState, useEffect } from "react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { convex } from "@/lib/convex";
import { authClient } from "@/lib/auth-client";

// Detect if running in Tauri desktop app
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

// Storage key for bearer token (same as in auth-client.ts)
const BEARER_TOKEN_KEY = "better_auth_bearer_token";

interface Props {
  children: ReactNode;
}

export function ConvexProvider({ children }: Props) {
  // For Tauri, get the initial token from localStorage
  const [initialToken, setInitialToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(!isTauri);

  useEffect(() => {
    if (isTauri) {
      const token = localStorage.getItem(BEARER_TOKEN_KEY);
      setInitialToken(token);
      setIsReady(true);
    }
  }, []);

  // Don't render until we've checked for the token in Tauri
  if (!isReady) {
    return null;
  }

  return (
    <ConvexBetterAuthProvider
      client={convex}
      authClient={authClient}
      initialToken={initialToken}
    >
      {children}
    </ConvexBetterAuthProvider>
  );
}
