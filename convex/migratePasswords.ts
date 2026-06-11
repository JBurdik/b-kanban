import { internalMutation, internalQuery } from "./_generated/server";
import { components } from "./_generated/api";

// STAGE 1 of the Convex Auth migration (runs while still on better-auth).
//
// Copies each better-auth credential password hash into Convex Auth's
// authAccounts table so that, after the stage-2 cutover, existing users can log
// in with their current passwords (the legacy "saltHex:keyHex" scrypt-r16 hash
// is verified by Convex Auth's custom crypto.verifySecret on the branch).
//
// Must run BEFORE the better-auth component is removed (stage 2), because it
// reads the hashes from that component. Idempotent — safe to run repeatedly.
//
// Mapping: betterAuth account(providerId="credential") -> betterAuth user (email)
// -> our app `users` row (by email) -> authAccounts row.
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const res: any = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "account",
      paginationOpts: { cursor: null, numItems: 1000 },
    });
    const accounts: any[] = res?.page ?? res ?? [];

    let migrated = 0;
    let skipped = 0;
    const notes: string[] = [];

    for (const acc of accounts) {
      if (acc.providerId !== "credential" || !acc.password) {
        skipped++;
        continue;
      }
      const baUser: any = await ctx.runQuery(
        components.betterAuth.adapter.findOne,
        { model: "user", where: [{ field: "_id", value: acc.userId }] },
      );
      const email = baUser?.email;
      if (!email) {
        notes.push(`no email for account ${acc._id}`);
        skipped++;
        continue;
      }
      const appUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (!appUser) {
        notes.push(`no app user for ${email}`);
        skipped++;
        continue;
      }
      const existing = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "password").eq("providerAccountId", email),
        )
        .first();
      if (existing) {
        // refresh the secret in case the password changed since last run
        if (existing.secret !== acc.password) {
          await ctx.db.patch(existing._id, { secret: acc.password });
        }
        skipped++;
        continue;
      }
      await ctx.db.insert("authAccounts", {
        userId: appUser._id,
        provider: "password",
        providerAccountId: email,
        secret: acc.password,
      });
      migrated++;
    }

    return { migrated, skipped, total: accounts.length, notes };
  },
});

// Verification helper: how many password authAccounts exist after the run.
export const status = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) => q.eq("provider", "password"))
      .collect();
    return {
      passwordAccounts: rows.length,
      emails: rows.map((r) => r.providerAccountId),
    };
  },
});
