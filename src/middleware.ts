import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow login page and auth endpoint only
  if (pathname === "/login" || pathname === "/api/auth") {
    return NextResponse.next();
  }

  // Check auth cookie
  const token = req.cookies.get("rubick-auth")?.value;

  if (!verifyAuthToken(token)) {
    // API routes return 401, page routes redirect to login
    if (pathname.startsWith("/api/")) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
