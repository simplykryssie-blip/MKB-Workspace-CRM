/**
 * The Business Solutions price list on the website, drawn from the same catalog the CRM
 * quotes from (Business Services → Settings → Catalog). A page asks for it with
 *   <div data-mkb-prices="biz"></div>
 * and the server swaps in the current prices each time the page is served.
 */
import { CATEGORIES, MULTI_ENTITY_DISCOUNT_PCT, svcPrice, type CatalogService } from "@/lib/biz/config";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
export const PRICE_TAG = /<div\b[^>]*\bdata-mkb-prices\s*=\s*["']biz["'][^>]*>\s*<\/div>/gi;

export function bizPriceHtml(catalog: CatalogService[]) {
  const shown = catalog.filter((x) => x.active && x.web !== false);
  const order = [...CATEGORIES, ...new Set(shown.map((x) => x.category))];
  const groups = [...new Set(order)].map((cat) => [cat, shown.filter((x) => x.category === cat)] as const).filter(([, xs]) => xs.length);
  const table = (cat: string, xs: readonly CatalogService[]) =>
    `<h3 style="margin:28px 0 10px">${esc(cat)}</h3><div class="tblwrap"><table class="tbl" style="width:100%;min-width:0;table-layout:fixed"><thead><tr><th>Service</th><th style="width:34%">MKB fee</th></tr></thead><tbody>${xs
      .map((x) => `<tr><td style="white-space:normal;overflow-wrap:anywhere"><b>${esc(x.name)}</b>${x.description ? `<br><span style="font-size:14px;opacity:.8">${esc(x.description)}</span>` : ""}</td><td style="white-space:normal;font-weight:600">${esc(svcPrice(x))}</td></tr>`)
      .join("")}</tbody></table></div>`;
  return `<div class="mkb-prices">${groups.map(([c, xs]) => table(c, xs)).join("")}<p style="margin-top:18px;font-size:15px">State and government filing fees are separate and passed through at cost — we confirm them with you before anything is filed. <b>${MULTI_ENTITY_DISCOUNT_PCT}% off</b> MKB's fees for your second business and beyond. MKB is not a registered agent: you choose and keep your own.</p></div>`;
}
