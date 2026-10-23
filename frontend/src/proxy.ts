import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_PAGES = ["/login", "/register"];

// Optimistic redirect only: it checks that a session marker exists, not that it is valid.
// Real enforcement is the API's authenticate/authorize middleware.
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("ff_session");
  const { pathname } = request.nextUrl;
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (!hasSession && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/member/:path*",
    "/trainer/:path*",
    "/owner/:path*",
    "/team/:path*",
    "/plans/:path*",
    "/exercises/:path*",
    "/workouts/:path*",
    "/history/:path*",
    "/progress/:path*",
    "/clients/:path*",
  ],
};
