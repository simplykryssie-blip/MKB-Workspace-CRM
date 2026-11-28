"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { call } from "@/lib/sync/remote";
import type { Brand } from "@/lib/campaigns/config";

export type CampaignImage = { key: string; name: string; contentType: string; size: number; uploadedAt: string; url: string };

/**
 * Pick a photo for an email: one from the brand's media library, or a new upload (which is added to the
 * library). Asks for a short description, shown when someone's email hides pictures.
 */
export function ImagePicker({ brand, open, onClose, onPick, title = "Add a photo" }: { brand: Brand; open: boolean; onClose: () => void; onPick: (url: string, alt: string) => void; title?: string }) {
  const toast = useToast();
  const [images, setImages] = useState<CampaignImage[] | null>(null);
  const [sel, setSel] = useState<CampaignImage | null>(null);
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(() => call<{ images: CampaignImage[] }>("GET", `/api/campaigns/images?brand=${brand}`).then((r) => setImages(r.images)).catch(() => setImages([])), [brand]);
  useEffect(() => { if (open) { setSel(null); setAlt(""); void load(); } }, [open, load]);

  const upload = async (f: File) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(f.type)) { toast("Use a JPG, PNG, WebP or GIF photo", "info"); return; }
    if (f.size > 10 * 1024 * 1024) { toast("Photos can be up to 10 MB", "info"); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/campaigns/images?brand=${brand}`, { method: "POST", credentials: "same-origin", headers: { "content-type": f.type, "x-file-name": encodeURIComponent(f.name) }, body: f });
      const j = (await r.json().catch(() => ({}))) as { image?: CampaignImage; error?: string };
      if (!r.ok || !j.image) throw new Error(j.error ?? "Upload failed");
      setImages((x) => [j.image!, ...(x ?? [])]);
      setSel(j.image);
      if (!alt) setAlt(f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 120));
      toast("Photo uploaded");
    } catch (e) { toast(e instanceof Error ? e.message : "Upload failed", "info"); }
    setBusy(false);
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title={title} description="Upload a photo or choose one you've used before. Photos show at full email width."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={ImagePlus} disabled={!sel} onClick={() => { if (sel) { onPick(sel.url, alt.trim()); onClose(); } }}>Use this photo</Button></>}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button icon={busy ? Loader2 : Upload} disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? "Uploading…" : "Upload a photo"}</Button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" aria-label="Upload a photo" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
          <span className="text-[12.5px] text-muted">JPG or PNG work in every email app (up to 10 MB). A photo about 1200 pixels wide looks sharp.</span>
        </div>
        {images === null ? <p className="py-6 text-center text-[13px] text-muted">Loading photos…</p> : images.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line py-8 text-center text-[13.5px] text-muted">No photos yet — upload one.</p>
        ) : (
          <ul className="grid max-h-[340px] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4" aria-label="Your photos">
            {images.map((im) => (
              <li key={im.key}>
                <button type="button" onClick={() => setSel(im)} aria-pressed={sel?.key === im.key} title={im.name}
                  className={`block w-full overflow-hidden rounded-xl border-2 bg-surface-2 ${sel?.key === im.key ? "border-accent ring-4 ring-accent/20" : "border-transparent hover:border-line-strong"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.url} alt={im.name} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  <span className="block truncate px-1.5 py-1 text-left text-[11.5px] text-ink-2">{im.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {sel && (
          <div className="space-y-2">
            <TextField id="ip-alt" label="Describe the photo (shown if someone's email hides pictures)" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="e.g. Krystal at the MKB office" />
            {/\.webp$/i.test(sel.key) && <p className="text-[12px] text-warning-ink">This is a WebP picture — some older Outlook versions don&rsquo;t show those. A JPG or PNG is safest for email.</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}
