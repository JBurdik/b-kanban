import { scryptAsync } from "@noble/hashes/scrypt.js";
import { bytesToHex } from "@noble/hashes/utils.js";

// Verify a password against a legacy better-auth hash so existing users keep
// their passwords after the migration to Convex Auth.
//
// better-auth stores `${saltHex}:${keyHex}` where the key is
// scrypt(password.normalize("NFKC"), saltHex /* the hex STRING as salt */,
//        { N: 16384, r: 16, p: 1, dkLen: 64 }).
// (Convex Auth's native Lucia Scrypt uses r=8, so we can't reuse its verifier.)
const N = 16384;
const r = 16;
const p = 1;
const dkLen = 64;

// Constant-time hex compare (no node:crypto in the Convex isolate).
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function isLegacyBetterAuthHash(hash: string): boolean {
  // better-auth format: "<32 hex salt>:<128 hex key>" — has a colon, not a
  // bcrypt/argon "$..." string.
  return hash.includes(":") && !hash.startsWith("$");
}

export async function verifyBetterAuthHash(
  password: string,
  stored: string,
): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const derived = await scryptAsync(
    password.normalize("NFKC"),
    saltHex,
    { N, r, p, dkLen, maxmem: 128 * N * r * 2 },
  );
  return timingSafeEqualHex(bytesToHex(derived), keyHex);
}
