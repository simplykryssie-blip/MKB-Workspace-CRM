"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, ExternalLink, FilePlus2, Globe, ImageUp, Plus, Rocket, Settings2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { useTeam } from "@/lib/store/team-store";
import { BACKEND, RemoteError, call, debouncer } from "@/lib/sync/remote";
import { MKB_PAGES, MKB_SETTINGS } from "@/lib/website/mkb-content";
import { MONARCH_PAGES, MONARCH_SETTINGS } from "@/lib/website/monarch-content";
import { SECTION_TYPES, TONES, slugifyPage, type Section, type SectionType, type SiteItem, type SiteKey, type SitePage, type SiteSettings, type Website } from "@/lib/website/types";
import "@/components/site/site.css";

const save = debouncer(800);
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const sample = (site: SiteKey): Website => site === "monarch"
  ? { settings: { draft: structuredClone(MONARCH_SETTINGS), published: null, rev: 1 }, pages: structuredClone(MONARCH_PAGES) }
  : { settings: { draft: structuredClone(MKB_SETTINGS), published: structuredClone(MKB_SETTINGS), rev: 1 }, pages: structuredClone(MKB_PAGES) };
/** Which website the editor is working on (MKB's or Monarch's). */
const SiteCtx = createContext<SiteKey>("mkb");
const withSite = (path: string, site: SiteKey) => (site === "monarch" ? `${path}${path.includes("?") ? "&" : "?"}site=monarch` : path);

/**
 * Website editor: pages made of sections, edited as drafts and published when
 * ready. With the backend on, drafts save automatically and the server checks
 * Company Settings permissions (edit to change, approve to publish).
 */
