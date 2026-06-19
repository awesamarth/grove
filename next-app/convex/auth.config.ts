import type { AuthConfig } from "convex/server";

const issuer = process.env.GROVE_AUTH_ISSUER;
const jwks = process.env.GROVE_AUTH_JWKS_URL;
const applicationID = process.env.GROVE_AUTH_AUDIENCE ?? "grove";

if (!issuer || !jwks) {
  throw new Error("GROVE_AUTH_ISSUER and GROVE_AUTH_JWKS_URL must be configured for Convex auth.");
}

export default {
  providers: [
    {
      type: "customJwt",
      issuer,
      jwks,
      applicationID,
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;
