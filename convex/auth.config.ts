// Convex Auth signs its access tokens with issuer = CONVEX_SITE_URL
// (see @convex-dev/auth tokens.ts setIssuer). The provider domain must match
// so ctx.auth.getUserIdentity() validates them.
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
