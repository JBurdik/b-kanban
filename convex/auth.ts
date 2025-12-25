import { betterAuth } from "better-auth";
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { DataModel } from "./_generated/dataModel";
import { components } from "./_generated/api";
import authConfig from "./auth.config";

// SITE_URL is where the frontend is hosted (for crossDomain plugin)
const siteUrl = process.env.SITE_URL || "http://localhost:5173";
// CONVEX_URL is where the Convex HTTP routes are hosted (for baseURL)
const convexUrl = process.env.CONVEX_URL || "http://localhost:3210";
// For self-hosted dev, use env var or fallback to development secret
const authSecret =
  process.env.BETTER_AUTH_SECRET ||
  "FZl8e1OSHCumadMLQZH7JitCmh/RSnlk3jXaN7aSIJY=";

// Build trusted origins from environment + defaults
const trustedOrigins = [
  "http://localhost:5173",
  "http://localhost:80",
  "http://localhost",
  "https://bproductive.burdych.net",
  "https://api-kanban.burdych.net",
  siteUrl,
  // Add any additional origins from TRUSTED_ORIGINS env var (comma-separated)
  ...(process.env.TRUSTED_ORIGINS?.split(",").map((o) => o.trim()) || []),
].filter((origin) => origin && origin.length > 0);

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (
  ctx: GenericCtx<DataModel>,
  { optionsOnly } = { optionsOnly: false },
) =>
  betterAuth({
    secret: authSecret,
    baseURL: convexUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    trustedOrigins,
    // advanced: {
    //   crossSubDomainCookies: {
    //     enabled: true,
    //     domain: ".burdych.net",
    //   },
    //   useSecureCookies: false,
    // },
    plugins: [convex({ authConfig }), crossDomain({ siteUrl })],
    logger: { disabled: optionsOnly },
  });
