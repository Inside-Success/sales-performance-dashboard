import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import type { NextAuthRequest } from "next-auth";
import { auth } from "@/auth";
import { BRANDED_MAGIC_MIKE_ORIGIN } from "@/lib/magic-mike-origin";

const PUBLIC_PATHS = new Set(["/sign-in"]);

export function proxy(originalRequest: NextRequest, event: NextFetchEvent) {
  const branded = process.env.VERCEL_ENV === "production" &&
    originalRequest.nextUrl.origin === BRANDED_MAGIC_MIKE_ORIGIN;

  return auth((...[request]: [NextAuthRequest, NextFetchEvent]) => {
    // NextAuth rewrites the augmented request to AUTH_URL. Keep branded
    // navigation on the original host while using the same session checks.
    const nextUrl = branded ? originalRequest.nextUrl : request.nextUrl;

    if (PUBLIC_PATHS.has(nextUrl.pathname)) {
      if (request.auth?.user && !nextUrl.searchParams.get("error")) {
        return NextResponse.redirect(new URL("/", nextUrl));
      }

      return NextResponse.next();
    }

    if (!request.auth?.user) {
      const signInUrl = new URL("/sign-in", nextUrl);
      signInUrl.searchParams.set("callbackUrl", `${nextUrl.pathname}${nextUrl.search}`);
      return NextResponse.redirect(signInUrl);
    }

    if (/^\/manager\/rep-scoring\/v\d/.test(nextUrl.pathname)) {
      return NextResponse.redirect(new URL("/manager/rep-scoring", nextUrl));
    }
    return NextResponse.next();
  })(originalRequest, event);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
