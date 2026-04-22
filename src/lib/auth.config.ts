// src/lib/auth.config.ts
// EDGE-SAFE: must not import any Node-only modules (postgres, fs, net, etc).
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export default {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 }, // 12h — bounds stale role/status
  trustHost: true,
  pages: { signIn: "/login" },
  callbacks: {
    // Edge-safe callbacks only. These run in middleware too.
    authorized({ auth: session }) {
      return !!session?.user;
    },
    // session() runs both edge and node; only read token claims, never DB.
    session({ session, token }) {
      if (token.userId) {
        session.user = { ...session.user, id: token.userId as string };
      }
      if (token.role) {
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
