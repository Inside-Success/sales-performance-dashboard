import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PUBLIC_PATHS = new Set(["/sign-in"]);
const V4_LAB_PATHS = new Set(["/ask-sales-faq/v4-lab", "/ask-sales-faq/v4-systemic-lab", "/ask-sales-faq/v5-lab"]);
export const V4_LAB_REQUEST_HEADER = "x-ask-sales-v4-lab-request";

export function isV4LabAuthBypassEnabled(pathname: string) {
  return V4_LAB_PATHS.has(pathname) &&
    process.env.ASK_SALES_V4_ISOLATED === "true" &&
    process.env.VERCEL_ENV === "preview";
}

function continueRequest(requestHeaders: Headers, markV4Lab = false) {
  const headers = new Headers(requestHeaders);
  headers.delete(V4_LAB_REQUEST_HEADER);
  if (markV4Lab) headers.set(V4_LAB_REQUEST_HEADER, "1");
  return NextResponse.next({ request: { headers } });
}

export const proxy = auth((request) => {
  const { nextUrl } = request;

  if (isV4LabAuthBypassEnabled(nextUrl.pathname)) {
    return continueRequest(request.headers, true);
  }

  if (PUBLIC_PATHS.has(nextUrl.pathname)) {
    if (request.auth?.user && !nextUrl.searchParams.get("error")) {
      return NextResponse.redirect(new URL("/", nextUrl));
    }

    return continueRequest(request.headers);
  }

  if (!request.auth?.user) {
    const signInUrl = new URL("/sign-in", nextUrl);
    signInUrl.searchParams.set("callbackUrl", `${nextUrl.pathname}${nextUrl.search}`);
    return NextResponse.redirect(signInUrl);
  }

  return continueRequest(request.headers);
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
