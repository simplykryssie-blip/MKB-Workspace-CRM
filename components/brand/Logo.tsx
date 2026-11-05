/**
 * Official MKB Financial Group logo (gold artwork, background removed so it
 * sits on the navy sidebar). Source files live in /brand-assets; the web
 * versions in /public/brand are generated from them.
 *
 * The gold is used for the brand mark only — the application UI itself keeps
 * the Verexa-derived blue palette.
 */
/* eslint-disable @next/next/no-img-element -- static brand images; avoids paid image optimization on Cloudflare */

export function LogoMark({ height = 26 }: { height?: number }) {
  return (
    <img
      src="/brand/mkb-monogram.webp"
      alt="MKB Financial Group"
      width={Math.round((height * 185) / 96)}
      height={height}
      className="block select-none"
      draggable={false}
    />
  );
}

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) return <LogoMark height={24} />;
  return (
    <div className="flex flex-col items-start">
      <img
        src="/brand/mkb-logo-sidebar.webp"
        alt="MKB Financial Group"
        width={176}
        height={88}
        className="block h-auto w-[176px] select-none"
        draggable={false}
      />
      <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-rail-muted">Business Suite</div>
    </div>
  );
}
