import { ArrowRight, Globe } from "lucide-react";

export type NextStop = { portal: "active" | "invited" | null; url: string };

/** The button at the end of an intake, interview or proposal: back to the client's portal (sign-in or dashboard), or the website. */
export function NextStopButton({ next }: { next?: NextStop }) {
  if (!next) return null;
  const cls = "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-[15px] font-semibold text-white hover:bg-accent-hover";
  if (next.portal)
    return (
      <div className="mt-5">
        <a href={next.url} className={cls}>Go to my client portal <ArrowRight size={17} /></a>
        <p className="mt-2 text-[12.5px] text-muted">{next.portal === "active" ? "Sign in to upload documents, check your status and message us." : "First time? Use the “Set up my portal” email we sent you to create your password."}</p>
      </div>
    );
  return <div className="mt-5"><a href={next.url} className={`${cls} bg-surface-2 text-ink hover:bg-surface-hover`}><Globe size={17} /> Back to MKB Financial Group</a></div>;
}
