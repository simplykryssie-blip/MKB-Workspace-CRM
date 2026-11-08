import { fillLetter, parseLetter } from "@/lib/engagement/letters";

/** Renders an engagement letter (headings, paragraphs, bullets) with placeholders filled. */
export function LetterView({ title, body, vars, version }: { title: string; body: string; vars: Record<string, string>; version?: number }) {
  const blocks = parseLetter(fillLetter(body, vars));
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (k: number) => { if (list.length) { out.push(<ul key={`u${k}`} className="my-1.5 list-disc space-y-0.5 pl-5">{list.map((t, i) => <li key={i}>{t}</li>)}</ul>); list = []; } };
  blocks.forEach((b, i) => {
    if (b.kind === "li") { list.push(b.text); return; }
    flush(i);
    out.push(b.kind === "h" ? <h4 key={i} className="mt-4 text-[14.5px] font-semibold text-ink">{b.text}</h4> : <p key={i} className="my-1.5">{b.text}</p>);
  });
  flush(blocks.length);
  return (
    <article className="text-[13.5px] leading-relaxed text-ink-2">
      <h3 className="text-[17px] font-bold text-ink">{fillLetter(title, vars)}</h3>
      {version !== undefined && <p className="text-[11.5px] text-muted">Version {version}</p>}
      {out}
    </article>
  );
}
