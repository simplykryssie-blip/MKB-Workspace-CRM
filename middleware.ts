import { NextResponse, type NextRequest } from "next/server";

/**
 * 1. Website domains (WEBSITE_HOSTS, e.g. "mkbfinancialgroup.com,www.mkbfinancialgroup.com")
 *    show the public website: "/bookkeeping" is served from "/site/bookkeeping". Only the
 *    website, public forms and the public form API are reachable there — never the CRM.
 * 2. When the backend is switched on (NEXT_PUBLIC_BACKEND=1), staff pages require a
 *    session cookie; without one the visitor goes to /login. This is only a convenience
 *    redirect — the real check happens on every /api request, which is where all data
 *    comes from.
 */
const ON = process.env.NEXT_PUBLIC_BACKEND === "1";
const STAFF_FREE = /^\/(api|login|f\/|site(\/|$)|_next|brand|favicon|icon|apple-icon)/;

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const siteHosts = (process.env.WEBSITE_HOSTS ?? "").toLowerCase().split(",").map((h) => h.trim()).filter(Boolean);
  const path = req.nextUrl.pathname;
  if (siteHosts.includes(host)) {
    if (/^\/(_next|brand|favicon|icon|apple-icon|f\/|api\/public\/)/.test(path)) return NextResponse.next();
    if (path.startsWith("/api/")) return new NextResponse("Not found", { status: 404 });
    const url = req.nextUrl.clone();
    url.pathname = path.startsWith("/site/media/") ? path : `/site${path === "/" ? "" : path}`;
    const h = new Headers(req.headers);
    h.set("x-mkb-site", "1");
    return NextResponse.rewrite(url, { request: { headers: h } });
  }
  if (!ON || STAFF_FREE.test(path)) return NextResponse.next();
  if (req.cookies.has("mkb_session") || req.cookies.has("__Host-mkb_session")) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
