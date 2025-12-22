import { betterAuth } from "better-auth";
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { DataModel } from "./_generated/dataModel";
import { components } from "./_generated/api";
import authConfig from "./auth.config";

const siteUrl = "http://localhost:5173";
// For self-hosted dev, use env var or fallback to development secret
const authSecret = process.env.BETTER_AUTH_SECRET || "FZl8e1OSHCumadMLQZH7JitCmh/RSnlk3jXaN7aSIJY=";

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (
  ctx: GenericCtx<DataModel>,
  { optionsOnly } = { optionsOnly: false }
) =>
  betterAuth({
    secret: authSecret,
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    trustedOrigins: [siteUrl],
    plugins: [convex({ authConfig })],
    logger: { disabled: optionsOnly },
  });
