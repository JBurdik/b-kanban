import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { components } from "./_generated/api";

/**
 * Bootstrap the lightweight session mirror.
 *
 * Called once by the client after login (and on app load while a session
 * exists). Verifies the session token against the betterAuth component — the
 * ONLY place that loads adapter.js, which can OOM the isolate, so this is kept
 * to a single infrequent call that the client retries on failure. On success
 * it writes { token -> email } into our `authSessions` table, after which all
 * per-request auth uses a plain indexed lookup (see convex/lib/rbac.ts).
 *
 * Returns { ok } so the client knows whether to retry.
 */
export const bootstrap = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "session",
      where: [{ field: "token", value: args.sessionToken }],
    })) as { userId: string; expiresAt: number } | null;
    if (!session) return { ok: false };
    if (session.expiresAt < Date.now()) return { ok: false };

    const baUser = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "_id", value: session.userId }],
    })) as { email?: string; name?: string } | null;
    if (!baUser?.email) return { ok: false };

    // Upsert the token -> email mirror.
    const existing = await ctx.db
      .query("authSessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        email: baUser.email,
        expiresAt: session.expiresAt,
      });
    } else {
      await ctx.db.insert("authSessions", {
        token: args.sessionToken,
        email: baUser.email,
        expiresAt: session.expiresAt,
      });
    }

    // Provision the app-level user row (mirrors old "create by email").
    const appUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", baUser.email!))
      .first();
    if (!appUser) {
      const now = Date.now();
      await ctx.db.insert("users", {
        email: baUser.email,
        name: baUser.name ?? baUser.email.split("@")[0],
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { ok: true };
  },
});
