/**
 * Fixed cross-domain client plugin for better-auth.
 *
 * This is a copy of @convex-dev/better-auth's crossDomainClient with a fix
 * for the infinite get-session loop bug. The original notifies $sessionSignal
 * on every response with set-better-auth-cookie header, including /get-session
 * responses, which triggers another fetch creating an infinite loop.
 *
 * Fix: Skip notifying $sessionSignal for /get-session responses.
 */
import type { BetterAuthClientPlugin, ClientStore } from "better-auth";
import type { crossDomain } from "@convex-dev/better-auth/plugins";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

interface CookieAttributes {
  value: string;
  expires?: Date;
  "max-age"?: number;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

function parseSetCookieHeader(header: string): Map<string, CookieAttributes> {
  const cookieMap = new Map<string, CookieAttributes>();
  const cookies = header.split(", ");
  cookies.forEach((cookie) => {
    const [nameValue, ...attributes] = cookie.split("; ");
    const [name, value] = nameValue.split("=");

    const cookieObj: CookieAttributes = { value };

    attributes.forEach((attr) => {
      const [attrName, attrValue] = attr.split("=");
      cookieObj[attrName.toLowerCase() as "value"] = attrValue;
    });

    cookieMap.set(name, cookieObj);
  });

  return cookieMap;
}

interface StoredCookie {
  value: string;
  expires: Date | null;
}

function getSetCookie(header: string, prevCookie?: string) {
  const parsed = parseSetCookieHeader(header);
  let toSetCookie: Record<string, StoredCookie> = {};
  parsed.forEach((cookie, key) => {
    const expiresAt = cookie["expires"];
    const maxAge = cookie["max-age"];
    const expires = expiresAt
      ? new Date(String(expiresAt))
      : maxAge
        ? new Date(Date.now() + Number(maxAge) * 1000)
        : null;
    toSetCookie[key] = {
      value: cookie["value"],
      expires,
    };
  });
  if (prevCookie) {
    try {
      const prevCookieParsed = JSON.parse(prevCookie);
      toSetCookie = {
        ...prevCookieParsed,
        ...toSetCookie,
      };
    } catch {
      //
    }
  }
  return JSON.stringify(toSetCookie);
}

function getCookie(cookie: string) {
  let parsed = {} as Record<string, StoredCookie>;
  try {
    parsed = JSON.parse(cookie) as Record<string, StoredCookie>;
  } catch {
    // noop
  }
  const toSend = Object.entries(parsed).reduce((acc, [key, value]) => {
    if (value.expires && value.expires < new Date()) {
      return acc;
    }
    return `${acc}; ${key}=${value.value}`;
  }, "");
  return toSend;
}

export const fixedCrossDomainClient = (
  opts: {
    storage?: {
      setItem: (key: string, value: string) => void;
      getItem: (key: string) => string | null;
    };
    storagePrefix?: string;
    disableCache?: boolean;
  } = {},
) => {
  let store: ClientStore | null = null;
  const cookieName = `${opts?.storagePrefix || "better-auth"}_cookie`;
  const localCacheName = `${opts?.storagePrefix || "better-auth"}_session_data`;
  const storage =
    opts?.storage || (typeof window !== "undefined" ? localStorage : undefined);

  return {
    id: "cross-domain",
    $InferServerPlugin: {} as ReturnType<typeof crossDomain>,
    getActions(_: unknown, $store: ClientStore) {
      store = $store;
      return {
        getCookie: () => {
          const cookie = storage?.getItem(cookieName);
          return getCookie(cookie || "{}");
        },
        updateSession: () => {
          $store.notify("$sessionSignal");
        },
        getSessionData: () => {
          const sessionData = storage?.getItem(localCacheName);
          return sessionData ? JSON.parse(sessionData) : null;
        },
      };
    },
    fetchPlugins: [
      {
        id: "convex",
        name: "Convex",
        hooks: {
          async onSuccess(context: {
            response: Response;
            request: { url: string | URL };
            data: unknown;
          }) {
            if (!storage) {
              return;
            }
            const setCookie = context.response.headers.get(
              "set-better-auth-cookie",
            );
            if (setCookie) {
              const prevCookie = storage.getItem(cookieName);
              const toSetCookie = getSetCookie(
                setCookie || "",
                prevCookie ?? undefined,
              );
              storage.setItem(cookieName, toSetCookie);

              // FIX: Don't notify sessionSignal for /get-session responses
              // to prevent infinite loop. The session atom already handles
              // updates from /get-session responses directly.
              const url = context.request.url.toString();
              if (!url.includes("/get-session")) {
                store?.notify("$sessionSignal");
              }
            }

            if (
              context.request.url.toString().includes("/get-session") &&
              !opts?.disableCache
            ) {
              const data = context.data;
              storage.setItem(localCacheName, JSON.stringify(data));
            }
          },
        },
        async init(url: string, options?: AnyRecord) {
          if (!storage) {
            return {
              url,
              options,
            };
          }
          const opts = options || {};
          const storedCookie = storage.getItem(cookieName);
          const cookie = getCookie(storedCookie || "{}");
          opts.credentials = "omit";
          opts.headers = {
            ...opts.headers,
            "Better-Auth-Cookie": cookie,
          };
          if (url.includes("/sign-out")) {
            storage.setItem(cookieName, "{}");
            store?.atoms.session?.set({
              data: null,
              error: null,
              isPending: false,
            });
            storage.setItem(localCacheName, "{}");
          }
          return {
            url,
            options: opts,
          };
        },
      },
    ],
  } satisfies BetterAuthClientPlugin;
};
