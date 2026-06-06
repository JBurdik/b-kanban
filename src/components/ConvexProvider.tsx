import { ReactNode, useState, useEffect } from "react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { convex } from "@/lib/convex";
import { authClient } from "@/lib/auth-client";
import { isNative } from "@/lib/platform";

// Storage key for bearer token (same as in auth-client.ts)
const BEARER_TOKEN_KEY = "better_auth_bearer_token";

interface Props {
  children: ReactNode;
}

export function ConvexProvider({ children }: Props) {
  // In native shells, get the initial token from localStorage
  const [initialToken, setInitialToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(!isNative);

  useEffect(() => {
    if (isNative) {
      const token = localStorage.getItem(BEARER_TOKEN_KEY);
      setInitialToken(token);
      setIsReady(true);
    }
  }, []);

  // Don't render until we've checked for the token in native shells
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
