import type { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL || "http://localhost:5173",
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
