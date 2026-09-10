import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PUBLIC_PATHS = new Set(["/sign-in"]);

export const proxy = auth((request) => {
  const { nextUrl } = request;

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
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
