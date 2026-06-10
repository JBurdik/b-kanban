// Centralized platform detection.
//
// The app ships three ways from one web build:
//   - web       → normal http(s) in a browser
//   - desktop   → Tauri v2 shell (macOS/Linux: tauri://localhost,
//                 Windows: http(s)://tauri.localhost) — or legacy Electrobun (views://)
//   - mobile    → Tauri v2 iOS/Android shell
//
// Desktop and mobile ("native") share the same constraints: a non-standard or
// localhost origin where auth cookies don't work, so we use bearer-token auth,
// and no server, so we use hash-based routing.
//
// Desktop keys off the origin/protocol, NOT the Tauri runtime, on purpose: in
// `tauri dev` the app is served from the Vite dev server (http://localhost:5173)
// where cookie auth + browser history still work — so desktop dev behaves like
// web. Native desktop paths kick in only for the bundled app (tauri://localhost).
// The assistant detects Tauri separately (codexProbe / isTauri) so it can run in
// dev without flipping the whole app into native mode.
//
// Mobile is different: a phone always needs bearer auth + hash routing, in dev
// and bundled alike, so we detect it via the Tauri OS plugin runtime (which
// reports ios/android regardless of the serving origin).

import { isTauri } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";

const proto = typeof window !== "undefined" ? window.location.protocol : "";
const host = typeof window !== "undefined" ? window.location.hostname : "";

// Tauri OS, when running inside a Tauri shell: "macos" | "windows" | "linux" |
// "ios" | "android". `null` in a plain browser.
const osName =
  typeof window !== "undefined" && isTauri() ? platform() : null;

// Mobile takes precedence and is detected by the runtime OS, so it works in both
// `tauri ios/android dev` and the bundled app.
export const isMobile = osName === "ios" || osName === "android";

// Desktop shell:
//   - Tauri v2  → tauri://localhost (macOS/Linux) or http(s)://tauri.localhost (Windows)
//   - Electrobun → views:// (legacy)
export const isDesktop =
  !isMobile &&
  (proto === "views:" || proto === "tauri:" || host === "tauri.localhost");

// Any native shell — needs bearer-token auth + hash routing.
export const isNative = isDesktop || isMobile;
