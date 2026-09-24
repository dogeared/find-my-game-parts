import type { NextAuthOptions } from "next-auth";
import { prisma } from "@/lib/prisma";

// Keycloak owns username/password AND the Google/Facebook federation
// (docs/designs/find-my-game-parts.md, Constraints) — the app only needs a
// single generic OIDC client. No NextAuth database adapter: sessions are
// stateless JWTs, and the local User row is a thin mirror keyed by the
// OIDC "sub" claim, upserted in the jwt callback below (D1: no service
// layer, no extra Session/Account tables for something this small).
export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "keycloak",
      name: "Find My Game Parts Account",
      type: "oauth",
      wellKnown: `${process.env.KEYCLOAK_ISSUER}/.well-known/openid-configuration`,
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
      authorization: { params: { scope: "openid email profile" } },
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
