import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Scrypt } from "lucia";
import { isLegacyBetterAuthHash, verifyBetterAuthHash } from "./lib/legacyPassword";

// Email + password auth via Convex Auth. Runs entirely inside Convex functions
// (no better-auth adapter.js → no isolate OOM on self-hosted). JWTs are signed
// with JWT_PRIVATE_KEY and validated natively against JWKS — so
// ctx.auth.getUserIdentity() / getAuthUserId() work here.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        return {
          email: params.email as string,
          name: (params.name as string) ?? (params.email as string),
        };
      },
      crypto: {
        async hashSecret(password: string) {
          // New accounts → Convex Auth's native Lucia Scrypt format.
          return await new Scrypt().hash(password);
        },
        async verifySecret(password: string, hash: string) {
          // Existing better-auth hashes ("saltHex:keyHex", scrypt r=16) verify
          // via the legacy shim; lazily migrate would re-hash, but keeping the
          // legacy verify is enough and stable.
          if (isLegacyBetterAuthHash(hash)) {
            return await verifyBetterAuthHash(password, hash);
          }
          return await new Scrypt().verify(hash, password);
        },
      },
    }),
  ],
});
