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
//
// NOTE: this intentionally keys off the origin/protocol, NOT a Tauri-runtime
// probe. In `tauri dev` the app is served from the Vite dev server
// (http://localhost:5173), where cookie auth + browser history still work — so
// dev behaves like web. The native code paths kick in only for the bundled app
// (tauri://localhost / tauri.localhost). The assistant detects Tauri separately
// (see isTauri() in @tauri-apps/api/core) so it can run in dev without flipping
// the whole app into native mode.

const proto = typeof window !== "undefined" ? window.location.protocol : "";
const host = typeof window !== "undefined" ? window.location.hostname : "";
const hasCapacitor =
  typeof window !== "undefined" && !!(window as unknown as { Capacitor?: unknown }).Capacitor;

// Desktop shell:
//   - Electrobun → views://
//   - Tauri v2  → tauri://localhost (macOS/Linux) or http(s)://tauri.localhost (Windows)
export const isDesktop =
  proto === "views:" || proto === "tauri:" || host === "tauri.localhost";

// Capacitor mobile app (iOS uses capacitor://, Android uses http://localhost)
export const isMobile =
  proto === "capacitor:" ||
  (hasCapacitor &&
    typeof window !== "undefined" &&
    window.location.hostname === "localhost");

// Any native shell — needs bearer-token auth + hash routing.
export const isNative = isDesktop || isMobile;
