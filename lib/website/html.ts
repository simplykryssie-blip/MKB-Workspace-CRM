/**
 * Plain-HTML website pages. A page can be a full HTML document the owner pastes
 * in (served exactly as written), and forms / the WISP generator go into that
 * HTML as one-line tags:
 *
 *   <div data-mkb-widget="form" data-form="contact"></div>
 *   <div data-mkb-widget="form" data-form="tax-calculator" data-after="/calculator"></div>
 *   <div data-mkb-widget="monarch-contact"></div>
 *   <div data-mkb-widget="wisp" data-next="/wisp-next-steps"></div>
 *
 * Each tag becomes a small frame (/w/...) that sizes itself to its content.
 * Shared by the public pages and the editor's preview.
 */

const attr = (tag: string, name: string) => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return m ? (m[2] ?? m[3] ?? "") : "";
};
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const safePath = (v: string) => (/^\/(?!\/)[A-Za-z0-9/_.~%-]*$/.test(v) ? v : "");

/** The frame address for one widget tag, or null if the tag isn't recognized. */
function widgetSrc(tag: string, prefix: string): { src: string; title: string } | null {
  const kind = attr(tag, "data-mkb-widget").toLowerCase();
  const go = (p: string) => (p ? `${prefix}${p}` : "");
  if (kind === "form") {
    const slug = attr(tag, "data-form").toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!slug) return null;
    const after = go(safePath(attr(tag, "data-after")));
    return { src: `/w/form/${slug}${after ? `?after=${encodeURIComponent(after)}` : ""}`, title: "Contact form" };
  }
  if (kind === "monarch-contact") return { src: "/w/monarch-contact", title: "Contact form" };
  if (kind === "wisp") {
    const next = go(safePath(attr(tag, "data-next")) || "/wisp-next-steps");
    return { src: `/w/wisp?next=${encodeURIComponent(next)}`, title: "WISP Generator" };
  }
  return null;
}

/** Replaces widget tags with self-sizing frames. */
export function renderWidgets(html: string, prefix = "") {
  return html.replace(/<div\b[^>]*\bdata-mkb-widget\s*=[^>]*>\s*<\/div>/gi, (tag) => {
    const w = widgetSrc(tag, prefix);
    if (!w) return tag;
    return `<iframe data-mkb-frame src="${esc(w.src)}" title="${esc(w.title)}" loading="lazy" style="width:100%;border:0;min-height:520px;display:block"></iframe>`;
  });
}

/** Lets the frames grow to fit their content. Added once to every page that has one. */
export const WIDGET_SCRIPT = `<script>(function(){window.addEventListener("message",function(e){if(e.origin!==location.origin||!e.data||typeof e.data.mkbWidgetHeight!=="number")return;var f=document.querySelectorAll("iframe[data-mkb-frame]");for(var i=0;i<f.length;i++){if(f[i].contentWindow===e.source){f[i].style.height=Math.ceil(e.data.mkbWidgetHeight)+"px";f[i].style.minHeight="0";}}});})();</script>`;

/**
 * Inside the app (where the site lives under /site or /msite) the page's own
 * links ("/about") are pointed at that folder. Files and tools keep their paths.
 */
export function prefixLinks(html: string, prefix: string) {
  if (!prefix) return html;
  return html.replace(/\b(href|src|action)\s*=\s*(["'])\/(?!\/)(?!(?:site\/media|brand|w|api|_next|f|i)\/)/gi, (_m, a: string, q: string) => `${a}=${q}${prefix}/`);
}

/** Prepares a pasted HTML page for visitors. */
export function preparePage(html: string, prefix: string) {
  let out = renderWidgets(prefixLinks(html, prefix), prefix);
  if (out.includes("data-mkb-frame")) out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${WIDGET_SCRIPT}</body>`) : out + WIDGET_SCRIPT;
  return out;
}

export const HTML_PAGE_STARTER = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>New page</title>
<style>
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; }
</style>
</head>
<body>
  <h1>New page</h1>
  <p>Paste your page's HTML here.</p>
</body>
</html>
`;
