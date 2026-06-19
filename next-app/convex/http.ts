import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/.well-known/jwks.json",
  method: "GET",
  handler: httpAction(async () => {
    const jwks = process.env.GROVE_AUTH_JWKS;
    if (!jwks) {
      return new Response(JSON.stringify({ error: "JWKS is not configured." }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(jwks, {
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=300",
      },
    });
  }),
});

export default http;
