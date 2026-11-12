/**
 * Section-built website pages as plain HTML text (the public site). Same markup
 * and styles as the editor's live preview (components/site/SiteRenderer.tsx).
 * Forms and the WISP generator load in small self-sizing frames (/w/...).
 */
import { SITE_CSS } from "./site-css";
import type { Section, SiteKey, SitePage, SiteSettings } from "./types";

export type NavLink = { slug: string; title: string };
const e = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderSectionsBody(x: { settings: SiteSettings; page: Pick<SitePage, "slug" | "title" | "hideNav">; sections: Section[]; nav: NavLink[]; base: string; site: SiteKey; legal?: NavLink[] }) {
  const { settings: st, nav, base, site } = x;
  const funnel = !!x.page.hideNav;
  const L = (href: string) => (href.startsWith("/") && !href.startsWith("/f/") ? `${base}${href === "/" ? "" : href}` || "/" : href);
  const ext = (href: string) => (/^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : "");
  const a = (href: string, label: string, cls = "") => `<a${cls ? ` class="${cls}"` : ""} href="${e(L(href))}"${ext(href)}>${e(label)}</a>`;
  const cta = st.ctaLabel && st.ctaHref ? { label: st.ctaLabel, href: st.ctaHref } : null;
  const booking = st.bookingLabel && st.bookingHref ? { label: st.bookingLabel, href: st.bookingHref } : null;
  const paras = (t?: string) => (t ? t.split(/\n\s*\n/).map((p) => `<p>${e(p)}</p>`).join("") : "");
  const pre = (t: string) => `<p style="white-space:pre-line">${e(t)}</p>`;
  const head = (s: Section, h: "h1" | "h2" = "h2") => `${s.eyebrow ? `<div class="eyebrow">${e(s.eyebrow)}</div>` : ""}${s.title ? `<${h} class="${h}">${e(s.title)}</${h}>` : ""}`;
  const buttons = (s: Section, dark?: boolean) => (s.buttons?.length ? `<div class="actions">${s.buttons.map((b, i) => a(b.href, b.label, `btn ${b.style ?? (i === 0 ? "gold" : "outline")}${b.style === "dark" && dark ? " outline" : ""}`)).join("")}</div>` : "");
  const lead = (s: Section) => (s.body ? `<div class="lead">${paras(s.body)}</div>` : "");
  const frame = (src: string, title: string) => `<iframe class="mkb-widget" data-mkb-frame src="${e(src)}" title="${e(title)}" loading="lazy" style="width:100%;border:0;min-height:520px;display:block"></iframe>`;
  const autoCols = (n: number) => (n % 4 === 0 ? 4 : n === 2 ? 2 : 3);

  const section = (s: Section): string => {
    const tone = `tone-${s.tone ?? "light"}`;
    switch (s.type) {
      case "hero":
        return `<section class="hero${s.image ? "" : " noimg"}"><div class="wrap grid"><div class="copy">${head(s, "h1")}${lead(s)}${buttons(s, true)}</div>${s.image ? `<div class="photo"><img src="${e(s.image)}" alt=""></div>` : ""}</div></section>`;
      case "cards":
      case "pricing":
        return `<section class="sec ${tone}"><div class="wrap">${head(s)}${lead(s)}<div class="cards cols-${s.columns ?? autoCols(s.items?.length ?? 3)}">${(s.items ?? []).map((it) => s.type === "pricing"
          ? `<div class="card price${it.featured ? " featured" : ""}">${it.label ? `<div class="lbl">${e(it.label)}</div>` : ""}<h3>${e(it.title)}</h3>${it.price ? `<div class="amt">${e(it.price)}${it.unit ? `<small>${e(it.unit)}</small>` : ""}</div>` : ""}${it.body ? pre(it.body) : ""}</div>`
          : `<div class="card">${it.label ? `<div class="lbl">${e(it.label)}</div>` : ""}<h3>${e(it.title)}</h3>${it.body ? pre(it.body) : ""}</div>`).join("")}</div>${s.note ? `<p class="note">${e(s.note)}</p>` : ""}${buttons(s, s.tone === "dark")}</div></section>`;
      case "faq":
        return `<section class="sec ${tone}"><div class="wrap">${head(s)}${lead(s)}<div class="faq">${(s.items ?? []).map((it) => `<details><summary>${e(it.title)}</summary>${paras(it.body)}</details>`).join("")}</div></div></section>`;
      case "cta":
        return `<section class="cta"><div class="wrap inner"><div>${s.title ? `<h2>${e(s.title)}</h2>` : ""}${s.body ? `<p>${e(s.body)}</p>` : ""}</div>${buttons(s)}</div></section>`;
      case "form":
        return `<section class="sec ${tone}"><div class="wrap">${head(s)}${lead(s)}<div class="formbox">${site === "monarch" ? frame("/w/monarch-contact", s.title || "Contact form") : frame(`/w/form/${encodeURIComponent(s.formSlug ?? "")}${s.afterHref ? `?after=${encodeURIComponent(L(s.afterHref))}` : ""}`, s.title || "Contact form")}</div></div></section>`;
      case "wisp":
        return `<section class="sec ${tone}"><div class="wrap">${head(s)}${lead(s)}<div class="formbox">${frame(`/w/wisp?next=${encodeURIComponent(L("/wisp-next-steps"))}`, "WISP Generator")}</div></div></section>`;
      case "embed": {
        const fixed = base ? (s.html ?? "").replace(/href="\/(?!\/)/g, `href="${base}/`) : s.html ?? "";
        const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_top"></head><body style="margin:0">${fixed}</body></html>`;
        return `<section><iframe class="embed" title="${e(s.title || "Embedded content")}" style="height:${s.height ?? 900}px" sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation" srcdoc="${e(doc)}" loading="lazy"></iframe></section>`;
      }
      case "document":
        return "";
      default:
        return `<section class="sec ${tone}"><div class="wrap">${head(s)}${lead(s)}${buttons(s, s.tone === "dark")}</div></section>`;
    }
  };

  const logo = st.logo ? `<img src="${e(st.logo)}" alt="${e(st.siteName)}">` : `<span class="name">${e(st.siteName)}</span>`;
  const menu = funnel ? "" : `<nav class="links" aria-label="Main">${nav.map((p) => a(`/${p.slug}`, p.title)).join("")}${st.portalHref ? a(st.portalHref, "Client Portal") : ""}${cta ? a(cta.href, cta.label, "btn gold") : ""}</nav><details class="menu"><summary aria-label="Open menu">MENU</summary><nav aria-label="Menu">${a("/", "Home")}${nav.map((p) => a(`/${p.slug}`, p.title)).join("")}${st.portalHref ? a(st.portalHref, "Client Portal Sign In") : ""}${cta ? a(cta.href, cta.label) : ""}${booking ? a(booking.href, booking.label) : ""}</nav></details>`;
  const explore = ["about", "resources", "calculator", "tax-calculator"];
  const foot = funnel ? "" : `<div class="foot"><div>${st.logo ? `<img src="${e(st.logo.replace("/brand/monarch-logo-light.", "/brand/monarch-logo-dark."))}" alt="${e(st.siteName)}">` : `<p style="font:600 20px Georgia,serif;color:#fff">${e(st.siteName)}</p>`}${st.footerBlurb ? `<p>${e(st.footerBlurb)}</p>` : ""}${st.tagline ? `<p style="color:#f6d37a">${e(st.tagline)}</p>` : ""}</div>`
    + `<div><h4>SERVICES</h4>${nav.filter((p) => !explore.includes(p.slug)).map((p) => a(`/${p.slug}`, p.title)).join("")}</div>`
    + `<div><h4>EXPLORE</h4>${nav.filter((p) => explore.includes(p.slug)).map((p) => a(`/${p.slug}`, p.title)).join("")}${cta ? a(cta.href, cta.label) : ""}${booking && booking.href !== cta?.href ? a(booking.href, booking.label) : ""}${st.portalHref ? a(st.portalHref, "Client Portal Sign In") : ""}</div>`
    + `<div><h4>CONTACT</h4>${st.email ? `<a href="mailto:${e(st.email)}">${e(st.email)}</a>` : ""}${st.phone ? `<a href="tel:${e(st.phone.replace(/[^\d+]/g, ""))}">${e(st.phone)}</a>` : ""}${st.location ? `<p>${e(st.location)}</p>` : ""}${st.facebook || st.instagram ? `<h4 style="margin-top:22px">FOLLOW</h4>` : ""}${st.facebook ? `<a href="${e(st.facebook)}" target="_blank" rel="noopener noreferrer">Facebook</a>` : ""}${st.instagram ? `<a href="${e(st.instagram)}" target="_blank" rel="noopener noreferrer">Instagram</a>` : ""}</div></div>`;
  const year = new Date().getFullYear();
  return `<div class="mkbsite site-${site}"><style>${SITE_CSS}</style>${st.topBar ? `<div class="topbar">${e(st.topBar)}</div>` : ""}<header class="header"><div class="wrap bar"><a href="${e(L("/"))}" class="logo" aria-label="${e(st.siteName)} home">${logo}</a>${menu}</div></header><main>${x.sections.map(section).join("") || `<section class="sec tone-light"><div class="wrap"><p class="lead">This page has no sections yet.</p></div></section>`}</main><footer class="footer"><div class="wrap">${foot}<div class="copyright"><span>© ${year} ${e(st.siteName)}. All rights reserved.${(x.legal ?? []).map((l) => ` · ${a(`/${l.slug}`, l.title)}`).join("")}</span>${st.tagline ? `<span>${e(st.tagline)}</span>` : ""}</div></div></footer></div>`;
}
