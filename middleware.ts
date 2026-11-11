import { NextResponse, type NextRequest } from "next/server";

/**
 * 1. Website domains (WEBSITE_HOSTS, e.g. "mkbfinancialgroup.com,www.mkbfinancialgroup.com")
 *    show the public website: "/bookkeeping" is served from "/site/bookkeeping". Only the
 *    website, public forms, private client links (/i/<token>) and the public API are
 *    reachable there — never the CRM.
 * 2. When the backend is switched on (NEXT_PUBLIC_BACKEND=1), staff pages require a
 *    session cookie; without one the visitor goes to /login. This is only a convenience
 *    redirect — the real check happens on every /api request, which is where all data
 *    comes from.
 */
const ON = process.env.NEXT_PUBLIC_BACKEND === "1";
const OLD_PATHS: Record<string, string> = { "/about-mkb": "/about", "/about-us": "/about", "/get-started": "/contact", "/mkb-financial-group": "/" };
const STAFF_FREE = /^\/(api|login|portal(\/|$)|f\/|i\/|w\/|site(\/|$)|msite(\/|$)|_next|brand|favicon|icon|apple-icon)/;

// 3. The client portal's own address (PORTAL_HOSTS, e.g. "portal.mkbfinancialgroup.com") only serves
//    the portal, client sign-in and the public links — never staff screens or staff APIs.
const PORTAL_OK = /^\/(portal(\/|$)|api\/portal\/|api\/public\/|api\/auth\/(logout|session|password\/forgot|password\/reset|invite\/accept)$|i\/|_next|brand|favicon|icon|apple-icon)/;

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const portalHosts = (process.env.PORTAL_HOSTS ?? "").toLowerCase().split(",").map((h) => h.trim()).filter(Boolean);
  if (portalHosts.includes(host)) {
    const p = req.nextUrl.pathname;
    if (p === "/" || p === "") return NextResponse.redirect(`https://${host}/portal`, 302);
    if (p === "/favicon.ico") { const url = req.nextUrl.clone(); url.pathname = "/brand/mkb-seal.ico"; return NextResponse.rewrite(url); }
    if (PORTAL_OK.test(p)) return NextResponse.next();
    return p.startsWith("/api/") ? new NextResponse("Not found", { status: 404 }) : NextResponse.redirect(`https://${host}/portal`, 302);
  }
  // 4. Monarch Tax Suite's domains (MONARCH_HOSTS) show Monarch's website: "/software" is served from "/msite/software".
  const monarchHosts = (process.env.MONARCH_HOSTS ?? "").toLowerCase().split(",").map((h) => h.trim()).filter(Boolean);
  if (monarchHosts.includes(host)) {
    const p = req.nextUrl.pathname;
    const search = req.nextUrl.search;
    if (!host.startsWith("www.") && monarchHosts.includes(`www.${host}`)) return NextResponse.redirect(`https://www.${host}${p}${search}`, 301);
    if (p === "/msite" || p.startsWith("/msite/")) return NextResponse.redirect(`https://${host}${p.slice(6) || "/"}${search}`, 301);
    if (p === "/favicon.ico") { const url = req.nextUrl.clone(); url.pathname = "/brand/monarch-icon-32.png"; return NextResponse.rewrite(url); }
    if (/^\/(_next|brand|site\/media\/|i\/m\/|w\/|api\/public\/)/.test(p)) return NextResponse.next();
    if (p.startsWith("/api/")) return new NextResponse("Not found", { status: 404 });
    const url = req.nextUrl.clone();
    url.pathname = `/msite${p === "/" ? "" : p}`;
    const h = new Headers(req.headers);
    h.set("x-monarch-site", "1");
    return NextResponse.rewrite(url, { request: { headers: h } });
  }
  const siteHosts = (process.env.WEBSITE_HOSTS ?? "").toLowerCase().split(",").map((h) => h.trim()).filter(Boolean);
  const path = req.nextUrl.pathname;
  if (siteHosts.includes(host)) {
    // One address: example.com → www.example.com (when both are website domains).
    // Redirects are built from the visitor's own host: on Cloudflare, req.nextUrl can carry the
    // Worker's internal address (the Access-protected workers.dev name), which visitors must never see.
    const search = req.nextUrl.search;
    if (!host.startsWith("www.") && siteHosts.includes(`www.${host}`)) {
      return NextResponse.redirect(`https://www.${host}${path}${search}`, 301);
    }
    // In-app website links (/site/...) opened on the website's own domain.
    if (path === "/site" || (path.startsWith("/site/") && !path.startsWith("/site/media/")))
      return NextResponse.redirect(`https://${host}${path.slice(5) || "/"}${search}`, 301);
    // Addresses from the old website.
    const moved = OLD_PATHS[path.replace(/\/+$/, "")];
    if (moved !== undefined) return NextResponse.redirect(`https://${host}${moved}${search}`, 301);
    // The website's icon (browsers also ask for /favicon.ico directly).
    if (path === "/favicon.ico") {
      const url = req.nextUrl.clone();
      url.pathname = "/brand/mkb-seal.ico";
      return NextResponse.rewrite(url);
    }
    if (/^\/(_next|brand|favicon|icon|apple-icon|f\/|i\/|w\/|api\/public\/)/.test(path)) return NextResponse.next();
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