export function WebsiteEditor({ which = "mkb" }: { which?: SiteKey }) {
  const team = useTeam();
  const toast = useToast();
  const api = (path: string) => withSite(path, which);
  const [site, setSite] = useState<Website | null>(BACKEND ? null : sample(which));
  const [sel, setSel] = useState<string>("settings");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const siteRef = useRef(site);
  siteRef.current = site;
  const mod = which === "monarch" ? "monarch" : "settings";
  const canView = team.can(mod, "view");
  const canEdit = team.can(mod, "edit");
  const canPublish = team.can(mod, "approve");

  const load = useCallback(async () => {
    if (!BACKEND) return;
    try {
      const w = await call<Website>("GET", api("/api/website"));
      setSite(w);
      setSel((s) => (s === "settings" || w.pages.some((p) => p.id === s) ? s : w.pages[0]?.id ?? "settings"));
    } catch (e) {
      setErr(e instanceof RemoteError ? e.message : "Couldn't load the website.");
    }
  }, [which]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (site && sel === "settings" && site.pages[0] && !BACKEND) setSel(site.pages[0].id); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fail = (e: unknown) => {
    const m = e instanceof RemoteError ? e.message : "Couldn't save. Check your connection.";
    toast(m, "info");
    if (e instanceof RemoteError && e.status === 409) void load();
  };

  /* ---------- changes (saved in the background) */
  const updateSettings = (patch: Partial<SiteSettings>) => {
    setSite((w) => (w ? { ...w, settings: { ...w.settings, draft: { ...w.settings.draft, ...patch } } } : w));
    if (BACKEND) save("settings", async () => {
      const w = siteRef.current!;
      try {
        const r = await call<{ rev: number }>("PUT", api("/api/website/settings"), { settings: w.settings.draft, rev: w.settings.rev });
        setSite((x) => (x ? { ...x, settings: { ...x.settings, rev: r.rev } } : x));
      } catch (e) { fail(e); }
    });
  };
  const updatePage = (id: string, patch: Partial<SitePage>) => {
    setSite((w) => (w ? { ...w, pages: w.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)) } : w));
    if (BACKEND) save(id, async () => {
      const p = siteRef.current!.pages.find((x) => x.id === id);
      if (!p) return;
      try {
        const r = await call<{ rev: number; slug: string }>("PUT", api(`/api/website/pages/${id}`), { page: p, rev: p.rev });
        setSite((x) => (x ? { ...x, pages: x.pages.map((q) => (q.id === id ? { ...q, rev: r.rev, slug: r.slug } : q)) } : x));
      } catch (e) { fail(e); }
    });
  };
  const setSections = (id: string, fn: (s: Section[]) => Section[]) => {
    const p = siteRef.current?.pages.find((x) => x.id === id);
    if (p) updatePage(id, { draft: fn(p.draft) });
  };

  const addPage = async () => {
    const title = window.prompt("Name of the new page (e.g. Expungement)")?.trim();
    if (!title || !site) return;
    let slug = slugifyPage(title) || "page";
    for (let i = 2; site.pages.some((p) => p.slug === slug); i++) slug = `${slugifyPage(title)}-${i}`;
    const page: SitePage = { id: uid("pg"), slug, title, description: "", nav: true, position: Math.max(0, ...site.pages.map((p) => p.position)) + 1, draft: [{ id: uid("sec"), type: "hero", eyebrow: title, title, body: "", buttons: [{ label: "Let's Talk About Your Business", href: "/contact", style: "gold" }] }, { id: uid("sec"), type: "cta", title: "You're building something. Let's build the foundation with it.", body: "Strategy • Growth • Legacy", buttons: [{ label: "Get Started", href: "/contact", style: "dark" }] }], published: null, rev: 1 };
    if (BACKEND) {
      try {
        const r = await call<{ rev: number; slug: string }>("POST", api("/api/website/pages"), { page });
        page.rev = r.rev;
        page.slug = r.slug;
      } catch (e) { return fail(e); }
    }
    setSite((w) => (w ? { ...w, pages: [...w.pages, page] } : w));
    setSel(page.id);
  };
  const removePage = async (p: SitePage) => {
    if (!window.confirm(`Delete “${p.title}”? It disappears from the editor and from the live site.`)) return;
    if (BACKEND) try { await call("POST", api(`/api/website/pages/${p.id}`), { action: "delete" }); } catch (e) { return fail(e); }
    setSite((w) => (w ? { ...w, pages: w.pages.filter((x) => x.id !== p.id) } : w));
    setSel("settings");
  };
  const publishAll = async () => {
    setBusy(true);
    try {
      if (BACKEND) {
        await new Promise((r) => setTimeout(r, 900)); // let pending saves finish
        await call("POST", api("/api/website/publish"), {});
        await load();
      } else setSite((w) => (w ? { settings: { ...w.settings, published: w.settings.draft }, pages: w.pages.map((p) => (p.published ? { ...p, published: p.draft } : p)) } : w));
      toast("Published — your changes to live pages are on the site.");
    } catch (e) { fail(e); }
    setBusy(false);
  };
  const publishPage = async (p: SitePage) => {
    setBusy(true);
    try {
      if (BACKEND) {
        await new Promise((r) => setTimeout(r, 900));
        await call("POST", api("/api/website/publish"), { pageIds: [p.id] });
        await load();
      } else setSite((w) => (w ? { ...w, pages: w.pages.map((x) => (x.id === p.id ? { ...x, published: x.draft } : x)) } : w));
      toast(`“${p.title}” is live.`);
    } catch (e) { fail(e); }
    setBusy(false);
  };
  const unpublishPage = async (p: SitePage) => {
    if (!window.confirm(`Take “${p.title}” off the live site? It stays here as a draft.`)) return;
    try {
      if (BACKEND) { await call("POST", api(`/api/website/pages/${p.id}`), { action: "unpublish" }); await load(); }
      else setSite((w) => (w ? { ...w, pages: w.pages.map((x) => (x.id === p.id ? { ...x, published: null } : x)) } : w));
      toast(`“${p.title}” is now a draft.`, "info");
    } catch (e) { fail(e); }
  };
  const importMkb = async () => {
    setBusy(true);
    try { await call("POST", api("/api/website/import"), {}); await load(); toast(which === "monarch" ? "Monarch's website is ready to edit — nothing is public until you publish." : "MKB's website is loaded and live."); } catch (e) { fail(e); }
    setBusy(false);
  };

  const pending = useMemo(() => (site ? (!same(site.settings.draft, site.settings.published) ? 1 : 0) + site.pages.filter((p) => p.published && !same(p.draft, p.published)).length : 0), [site]);
  const nav = useMemo(() => (site ? [...site.pages].sort((a, b) => a.position - b.position).filter((p) => p.nav && p.slug).map((p) => ({ slug: p.slug, title: p.title })) : []), [site]);

  if (!canView) return <p className="text-[14px] text-muted">You don&rsquo;t have access to the website editor.</p>;
  if (err) return <p role="alert" className="rounded-xl bg-danger-soft/60 px-3 py-2 text-[14px] text-danger-ink">{err}</p>;
  if (!site) return <div className="grid min-h-[40vh] place-items-center text-[14px] text-muted" role="status">Loading website…</div>;

  if (!site.pages.length && which === "monarch")
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-line bg-surface p-8 text-center shadow-soft">
        <Globe size={34} className="mx-auto text-accent" />
        <h1 className="mt-3 text-[20px] font-bold text-ink">Monarch&rsquo;s website</h1>
        <p className="mt-2 text-[14px] text-ink-2">Start from a ready-made Monarch website — Home, Software &amp; Packages, Bank Products, Partners, About and a Contact page whose form sends new leads to Monarch&rsquo;s Onboarding board. Everything starts as a draft: nothing is public until you press Publish.</p>
        <Button variant="primary" className="mt-5" icon={Rocket} disabled={busy || !canPublish} onClick={importMkb}>{busy ? "Starting…" : "Start Monarch’s website"}</Button>
      </div>
    );

  if (!site.pages.length)
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-line bg-surface p-8 text-center shadow-soft">
        <Globe size={34} className="mx-auto text-accent" />
        <h1 className="mt-3 text-[20px] font-bold text-ink">Your website</h1>
        <p className="mt-2 text-[14px] text-ink-2">Load MKB&rsquo;s website — the pages rebuilt from your old site (Home, Bookkeeping, Business Services, Tax Preparation, Payroll, About, Resources, Contact and the calculator) — and a &ldquo;Website contact&rdquo; form whose answers become leads assigned to you. The WISP funnel pages (Builder, Generator, LegalShield next steps) are loaded as drafts, not on the live site.</p>
        <Button variant="primary" className="mt-5" icon={Rocket} disabled={busy || !canPublish} onClick={importMkb}>{busy ? "Loading…" : "Load MKB’s website"}</Button>
        {!canPublish && <p className="mt-2 text-[12.5px] text-muted">Needs permission to publish the website (Company Settings → approve).</p>}
      </div>
    );

  const page = site.pages.find((p) => p.id === sel);
  const pages = [...site.pages].sort((a, b) => a.position - b.position);
  const livePath = (p?: SitePage) => `${which === "monarch" ? "/msite" : "/site"}${p && p.slug ? `/${p.slug}` : ""}`;

  return (
    <SiteCtx.Provider value={which}>
    <div>
      <PageHeader
        title={which === "monarch" ? "Monarch website" : "Website"}
        subtitle={pending ? `${pending} unpublished change${pending === 1 ? "" : "s"} to live pages — visitors still see the last published version.` : "Live pages are up to date."}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button icon={Eye} onClick={() => setPreview(true)}>Preview</Button>
            <Button icon={ExternalLink} href={livePath(page)}>Live site</Button>
            <Button variant="primary" icon={Rocket} disabled={busy || !pending || !canPublish} onClick={publishAll} title={canPublish ? undefined : "Your role can't publish"}>{busy ? "Publishing…" : "Publish"}</Button>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* page list */}
        <aside>
          <label className="block lg:hidden">
            <span className="sr-only">Page</span>
            <select value={sel} onChange={(e) => setSel(e.target.value)} className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] text-ink">
              <option value="settings">Site settings</option>
              {pages.map((p) => <option key={p.id} value={p.id}>{p.title}{!p.published ? " (draft)" : same(p.draft, p.published) ? "" : " •"}</option>)}
            </select>
          </label>
          <nav className="hidden overflow-hidden rounded-2xl border border-line bg-surface lg:block" aria-label="Pages">
            <button type="button" onClick={() => setSel("settings")} className={`flex w-full items-center gap-2 border-b border-line px-4 py-3 text-left text-[14px] ${sel === "settings" ? "bg-accent-soft font-semibold text-accent" : "text-ink-2 hover:bg-surface-hover"}`}><Settings2 size={16} />Site settings</button>
            {pages.map((p) => (
              <button key={p.id} type="button" onClick={() => setSel(p.id)} className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-[14px] ${sel === p.id ? "bg-accent-soft font-semibold text-accent" : "text-ink-2 hover:bg-surface-hover"}`}>
                <span className="truncate">{p.title}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {!p.published ? <span className="rounded-md bg-warning-soft px-1.5 text-[11px] font-semibold text-warning-ink">Draft</span> : !p.nav && p.slug ? <span className="text-[11px] text-faint">not in menu</span> : null}
                  {p.published && !same(p.draft, p.published) && <span className="h-2 w-2 rounded-full bg-warning" title="Unpublished changes" />}
                </span>
              </button>
            ))}
          </nav>
          {canEdit && <Button className="mt-3 w-full" icon={FilePlus2} onClick={addPage}>Add page</Button>}
        </aside>

        <div className="min-w-0">
          {sel === "settings" || !page ? (
            <SettingsForm s={site.settings.draft} onChange={updateSettings} disabled={!canEdit} />
          ) : (
            <PageForm key={page.id} page={page} onChange={(patch) => updatePage(page.id, patch)} setSections={(fn) => setSections(page.id, fn)} onDelete={() => removePage(page)} disabled={!canEdit} canDelete={canPublish && page.slug !== ""} onPublish={canPublish ? () => publishPage(page) : undefined} onUnpublish={canPublish && page.slug !== "" ? () => unpublishPage(page) : undefined} busy={busy} />
          )}
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-white" role="dialog" aria-label="Website preview">
          <SiteRenderer
            settings={site.settings.draft}
            page={page ?? pages[0]}
            sections={(page ?? pages[0]).draft}
            nav={nav}
            base={which === "monarch" ? "/msite" : "/site"}
            site={which}
            preview
            banner={<div className="draftbar">Preview of your unpublished draft · <button type="button" onClick={() => setPreview(false)} style={{ fontWeight: 800, textDecoration: "underline" }}>Close preview</button></div>}
          />
          <button type="button" onClick={() => setPreview(false)} aria-label="Close preview" className="fixed bottom-5 right-5 z-[101] grid h-12 w-12 place-items-center rounded-full bg-black text-white shadow-lg"><X size={20} /></button>
        </div>
      )}
    </div>
    </SiteCtx.Provider>
  );
}

/* ---------------------------------------------------------------- site settings */
function SettingsForm({ s, onChange, disabled }: { s: SiteSettings; onChange: (p: Partial<SiteSettings>) => void; disabled: boolean }) {
  const f = (k: keyof SiteSettings, label: string, hint?: string) => <TextField label={label} hint={hint} value={s[k]} disabled={disabled} onChange={(e) => onChange({ [k]: e.target.value })} />;
  return (
    <div className="space-y-5">
      <Panel title="Brand">
        <div className="grid gap-4 sm:grid-cols-2">
          {f("siteName", "Business name")}
          {f("tagline", "Tagline")}
          <div className="sm:col-span-2">{f("topBar", "Top bar text", "the thin black strip at the very top")}</div>
          <div className="sm:col-span-2"><ImageField label="Logo" value={s.logo} onChange={(v) => onChange({ logo: v })} disabled={disabled} /></div>
          <div className="sm:col-span-2"><TextArea label="Footer description" value={s.footerBlurb} disabled={disabled} onChange={(e) => onChange({ footerBlurb: e.target.value })} /></div>
        </div>
      </Panel>
      <Panel title="Contact & social">
        <div className="grid gap-4 sm:grid-cols-2">
          {f("phone", "Phone")}
          {f("email", "Email")}
          {f("location", "Service area")}
          <span />
          {f("facebook", "Facebook link")}
          {f("instagram", "Instagram link")}
        </div>
      </Panel>
      <Panel title="Header buttons">
        <div className="grid gap-4 sm:grid-cols-2">
          {f("ctaLabel", "Main button text")}
          {f("ctaHref", "Main button link", "/contact")}
          {f("bookingLabel", "Booking link text")}
          {f("bookingHref", "Booking link")}
          <div className="sm:col-span-2">{f("portalHref", "Client portal sign-in link", "leave empty to hide")}</div>
        </div>
        <p className="mt-3 text-[12.5px] text-muted">Links: a page of this site (e.g. <code>/contact</code>), or a full address starting with https://.</p>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------- one page */
function PageForm({ page, onChange, setSections, onDelete, disabled, canDelete, onPublish, onUnpublish, busy }: { page: SitePage; onChange: (p: Partial<SitePage>) => void; setSections: (fn: (s: Section[]) => Section[]) => void; onDelete: () => void; disabled: boolean; canDelete: boolean; onPublish?: () => void; onUnpublish?: () => void; busy: boolean }) {
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(page.draft[0]?.id ?? null);
  const isHome = page.slug === "";
  const move = (i: number, d: -1 | 1) => setSections((s) => { const n = [...s]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); return n; });
  const add = (type: SectionType) => {
    const sec: Section = { id: uid("sec"), type, tone: "light", title: type === "cta" ? "Ready to get started?" : "New section", ...(type === "cards" || type === "pricing" || type === "faq" ? { items: [{ title: "Item", body: "" }] } : {}), ...(type === "form" ? { formSlug: "contact" } : {}), ...(type === "embed" ? { html: "", height: 900 } : {}), ...(type === "cta" ? { buttons: [{ label: "Get Started", href: "/contact", style: "dark" as const }] } : {}) };
    setSections((s) => [...s, sec]);
    setOpen(sec.id);
    setAdding(false);
  };
  return (
    <div className="space-y-5">
      <Panel title={isHome ? "Home page" : "Page details"} actions={canDelete ? <Button size="sm" variant="ghost" icon={Trash2} onClick={onDelete}>Delete page</Button> : undefined}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Page name" value={page.title} disabled={disabled} onChange={(e) => onChange({ title: e.target.value })} />
          {isHome ? <TextField label="Web address" value="/ (home)" disabled /> : <TextField label="Web address" hint={`/${page.slug}`} value={page.slug} disabled={disabled} onChange={(e) => onChange({ slug: slugifyPage(e.target.value) })} onBlur={(e) => onChange({ slug: slugifyPage(e.target.value) || slugifyPage(page.title) })} />}
          <div className="sm:col-span-2"><TextArea label="Search engine description (1–2 sentences)" value={page.description} disabled={disabled} onChange={(e) => onChange({ description: e.target.value })} /></div>
          {!isHome && <Checkbox label="Show in the menu" checked={page.nav} disabled={disabled} onChange={(e) => onChange({ nav: e.target.checked })} />}
          {!isHome && <Checkbox label="Funnel page — hide the menu" hint="Visitors see only your logo and this page’s buttons, so they stay on the path" checked={!!page.hideNav} disabled={disabled} onChange={(e) => onChange({ hideNav: e.target.checked })} />}
          <TextField label="Menu order" type="number" min={0} max={999} value={page.position} disabled={disabled} onChange={(e) => onChange({ position: Number(e.target.value) })} />
        </div>
        {page.published ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-success-soft/50 px-3 py-2.5">
            <span className="text-[13px] text-ink-2"><strong className="text-success-ink">Live.</strong> {same(page.draft, page.published) ? "Visitors see this version." : "Your edits go live when you tap Publish."}</span>
            {onUnpublish && <Button size="sm" variant="ghost" onClick={onUnpublish}>Take off the live site</Button>}
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warning-soft/60 px-3 py-2.5">
            <span className="text-[13px] text-ink-2"><strong className="text-warning-ink">Draft.</strong> Not on the live site — the Publish button doesn&rsquo;t include it.</span>
            {onPublish && <Button size="sm" variant="primary" icon={Rocket} disabled={busy} onClick={onPublish}>Publish this page</Button>}
          </div>
        )}
      </Panel>

      <div>
        <h2 className="mb-2 text-[15px] font-semibold text-ink">Sections</h2>
        <ol className="space-y-3">
          {page.draft.map((s, i) => {
            const meta = SECTION_TYPES.find((t) => t.key === s.type)!;
            const isOpen = open === s.id;
            return (
              <li key={s.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button type="button" onClick={() => setOpen(isOpen ? null : s.id)} className="min-h-11 min-w-0 flex-1 text-left" aria-expanded={isOpen}>
                    <span className="block text-[11.5px] font-semibold uppercase tracking-wide text-muted">{i + 1}. {meta.label}</span>
                    <span className="block truncate text-[14px] font-medium text-ink">{s.title || s.eyebrow || (s.type === "embed" ? "Custom code" : "Untitled")}</span>
                  </button>
                  {!disabled && (
                    <span className="flex shrink-0 items-center">
                      <IconBtn label="Move up" icon={ArrowUp} disabled={i === 0} onClick={() => move(i, -1)} />
                      <IconBtn label="Move down" icon={ArrowDown} disabled={i === page.draft.length - 1} onClick={() => move(i, 1)} />
                      <IconBtn label="Duplicate" icon={Copy} onClick={() => setSections((x) => [...x.slice(0, i + 1), { ...structuredClone(s), id: uid("sec") }, ...x.slice(i + 1)])} />
                      <IconBtn label="Remove section" icon={Trash2} onClick={() => window.confirm("Remove this section?") && setSections((x) => x.filter((y) => y.id !== s.id))} />
                    </span>
                  )}
                </div>
                {isOpen && <div className="border-t border-line p-4"><SectionForm s={s} disabled={disabled} onChange={(patch) => setSections((x) => x.map((y) => (y.id === s.id ? { ...y, ...patch } : y)))} /></div>}
              </li>
            );
          })}
        </ol>
        {!disabled && (adding ? (
          <div className="mt-3 rounded-2xl border border-line bg-surface p-3">
            <div className="mb-2 flex items-center justify-between"><span className="text-[13px] font-semibold text-ink">Add a section</span><IconBtn label="Cancel" icon={X} onClick={() => setAdding(false)} /></div>
            <div className="grid gap-2 sm:grid-cols-2">
              {SECTION_TYPES.map((t) => (
                <button key={t.key} type="button" onClick={() => add(t.key)} className="rounded-xl border border-line p-3 text-left hover:border-accent hover:bg-accent-soft/40">
                  <span className="block text-[14px] font-semibold text-ink">{t.label}</span>
                  <span className="block text-[12.5px] text-muted">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>
        ) : <Button className="mt-3" icon={Plus} onClick={() => setAdding(true)}>Add section</Button>)}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- one section */
function SectionForm({ s, onChange, disabled }: { s: Section; onChange: (p: Partial<Section>) => void; disabled: boolean }) {
  const siteKey = useContext(SiteCtx);
  const t = s.type;
  const items = s.items ?? [];
  const setItem = (i: number, p: Partial<SiteItem>) => onChange({ items: items.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const itemName = t === "faq" ? "question" : t === "pricing" ? "package" : "card";
  return (
    <div className="space-y-4">
      {t !== "embed" && t !== "cta" && t !== "hero" && (
        <SelectField label="Background" value={s.tone ?? "light"} disabled={disabled} onChange={(e) => onChange({ tone: e.target.value as Section["tone"] })} options={TONES.map((x) => [x.key, x.label])} />
      )}
      {t !== "embed" && t !== "cta" && <TextField label="Small heading (gold, above the title)" value={s.eyebrow ?? ""} disabled={disabled} onChange={(e) => onChange({ eyebrow: e.target.value })} />}
      {t !== "embed" && <TextArea label="Title" rows={2} value={s.title ?? ""} disabled={disabled} onChange={(e) => onChange({ title: e.target.value })} />}
      {t !== "embed" && <TextArea label={t === "cta" ? "Line under the title" : "Text"} rows={t === "text" ? 6 : 3} value={s.body ?? ""} disabled={disabled} onChange={(e) => onChange({ body: e.target.value })} />}
      {t === "hero" && <ImageField label="Photo (right side)" value={s.image ?? ""} onChange={(v) => onChange({ image: v })} disabled={disabled} />}
      {(t === "cards" || t === "pricing") && (
        <SelectField label="Columns" value={String(s.columns ?? "")} disabled={disabled} onChange={(e) => onChange({ columns: e.target.value ? (Number(e.target.value) as 2 | 3 | 4) : undefined })} options={[["", "Automatic"], ["2", "2"], ["3", "3"], ["4", "4"]]} />
      )}
      {(t === "cards" || t === "pricing" || t === "faq") && (
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{t === "faq" ? "Questions" : t === "pricing" ? "Packages" : "Cards"}</span>
          <ol className="space-y-3">
            {items.map((it, i) => (
              <li key={i} className="rounded-xl border border-line bg-bg p-3">
                <div className="mb-2 flex items-center justify-between"><span className="text-[12px] font-semibold text-muted">{itemName} {i + 1}</span>
                  {!disabled && <span className="flex"><IconBtn label="Move up" icon={ArrowUp} disabled={i === 0} onClick={() => { const n = [...items]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange({ items: n }); }} /><IconBtn label={`Remove ${itemName}`} icon={Trash2} onClick={() => onChange({ items: items.filter((_, j) => j !== i) })} /></span>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {t !== "faq" && <TextField label="Small label" value={it.label ?? ""} disabled={disabled} onChange={(e) => setItem(i, { label: e.target.value })} />}
                  <TextField label={t === "faq" ? "Question" : "Title"} value={it.title} disabled={disabled} onChange={(e) => setItem(i, { title: e.target.value })} />
                  {t === "pricing" && <TextField label="Price" hint="e.g. $399" value={it.price ?? ""} disabled={disabled} onChange={(e) => setItem(i, { price: e.target.value })} />}
                  {t === "pricing" && <TextField label="Per" hint="e.g. /mo" value={it.unit ?? ""} disabled={disabled} onChange={(e) => setItem(i, { unit: e.target.value })} />}
                  <div className="sm:col-span-2"><TextArea label={t === "faq" ? "Answer" : "Text"} value={it.body ?? ""} disabled={disabled} onChange={(e) => setItem(i, { body: e.target.value })} /></div>
                  {t === "pricing" && <Checkbox label="Highlight (black card)" checked={!!it.featured} disabled={disabled} onChange={(e) => setItem(i, { featured: e.target.checked })} />}
                </div>
              </li>
            ))}
          </ol>
          {!disabled && <Button size="sm" className="mt-2" icon={Plus} onClick={() => onChange({ items: [...items, { title: "" }] })}>Add {itemName}</Button>}
        </div>
      )}
      {(t === "pricing" || t === "cards") && <TextArea label="Small print under the cards" value={s.note ?? ""} disabled={disabled} onChange={(e) => onChange({ note: e.target.value })} />}
      {t === "form" && (siteKey === "monarch"
        ? <p className="rounded-xl bg-accent-soft px-3 py-2 text-[13px] text-accent-ink">Monarch&rsquo;s contact form: name, office, email, phone, city, number of locations and a message. Each answer becomes a new &ldquo;Interested&rdquo; office on Monarch&rsquo;s Onboarding board.</p>
        : <>
          <TextField label="Form link name" hint="from Forms, e.g. contact" value={s.formSlug ?? ""} disabled={disabled} onChange={(e) => onChange({ formSlug: e.target.value })} />
          <TextField label="After submitting, go to" hint="optional — a page address like /calculator (for funnels)" value={s.afterHref ?? ""} disabled={disabled} onChange={(e) => onChange({ afterHref: e.target.value })} />
        </>
      )}
      {t === "embed" && (
        <>
          <TextField label="Name (for screen readers)" value={s.title ?? ""} disabled={disabled} onChange={(e) => onChange({ title: e.target.value })} />
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">HTML code</span>
            <textarea value={s.html ?? ""} disabled={disabled} onChange={(e) => onChange({ html: e.target.value })} rows={10} spellCheck={false} className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 font-mono text-[12.5px] text-ink focus:border-accent focus:outline-none" />
          </label>
          <TextField label="Height (pixels)" type="number" min={200} max={4000} value={s.height ?? 900} disabled={disabled} onChange={(e) => onChange({ height: Number(e.target.value) })} />
          <p className="text-[12.5px] text-muted">Custom code runs in a sealed frame: it can&rsquo;t read the site, its visitors&rsquo; sessions or anything in your CRM.</p>
        </>
      )}
      {t !== "embed" && t !== "faq" && t !== "form" && (
        <ButtonsField value={s.buttons ?? []} onChange={(b) => onChange({ buttons: b })} disabled={disabled} />
      )}
    </div>
  );
}

function ButtonsField({ value, onChange, disabled }: { value: NonNullable<Section["buttons"]>; onChange: (b: NonNullable<Section["buttons"]>) => void; disabled: boolean }) {
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Buttons</span>
      <div className="space-y-2">
        {value.map((b, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-line bg-bg p-3 sm:grid-cols-[1fr_1fr_120px_auto] sm:items-end">
            <TextField label="Text" value={b.label} disabled={disabled} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <TextField label="Link" hint="/contact" value={b.href} disabled={disabled} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)))} />
            <SelectField label="Style" value={b.style ?? "gold"} disabled={disabled} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, style: e.target.value as "gold" } : x)))} options={[["gold", "Gold"], ["dark", "Black"], ["outline", "Outline"]]} />
            {!disabled && <IconBtn label="Remove button" icon={Trash2} onClick={() => onChange(value.filter((_, j) => j !== i))} />}
          </div>
        ))}
      </div>
      {!disabled && value.length < 4 && <Button size="sm" className="mt-2" icon={Plus} onClick={() => onChange([...value, { label: "Let's Talk", href: "/contact", style: "gold" }])}>Add button</Button>}
    </div>
  );
}

function ImageField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  const siteKey = useContext(SiteCtx);
  const toast = useToast();
  const [up, setUp] = useState(false);
  const upload = async (file: File) => {
    if (!BACKEND) return toast("Image upload works once the backend is on.", "info");
    if (file.size > 5_000_000) return toast("Images can be up to 5 MB.", "info");
    setUp(true);
    try {
      const r = await fetch(withSite("/api/website/media", siteKey), { method: "POST", credentials: "same-origin", headers: { "content-type": file.type, "x-file-name": encodeURIComponent(file.name) }, body: file });
      const d = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!r.ok || !d.url) throw new Error(d.error ?? "Upload failed.");
      onChange(d.url);
      toast("Image uploaded.");
    } catch (e) { toast(e instanceof Error ? e.message : "Upload failed.", "info"); }
    setUp(false);
  };
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {value ? <img src={value} alt="" className="h-16 w-16 rounded-lg border border-line bg-black object-contain" /> : <span className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-line text-[11px] text-faint">None</span>}
        {!disabled && (
          <>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-4 text-[14px] font-semibold text-ink-2 hover:bg-surface-hover">
              <ImageUp size={17} />{up ? "Uploading…" : "Upload"}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" disabled={up} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
            </label>
            {value && <Button size="sm" variant="ghost" onClick={() => onChange("")}>Remove</Button>}
          </>
        )}
      </div>
      <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder="or paste an image address (https://…)" className="mt-2 h-10 w-full rounded-xl border border-line bg-surface px-3 text-[13px] text-ink" />
    </div>
  );
}

function Panel({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-[15px] font-semibold text-ink">{title}</h2>{actions}</div>
      {children}
    </section>
  );
}
function IconBtn({ label, icon: Icon, onClick, disabled }: { label: string; icon: typeof X; onClick: () => void; disabled?: boolean }) {
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-ink disabled:opacity-30"><Icon size={16} /></button>;
}

