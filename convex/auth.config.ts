import type { AuthConfig } from "convex/server";

// Use the API domain for JWT issuer validation
const authDomain = process.env.SITE_URL || "https://kanban-api.burdych.net";

export default {
  providers: [
    {
      domain: authDomain,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
