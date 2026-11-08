/**
 * PDF copy of a submitted tax interview. Built from the answers the server
 * holds — secure numbers are already last-4 only. Server-only.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { FIRM } from "@/lib/email/templates";
import { parseLetter } from "@/lib/engagement/letters";
import { display, qVisible, rowsOf, sectionVisible, type Answers } from "@/lib/tax/interview/engine";
import { sectionsFor } from "@/lib/tax/interview/questions";
import type { TaxForm } from "@/lib/tax/config";

const W = 612, H = 792, M = 50;
const GOLD = rgb(0.72, 0.47, 0.07), INK = rgb(0.07, 0.07, 0.07), MUTED = rgb(0.4, 0.4, 0.4), LINE = rgb(0.9, 0.88, 0.85);
const EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
/** Standard PDF fonts only cover Western characters; anything else becomes "?". */
const safe = (s: string) => [...s.replace(/\t/g, " ").replace(/[\r\n]+/g, " ")].map((c) => { const n = c.charCodeAt(0); return (n >= 32 && n <= 126) || (n >= 160 && n <= 255) || EXTRA.includes(c) ? c : "?"; }).join("");

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = [];
  for (const para of safe(text).split(" | ")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const tryLine = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(tryLine, size) <= width) { line = tryLine; continue; }
      if (line) out.push(line);
      // A single very long word is cut to fit.
      let w = word;
      while (font.widthOfTextAtSize(w, size) > width && w.length > 1) { let i = w.length; while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > width) i--; out.push(w.slice(0, i)); w = w.slice(i); }
      line = w;
    }
    out.push(line);
  }
  return out;
}

export type IntakePdfInput = {
  clientName: string; taxYear: number; form: TaxForm; returnId: string; answers: Answers;
  submittedAt: string; enteredBy: "client" | "staff"; consentName?: string; documents: string[]; engagement?: { title: string; version: number; acceptedName: string; acceptedAt: string };
};

/** Branded page writer shared by the intake copy and engagement letters. */
async function makeWriter(docTitle: string, headerRight: string) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(safe(docTitle));
  pdf.setAuthor(FIRM.name);
  pdf.setCreator(FIRM.name);
  const [reg, bold, serif] = await Promise.all([pdf.embedFont(StandardFonts.Helvetica), pdf.embedFont(StandardFonts.HelveticaBold), pdf.embedFont(StandardFonts.TimesRoman)]);
  let page!: PDFPage;
  let y = 0;
  const newPage = () => {
    page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 64, width: W, height: 64, color: rgb(0.043, 0.043, 0.043) });
    page.drawRectangle({ x: 0, y: H - 68, width: W, height: 4, color: GOLD });
    page.drawText(FIRM.name, { x: M, y: H - 36, size: 17, font: serif, color: rgb(1, 1, 1) });
    page.drawText(FIRM.tagline.replace(/•/g, "·"), { x: M, y: H - 52, size: 7.5, font: bold, color: rgb(0.96, 0.83, 0.48) });
    const hr = safe(headerRight);
    page.drawText(hr, { x: W - M - bold.widthOfTextAtSize(hr, 10), y: H - 40, size: 10, font: bold, color: rgb(1, 1, 1) });
    y = H - 96;
  };
  const need = (h: number) => { if (y - h < 60) newPage(); };
  const text = (s: string, o: { x?: number; size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; width?: number; gap?: number } = {}) => {
    const size = o.size ?? 10, font = o.font ?? reg, x0 = o.x ?? M, lines = wrap(s, font, size, o.width ?? W - M - x0);
    for (const l of lines) { need(size + 4); page.drawText(l, { x: x0, y, size, font, color: o.color ?? INK }); y -= size + (o.gap ?? 4); }
  };
  const heading = (s: string) => {
    need(40);
    y -= 8;
    page.drawText(safe(s), { x: M, y, size: 13, font: serif, color: INK });
    y -= 6;
    page.drawRectangle({ x: M, y, width: W - 2 * M, height: 1, color: GOLD });
    y -= 14;
  };
  const row = (label: string, value: string) => {
    const lw = 270, vw = W - 2 * M - lw - 12;
    const ll = wrap(label, reg, 9, lw), vl = wrap(value, bold, 9.5, vw);
    const h = Math.max(ll.length, vl.length) * 12 + 4;
    need(h);
    ll.forEach((l, i) => page.drawText(l, { x: M, y: y - i * 12, size: 9, font: reg, color: MUTED }));
    vl.forEach((l, i) => page.drawText(l, { x: M + lw + 12, y: y - i * 12, size: 9.5, font: bold, color: INK }));
    y -= h;
    page.drawRectangle({ x: M, y: y + 6, width: W - 2 * M, height: 0.5, color: LINE });
    y -= 4;
  };
  const space = (n: number) => { y -= n; };
  const finish = (clientName: string) => {
    const pages = pdf.getPages();
    pages.forEach((p, i) => {
      const f = safe(`Confidential — prepared for ${clientName} · ${FIRM.name} · ${FIRM.phone}`);
      p.drawText(f, { x: M, y: 30, size: 7.5, font: reg, color: MUTED });
      const pn = `Page ${i + 1} of ${pages.length}`;
      p.drawText(pn, { x: W - M - reg.widthOfTextAtSize(pn, 7.5), y: 30, size: 7.5, font: reg, color: MUTED });
    });
    return pdf.save();
  };
  newPage();
  return { text, heading, row, space, finish, fonts: { reg, bold, serif } };
}

