import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  },
);

// Protect every app page and API route except auth endpoints and static assets.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/domains/:path*",
    "/notifications/:path*",
    "/calendar/:path*",
    "/payments/:path*",
    "/analytics/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/api/domains/:path*",
    "/api/payments/:path*",
    "/api/notifications/:path*",
    "/api/analytics/:path*",
    "/api/search/:path*",
    "/api/profile/:path*",
  ],
};
