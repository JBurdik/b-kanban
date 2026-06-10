import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useSessionToken } from "./useSessionToken";

/**
 * Populates the server-side session mirror (authMirror.bootstrap) once per
 * login. Until this succeeds, server-side auth can't resolve the caller, so
 * queries return empty — this runs as early as possible (mounted at the app
 * root) and retries with backoff because the single component lookup it does
 * can transiently OOM on the self-hosted backend.
 *
 * See convex/lib/rbac.ts for why per-request auth needs the mirror.
 */
export function useBootstrapSession() {
  const sessionToken = useSessionToken();
  const bootstrap = useMutation(api.authMirror.bootstrap);
  const doneFor = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionToken || doneFor.current === sessionToken) return;
    let cancelled = false;

    (async () => {
      for (let attempt = 0; attempt < 6 && !cancelled; attempt++) {
        try {
          const res = await bootstrap({ sessionToken });
          if (res?.ok) {
            doneFor.current = sessionToken;
            return;
          }
        } catch {
          // transient (e.g. isolate OOM) — retry with backoff
        }
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionToken, bootstrap]);
}