export async function buildIntakePdf(x: IntakePdfInput): Promise<Uint8Array> {
  const { text, heading, row, space, finish, fonts: { bold, serif } } = await makeWriter(`${x.taxYear} Tax Interview — ${x.clientName}`, `${x.taxYear} Tax Interview`);
  text(`${x.taxYear} Tax Interview`, { size: 20, font: serif, gap: 8 });
  text(x.clientName, { size: 12, font: bold, gap: 10 });
  const when = new Date(x.submittedAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "America/Chicago" });
  row("Return", `${x.returnId} · Form ${x.form}`);
  row("Submitted", `${when} (Central)`);
  row("Completed by", x.enteredBy === "staff" ? "MKB staff with the client" : "The client, online");
  if (x.consentName) row("Confirmed accurate by (typed name)", x.consentName);
  if (x.engagement) row("Engagement letter accepted", `${x.engagement.title} (version ${x.engagement.version}) — ${x.engagement.acceptedName}, ${new Date(x.engagement.acceptedAt).toLocaleDateString("en-US", { dateStyle: "long" })}`);
  space(6);
  text("Social Security numbers, EINs and bank account numbers show only the last four digits. Full numbers are kept encrypted at MKB.", { size: 8.5, color: MUTED });

  const a = x.answers;
  for (const s of sectionsFor(x.form).filter((s) => sectionVisible(s, a))) {
    if (s.repeat) {
      const rows = rowsOf(a, s.id);
      heading(s.title);
      if (!rows.length) { text("None entered.", { size: 9, color: MUTED }); continue; }
      rows.forEach((r, i) => {
        text(s.repeat!.rowTitle?.(r, i) ?? `${s.repeat!.noun} ${i + 1}`, { size: 10, font: bold, gap: 6 });
        s.questions.filter((q) => qVisible(q, a, r)).forEach((q) => row(q.label, display(q, r[q.id])));
        space(4);
      });
    } else {
      const qs = s.questions.filter((q) => qVisible(q, a));
      if (!qs.length) continue;
      heading(s.title);
      qs.forEach((q) => row(q.label, display(q, a[q.id] as string | undefined)));
    }
  }
  if (x.documents.length) {
    heading("Documents MKB still needs");
    x.documents.forEach((d) => text(`•  ${d}`, { size: 10 }));
  }

  return finish(x.clientName);
}


/** A signed engagement letter: service letter + standard terms + acceptance record. */
export async function buildLetterPdf(x: { clientName: string; parts: { title: string; body: string; version: number }[]; acceptedName: string; acceptedAt: string; method: "online" | "in_office" | "paper"; recordedBy?: string }): Promise<Uint8Array> {
  const { text, heading, row, space, finish, fonts: { bold, serif } } = await makeWriter(`Engagement letter — ${x.clientName}`, "Engagement Letter");
  x.parts.forEach((part, n) => {
    if (n) space(16);
    text(part.title, { size: 17, font: serif, gap: 6 });
    text(`Version ${part.version}`, { size: 8.5, color: MUTED, gap: 8 });
    for (const b of parseLetter(part.body)) {
      if (b.kind === "h") heading(b.text);
      else if (b.kind === "li") text(`•  ${b.text}`, { size: 10, x: M + 10, gap: 3 });
      else { text(b.text, { size: 10, gap: 3 }); space(5); }
    }
  });
  heading("Acceptance");
  row("Accepted by (typed name)", x.acceptedName);
  row("Date and time", `${new Date(x.acceptedAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "America/Chicago" })} (Central)`);
  row("How", x.method === "online" ? "Accepted online by the client" : x.method === "in_office" ? "Accepted in the office with MKB staff" : "Signed on paper; recorded by MKB staff");
  if (x.recordedBy) row("Recorded by", x.recordedBy);
  row("Letters accepted", x.parts.map((p) => `${p.title} (v${p.version})`).join("; "));
  void bold;
  return finish(x.clientName);
}
