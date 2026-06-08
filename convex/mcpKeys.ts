// Per-user API keys for the remote MCP server.
//
// The web app calls `generate`/`list`/`revoke` (session-authed). The HTTP MCP
// endpoint (convex/mcpHttp.ts) calls `internalValidate`/`internalTouch` to
// authenticate incoming Bearer tokens. Only the SHA-256 hash is persisted; the
// plaintext key is returned once from `generate` and never again.

import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";

const KEY_PREFIX = "bprod_";

async function getUserByEmail(ctx: QueryCtx | MutationCtx, email: string) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
  if (!user) throw new Error("User not found");
  return user;
}

/** Hex-encode an ArrayBuffer */
function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** SHA-256 hex of a string (Web Crypto, available in the Convex runtime) */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

/** Generate a random key: bprod_<32 hex chars> */
function randomKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return KEY_PREFIX + hex;
}

/**
 * Create a new MCP API key for the current user.
 * Returns the plaintext key ONCE — it is not retrievable afterwards.
 */
export const generate = mutation({
  args: { name: v.string(), userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.userEmail);
    const userId = user._id;

    const key = randomKey();
    const keyHash = await sha256Hex(key);
    const prefix = key.slice(0, 12);

    await ctx.db.insert("mcpApiKeys", {
      userId,
      name: args.name.trim() || "key",
      keyHash,
      prefix,
      createdAt: Date.now(),
    });

    return { key, prefix };
  },
});

/** List the current user's MCP API keys (never returns the hash/plaintext). */
export const list = query({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.userEmail);
    const userId = user._id;

    const keys = await ctx.db
      .query("mcpApiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return keys
      .map((k) => ({
        _id: k._id,
        name: k.name,
        prefix: k.prefix,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Revoke (delete) one of the current user's keys. */
export const revoke = mutation({
  args: { keyId: v.id("mcpApiKeys"), userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.userEmail);
    const userId = user._id;

    const key = await ctx.db.get(args.keyId);
    if (!key || key.userId !== userId) {
      throw new Error("Key not found");
    }
    await ctx.db.delete(args.keyId);
    return { success: true };
  },
});

/**
 * Validate an incoming key hash. Returns the owner's email + id, or null.
 * Internal — called only by the HTTP MCP handler.
 */
export const internalValidate = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, args) => {
    const key = await ctx.db
      .query("mcpApiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", args.keyHash))
      .first();
    if (!key) return null;

    const user = await ctx.db.get(key.userId);
    if (!user?.email) return null;

    return { keyId: key._id, userId: key.userId, email: user.email };
  },
});

/** Best-effort: stamp lastUsedAt on a key. */
export const internalTouch = internalMutation({
  args: { keyId: v.id("mcpApiKeys") },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.keyId);
    if (key) await ctx.db.patch(args.keyId, { lastUsedAt: Date.now() });
  },
});
