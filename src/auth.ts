import { Auth } from "@auth/core";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import type { NextRequest } from "next/server";
import { isAllowedAuthEmail, normalizeAuthEmail } from "@/lib/auth-utils";
import { BRANDED_MAGIC_MIKE_ORIGIN } from "@/lib/magic-mike-origin";

type GoogleProfile = {
  email?: string;
  email_verified?: boolean;
};

const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ profile, user }) {
      const googleProfile = profile as GoogleProfile | undefined;
      const email = normalizeAuthEmail(googleProfile?.email || user.email);
      const emailVerified = googleProfile?.email_verified;

      if (process.env.VERCEL_ENV === "preview" && process.env.COACHING_LAB_CONNECTED === "true" && email !== "syed.haider@insidesuccess.com") return false;
      return Boolean(email && emailVerified !== false && isAllowedAuthEmail(email));
    },
    async session({ session }) {
      if (session.user?.email) {
        session.user.email = normalizeAuthEmail(session.user.email) || session.user.email;
      }

      return session;
    },
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);

/** The branded OAuth round trip must stay on the host that owns its cookies. */
export function handleAuthRequest(request: NextRequest) {
  if (process.env.VERCEL_ENV === "production" && request.nextUrl.origin === BRANDED_MAGIC_MIKE_ORIGIN) {
    // Use the same config and secrets with the validated request URL, avoiding
    // NextAuth's fixed AUTH_URL rewrite for this exact host only.
    return Auth(request, { ...authConfig, redirectProxyUrl: undefined });
  }
  return request.method === "GET" ? handlers.GET(request) : handlers.POST(request);
}
