import type { NextAuthOptions } from "next-auth";
import { prisma } from "@/lib/prisma";

// Keycloak owns username/password AND the Google/Facebook federation
// (docs/designs/find-my-game-parts.md, Constraints) — the app only needs a
// single generic OIDC client. No NextAuth database adapter: sessions are
// stateless JWTs, and the local User row is a thin mirror keyed by the
// OIDC "sub" claim, upserted in the jwt callback below (D1: no service
// layer, no extra Session/Account tables for something this small).
//
// Two different Keycloak addresses are unavoidable in Docker Compose:
// KEYCLOAK_ISSUER (e.g. http://keycloak:8080/...) is the internal Docker
// network address the app container uses for server-to-server calls
// (token exchange, userinfo, jwks) — the browser can never reach that
// hostname. KEYCLOAK_PUBLIC_URL (e.g. http://localhost:8090) is what the
// *browser* needs, since it's redirected there directly to log in.
//
// NextAuth's `wellKnown` option does full issuer discovery and then uses
// EVERY endpoint from that discovery document — including
// authorization_endpoint — with no way to override just one (verified by
// reading next-auth/core/lib/oauth/client.js: `provider.authorization.url`
// is only ever merged into query params, never used as the actual
// endpoint, when `wellKnown` is set). So `wellKnown` is deliberately not
// used here; every endpoint is specified explicitly instead, split across
// the two addresses as needed. `issuer` and the token/userinfo/jwks
// endpoints stay internal because Keycloak stamps the token's `iss` claim
// based on how the token endpoint request actually arrives (server-to-server,
// over the internal network) — matching that exactly is what makes
// openid-client's issuer validation pass.
const keycloakRealm = process.env.KEYCLOAK_REALM ?? "find-my-game-parts";
const keycloakInternalBase = `${process.env.KEYCLOAK_ISSUER}`; // already includes /realms/{realm}
const keycloakPublicBase = `${process.env.KEYCLOAK_PUBLIC_URL}/realms/${keycloakRealm}`;

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "keycloak",
      name: "Find My Game Parts Account",
      type: "oauth",
      issuer: keycloakInternalBase,
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
      authorization: {
        url: `${keycloakPublicBase}/protocol/openid-connect/auth`,
        params: { scope: "openid email profile" },
      },
      token: { url: `${keycloakInternalBase}/protocol/openid-connect/token` },
      userinfo: { url: `${keycloakInternalBase}/protocol/openid-connect/userinfo` },
      jwks_endpoint: `${keycloakInternalBase}/protocol/openid-connect/certs`,
      idToken: true,
      checks: ["pkce", "state"],
      profile(profile) {
        return {
          id: profile.sub,
          email: profile.email,
          name: profile.name ?? profile.preferred_username,
        };
      },
    },
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, profile }) {
      if (profile?.sub && profile.email) {
        const user = await prisma.user.upsert({
          where: { keycloakSub: profile.sub },
          update: { email: profile.email },
          create: { keycloakSub: profile.sub, email: profile.email },
        });
        token.userId = user.id;
        token.isAdmin = user.isAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.isAdmin = Boolean(token.isAdmin);
      }
      return session;
    },
  },
};
