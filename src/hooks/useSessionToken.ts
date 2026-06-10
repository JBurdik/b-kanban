import { useMemo } from "react";
import { useSession } from "@/lib/auth-client";

// betterAuth stores the session cookie under this localStorage key (see
// fixedCrossDomainClient). The stored value is "<token>.<signature>"; the DB
// stores only "<token>" (the part before the dot), which is what the Convex
// backend validates in convex/lib/rbac.ts.
const COOKIE_KEY = "better-auth_cookie";
const BEARER_TOKEN_KEY = "better_auth_bearer_token";

export function readSessionToken(): string | undefined {
  if (typeof localStorage === "undefined") return undefined;

  // Native shells (tauri/electrobun) use a Bearer token instead of the cookie.
  const bearer = localStorage.getItem(BEARER_TOKEN_KEY);
  const fromBearer = bearer ? bearer.split(".")[0] : undefined;
  if (fromBearer) return fromBearer;

  const raw = localStorage.getItem(COOKIE_KEY);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, { value?: string }>;
    const value = parsed["better-auth.session_token"]?.value;
    if (!value) return undefined;
    return decodeURIComponent(value).split(".")[0];
  } catch {
    return undefined;
  }
}

/**
 * Returns the current betterAuth session token (the secret bearer credential)
 * to pass as the `sessionToken` arg to Convex queries/mutations. Re-reads when
 * the session changes. Undefined when logged out.
 *
 * On this self-hosted backend getUserIdentity()/JWT auth is unavailable (the
 * token endpoint OOMs), so the session token is how the server authenticates
 * the caller — validated lightweightly in convex/lib/rbac.ts.
 */
export function useSessionToken(): string | undefined {
  const { data: session } = useSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => readSessionToken(), [session?.session?.id]);
}
