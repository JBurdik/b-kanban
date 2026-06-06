import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "net.burdych.bproductive",
  appName: "B Productive",
  webDir: "dist",
  // iOS serves under capacitor://localhost, Android under http://localhost.
  // Both are trusted in convex/http.ts + convex/auth.ts. Auth uses bearer tokens
  // (see src/lib/platform.ts → isNative), so cookies under these schemes don't matter.
};

export default config;
