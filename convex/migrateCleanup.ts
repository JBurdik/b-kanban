import { internalMutation } from "./_generated/server";

// STAGE 2 cutover only: delete leftover session-token-mirror rows from the
// `authSessions` table (legacy shape: they have a `token` field). Convex Auth's
// own authSessions rows have { userId, expirationTime } and no `token`, so they
// are preserved. Runs once right after the cutover deploy (see deploy.sh), with
// schema validation temporarily off. Idempotent. Remove after stage 3.
export const clearLegacyAuthSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("authSessions").collect();
    let deleted = 0;
    for (const r of rows) {
      if ((r as unknown as { token?: string }).token !== undefined) {
        await ctx.db.delete(r._id);
        deleted++;
      }
    }
    return { deleted, scanned: rows.length };
  },
});
