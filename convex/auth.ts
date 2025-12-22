import { betterAuth } from "better-auth";
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { DataModel } from "./_generated/dataModel";
import { components } from "./_generated/api";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL || "http://localhost:5173";
const authSecret = process.env.BETTER_AUTH_SECRET || "FZl8e1OSHCumadMLQZH7JitCmh/RSnlk3jXaN7aSIJY=";

// Create the Better Auth component client
export const authComponent = createClient<DataModel>(components.betterAuth);

// Create auth instance factory - called for each request
export const createAuth = (
  ctx: GenericCtx<DataModel>,
  { optionsOnly } = { optionsOnly: false }
) =>
  betterAuth({
    secret: authSecret,
    logger: {
      disabled: optionsOnly,
    },
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },
    trustedOrigins: [
      siteUrl,
      "http://localhost:5173",
      "http://localhost:3210",
      "http://localhost:3211",
    ],
    plugins: [
      convex({
        authConfig,
      }),
      crossDomain({
        siteUrl,
      }),
    ],
  });
