import { NextResponse, type NextRequest } from "next/server";

/**
 * When the backend is switched on (NEXT_PUBLIC_BACKEND=1), staff pages require a
 * session cookie; without one the visitor goes to /login. This is only a
 * convenience redirect — the real check happens on every /api request, which is
 * where all data comes from.
 */
const ON = process.env.NEXT_PUBLIC_BACKEND === "1";

export function middleware(req: NextRequest) {
  if (!ON) return NextResponse.next();
  if (req.cookies.has("mkb_session") || req.cookies.has("__Host-mkb_session")) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the API, sign-in pages, public forms and static files.
  matcher: ["/((?!api|login|f/|_next|brand|favicon|icon|apple-icon).*)"],
};
