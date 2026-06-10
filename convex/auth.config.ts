import type { AuthConfig } from "convex/server";

// JWT issuer is set by the better-auth convex plugin to CONVEX_SITE_URL
// (see @convex-dev/better-auth plugins/convex: issuer = process.env.CONVEX_SITE_URL).
// auth.config.ts domain MUST match that issuer for getUserIdentity() to validate.
// On prod SITE_URL == CONVEX_SITE_URL so SITE_URL happened to work; locally they
// differ (3211 vs 5173), which broke identity. Use CONVEX_SITE_URL everywhere.
const authDomain =
  process.env.CONVEX_SITE_URL || process.env.SITE_URL || "https://kanban.burdych.net";

export default {
  providers: [
    {
      domain: authDomain,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
