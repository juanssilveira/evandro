import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Critical environment variables required for the app to function.
 * If any of these are missing or empty, the app is not ready for production.
 */
const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
];

function isAppConfigured(): boolean {
  return REQUIRED_ENV_VARS.every((key) => {
    const value = process.env[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

const COMING_SOON_PATH = "/coming-soon";

// Paths that should never be blocked (coming-soon itself + static assets)
const BYPASS_PREFIXES = [
  COMING_SOON_PATH,
  "/_next",
  "/favicon",
  "/embed",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never intercept bypass paths
  if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (!isAppConfigured()) {
    const url = request.nextUrl.clone();
    url.pathname = COMING_SOON_PATH;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
