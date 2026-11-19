/**
 * Meta Pixel and Google Analytics 4 for the public website — marketing pages only.
 *
 * Tax and financial information must never reach ad or analytics companies (IRC §7216, FTC
 * Safeguards Rule). So the tags are left off any page that collects information (forms, the
 * tax calculator, booking, the WISP generator, the store's checkout pages), and the Meta Pixel
 * runs with automatic configuration off, so it never reads form fields or button text.
 * Only page views are sent.
 */
import type { Section, SiteSettings } from "./types";

/** Pages that collect information, by address. */
const NO_TRACK_SLUGS = /^(contact|get-started|tax-calculator|calculator|book-consultation|store\/thanks|privacy|text-terms)(\/|$)/;
/** Section types that collect information. */
const NO_TRACK_SECTIONS = new Set<Section["type"]>(["form", "embed", "wisp"]);
/** Full-HTML pages that collect information (a form, an embedded tool, a booking frame). */
const COLLECTS = /<form\b|data-mkb-frame|<iframe\b/i;

export function trackable(slug: string, sections: Section[], html?: string) {
  if (NO_TRACK_SLUGS.test(slug)) return false;
  if (sections.some((x) => NO_TRACK_SECTIONS.has(x.type))) return false;
  if (html !== undefined && COLLECTS.test(html)) return false;
  return true;
}

/** The tags for <head>, or "" when none are set. IDs are validated when settings are saved. */
export function trackingTags(st: Pick<SiteSettings, "metaPixelId" | "ga4Id">) {
  const out: string[] = [];
  const ga = st.ga4Id && /^G-[A-Z0-9]{4,16}$/.test(st.ga4Id) ? st.ga4Id : "";
  const px = st.metaPixelId && /^\d{8,20}$/.test(st.metaPixelId) ? st.metaPixelId : "";
  if (ga) out.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${ga}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}',{allow_google_signals:false,allow_ad_personalization_signals:false});</script>`);
  if (px) out.push(`<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('set','autoConfig',false,'${px}');fbq('init','${px}');fbq('track','PageView');</script><noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${px}&ev=PageView&noscript=1"/></noscript>`);
  return out.join("");
}

/** Adds the tags to a full HTML page (before </head>, else at the top). */
export function withTracking(html: string, tags: string) {
  if (!tags) return html;
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${tags}</head>`) : tags + html;
}
