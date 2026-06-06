// Centralized platform detection.
//
// The app ships three ways from one web build:
//   - web       → normal http(s) in a browser
//   - desktop   → Electrobun shell, served under the `views://` protocol
//   - mobile    → Capacitor shell: `capacitor://localhost` (iOS) or
//                 `http://localhost` with a global `Capacitor` object (Android)
//
// Desktop and mobile ("native") share the same constraints: a non-standard or
// localhost origin where auth cookies don't work, so we use bearer-token auth,
// and no server, so we use hash-based routing.

const proto = typeof window !== "undefined" ? window.location.protocol : "";
const hasCapacitor =
  typeof window !== "undefined" && !!(window as unknown as { Capacitor?: unknown }).Capacitor;

// Electrobun desktop app
export const isDesktop = proto === "views:";

// Capacitor mobile app (iOS uses capacitor://, Android uses http://localhost)
export const isMobile =
  proto === "capacitor:" ||
  (hasCapacitor &&
    typeof window !== "undefined" &&
    window.location.hostname === "localhost");

// Any native shell — needs bearer-token auth + hash routing.
export const isNative = isDesktop || isMobile;
