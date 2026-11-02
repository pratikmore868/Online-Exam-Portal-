import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// A quick redirect for logged-out visitors. This only checks that a cookie exists:
// the real checks are in every API route (lib/api.ts), which is what protects the data.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("rr_session")) {
    const loginUrl = new URL("/login", request.url);
    const { pathname, search } = request.nextUrl;
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*", "/exam/:path*", "/change-password"],
};
