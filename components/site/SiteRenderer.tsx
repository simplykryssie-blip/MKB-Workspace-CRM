import { SiteForm } from "./SiteForm";
import type { Section, SitePage, SiteSettings } from "@/lib/website/types";

/**
 * Renders a public website page (black-and-gold MKB design). Pure: used by the
 * public pages on the server and by the editor's live preview. `base` is the path
 * prefix ("" on the website's own domain, "/site" inside the app).
 */
export type NavLink = { slug: string; title: string };
type Props = { settings: SiteSettings; page: Pick<SitePage, "slug" | "title">; sections: Section[]; nav: NavLink[]; base: string; preview?: boolean; banner?: React.ReactNode };

export function SiteRenderer({ settings: st, sections, nav, base, preview, banner }: Props) {
  const L = (href: string) => (href.startsWith("/") && !href.startsWith("/f/") ? `${base}${href === "/" ? "" : href}` || "/" : href);
  const ext = (href: string) => (/^https?:/i.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {});
  const headerCta = st.ctaLabel && st.ctaHref ? { label: st.ctaLabel, href: st.ctaHref } : null;
  const booking = st.bookingLabel && st.bookingHref ? { label: st.bookingLabel, href: st.bookingHref } : null;
  const year = new Date().getFullYear();
  return (
    <div className="mkbsite">
      {banner}
      {st.topBar && <div className="topbar">{st.topBar}</div>}
      <header className="header">
        <div className="wrap bar">
          <a href={L("/")} className="logo" aria-label={`${st.siteName} home`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {st.logo ? <img src={st.logo} alt={st.siteName} /> : <span className="name">{st.siteName}</span>}
          </a>
          <nav className="links" aria-label="Main">
            {nav.map((p) => <a key={p.slug} href={L(`/${p.slug}`)}>{p.title}</a>)}
            {st.portalHref && <a href={L(st.portalHref)} {...ext(st.portalHref)}>Client Portal</a>}
            {headerCta && <a className="btn gold" href={L(headerCta.href)} {...ext(headerCta.href)}>{headerCta.label}</a>}
          </nav>
          <details className="menu">
            <summary aria-label="Open menu">MENU</summary>
            <nav aria-label="Menu">
              <a href={L("/")}>Home</a>
              {nav.map((p) => <a key={p.slug} href={L(`/${p.slug}`)}>{p.title}</a>)}
              {st.portalHref && <a href={L(st.portalHref)} {...ext(st.portalHref)}>Client Portal Sign In</a>}
              {headerCta && <a href={L(headerCta.href)} {...ext(headerCta.href)}>{headerCta.label}</a>}
              {booking && <a href={L(booking.href)} {...ext(booking.href)}>{booking.label}</a>}
            </nav>
          </details>
        </div>
      </header>

      <main>
        {sections.map((s) => <SectionView key={s.id} s={s} L={L} ext={ext} base={base} preview={preview} />)}
        {!sections.length && (
          <section className="sec tone-light"><div className="wrap"><p className="lead">This page has no sections yet.</p></div></section>
        )}
      </main>

      <footer className="footer">
        <div className="wrap">
          <div className="foot">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {st.logo ? <img src={st.logo} alt={st.siteName} /> : <p style={{ font: "600 20px Georgia, serif", color: "#fff" }}>{st.siteName}</p>}
              {st.footerBlurb && <p>{st.footerBlurb}</p>}
              {st.tagline && <p style={{ color: "#f6d37a" }}>{st.tagline}</p>}
            </div>
            <div>
              <h4>SERVICES</h4>
              {nav.filter((p) => !["about", "resources"].includes(p.slug)).map((p) => <a key={p.slug} href={L(`/${p.slug}`)}>{p.title}</a>)}
            </div>
            <div>
              <h4>EXPLORE</h4>
              {nav.filter((p) => ["about", "resources"].includes(p.slug)).map((p) => <a key={p.slug} href={L(`/${p.slug}`)}>{p.title}</a>)}
              {headerCta && <a href={L(headerCta.href)} {...ext(headerCta.href)}>{headerCta.label}</a>}
              {booking && booking.href !== headerCta?.href && <a href={L(booking.href)} {...ext(booking.href)}>{booking.label}</a>}
              {st.portalHref && <a href={L(st.portalHref)} {...ext(st.portalHref)}>Client Portal Sign In</a>}
            </div>
            <div>
              <h4>CONTACT</h4>
              {st.email && <a href={`mailto:${st.email}`}>{st.email}</a>}
              {st.phone && <a href={`tel:${st.phone.replace(/[^\d+]/g, "")}`}>{st.phone}</a>}
              {st.location && <p>{st.location}</p>}
              {(st.facebook || st.instagram) && <h4 style={{ marginTop: 22 }}>FOLLOW</h4>}
              {st.facebook && <a href={st.facebook} target="_blank" rel="noopener noreferrer">Facebook</a>}
              {st.instagram && <a href={st.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>}
            </div>
          </div>
          <div className="copyright"><span>© {year} {st.siteName}. All rights reserved.</span>{st.tagline && <span>{st.tagline}</span>}</div>
        </div>
      </footer>
    </div>
  );
}

const autoCols = (n: number) => (n % 4 === 0 ? 4 : n === 2 ? 2 : 3);
const paras = (t?: string) => (t ? t.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>) : null);

function Buttons({ s, L, ext, dark }: { s: Section; L: (h: string) => string; ext: (h: string) => object; dark?: boolean }) {
  if (!s.buttons?.length) return null;
  return (
    <div className="actions">
      {s.buttons.map((b, i) => (
        <a key={i} className={`btn ${b.style ?? (i === 0 ? "gold" : "outline")}${b.style === "dark" && dark ? " outline" : ""}`} href={L(b.href)} {...ext(b.href)}>{b.label}</a>
      ))}
    </div>
  );
}

function Head({ s, as = "h2" }: { s: Section; as?: "h1" | "h2" }) {
  const H = as;
  return (
    <>
      {s.eyebrow && <div className="eyebrow">{s.eyebrow}</div>}
      {s.title && <H className={as === "h1" ? "h1" : "h2"}>{s.title}</H>}
    </>
  );
}

function SectionView({ s, L, ext, base, preview }: { s: Section; L: (h: string) => string; ext: (h: string) => object; base: string; preview?: boolean }) {
  const tone = `tone-${s.tone ?? "light"}`;
  switch (s.type) {
    case "hero":
      return (
        <section className={`hero${s.image ? "" : " noimg"}`}>
          <div className="wrap grid">
            <div className="copy">
              <Head s={s} as="h1" />
              {s.body && <div className="lead">{paras(s.body)}</div>}
              <Buttons s={s} L={L} ext={ext} dark />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {s.image && <div className="photo"><img src={s.image} alt="" /></div>}
          </div>
        </section>
      );
    case "cards":
    case "pricing":
      return (
        <section className={`sec ${tone}`}>
          <div className="wrap">
            <Head s={s} />
            {s.body && <div className="lead">{paras(s.body)}</div>}
            <div className={`cards cols-${s.columns ?? autoCols(s.items?.length ?? 3)}`}>
              {s.items?.map((it, i) =>
                s.type === "pricing" ? (
                  <div key={i} className={`card price${it.featured ? " featured" : ""}`}>
                    {it.label && <div className="lbl">{it.label}</div>}
                    <h3>{it.title}</h3>
                    {it.price && <div className="amt">{it.price}{it.unit && <small>{it.unit}</small>}</div>}
                    {it.body && <p>{it.body}</p>}
                  </div>
                ) : (
                  <div key={i} className="card">
                    {it.label && <div className="lbl">{it.label}</div>}
                    <h3>{it.title}</h3>
                    {it.body && <p>{it.body}</p>}
                  </div>
                ),
              )}
            </div>
            {s.note && <p className="note">{s.note}</p>}
            <Buttons s={s} L={L} ext={ext} dark={s.tone === "dark"} />
          </div>
        </section>
      );
    case "faq":
      return (
        <section className={`sec ${tone}`}>
          <div className="wrap">
            <Head s={s} />
            {s.body && <div className="lead">{paras(s.body)}</div>}
            <div className="faq">
              {s.items?.map((it, i) => (
                <details key={i}><summary>{it.title}</summary>{paras(it.body)}</details>
              ))}
            </div>
          </div>
        </section>
      );
    case "cta":
      return (
        <section className="cta">
          <div className="wrap inner">
            <div>{s.title && <h2>{s.title}</h2>}{s.body && <p>{s.body}</p>}</div>
            <Buttons s={s} L={L} ext={ext} />
          </div>
        </section>
      );
    case "form":
      return (
        <section className={`sec ${tone}`}>
          <div className="wrap">
            <Head s={s} />
            {s.body && <div className="lead">{paras(s.body)}</div>}
            <div className="formbox"><SiteForm slug={s.formSlug ?? ""} preview={preview} /></div>
          </div>
        </section>
      );
    case "embed":
      return (
        <section>
          <iframe
            className="embed"
            title={s.title || "Embedded content"}
            style={{ height: s.height ?? 900 }}
            // Sealed frame: the code runs on its own blank origin and can't reach the site, its cookies or visitors' sessions.
            sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
            srcDoc={embedDoc(s.html ?? "", base)}
            loading="lazy"
          />
        </section>
      );
    default:
      return (
        <section className={`sec ${tone}`}>
          <div className="wrap">
            <Head s={s} />
            {s.body && <div className="lead">{paras(s.body)}</div>}
            <Buttons s={s} L={L} ext={ext} dark={s.tone === "dark"} />
          </div>
        </section>
      );
  }
}

/** Site links inside custom code (href="/contact") open the right page in the main window. */
function embedDoc(html: string, base: string) {
  const fixed = base ? html.replace(/href="\/(?!\/)/g, `href="${base}/`) : html;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_top"></head><body style="margin:0">${fixed}</body></html>`;
}
