/**
 * Official MKB Financial Group logo: the gold artwork with its black background
 * removed and the letters kept solid, so it sits directly on the white sidebar
 * (and the dark sidebar in dark mode). The original and the script that builds
 * the web versions live in /brand-assets; outputs are in /public/brand.
 *
 * The gold is used for the brand mark only — the application UI itself keeps
 * the Verexa-derived blue palette.
 */
/* eslint-disable @next/next/no-img-element -- static brand images; avoids paid image optimization on Cloudflare */

const MONO_RATIO = 197 / 96;
const SIDEBAR_RATIO = 480 / 219;

export function LogoMark({ height = 22 }: { height?: number }) {
  return (
    <img
      src="/brand/mkb-monogram.webp"
      alt="MKB Financial Group"
      width={Math.round(height * MONO_RATIO)}
      height={height}
      className="block select-none"
      draggable={false}
    />
  );
}

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) return <LogoMark height={22} />;
  const w = 168;
  return (
    <div className="flex w-full flex-col items-center">
      <img
        src="/brand/mkb-logo-sidebar.webp"
        alt="MKB Financial Group"
        width={w}
        height={Math.round(w / SIDEBAR_RATIO)}
        className="block h-auto select-none"
        style={{ width: w }}
        draggable={false}
      />
      <div className="mt-2 text-center text-[10.5px] font-semibold uppercase tracking-[0.2em] text-rail-muted">Business Suite</div>
    </div>
  );
}

/** Monarch Tax Suite logo (navy lettering on the light sidebar, original white in dark mode). */
const M_RATIO = 480 / 108;
const M_MONO = 147 / 96;
export function MonarchLogo({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed)
    return (
      <>
        <img src="/brand/monarch-mono-light.webp" alt="Monarch Tax Suite" width={Math.round(24 * M_MONO)} height={24} className="block select-none dark:hidden" draggable={false} />
        <img src="/brand/monarch-mono-dark.webp" alt="Monarch Tax Suite" width={Math.round(24 * M_MONO)} height={24} className="hidden select-none dark:block" draggable={false} />
      </>
    );
  const w = 200;
  return (
    <div className="flex w-full flex-col items-center">
      <img src="/brand/monarch-logo-light.webp" alt="Monarch Tax Suite" width={w} height={Math.round(w / M_RATIO)} className="block h-auto select-none dark:hidden" style={{ width: w }} draggable={false} />
      <img src="/brand/monarch-logo-dark.webp" alt="Monarch Tax Suite" width={w} height={Math.round(w / M_RATIO)} className="hidden h-auto select-none dark:block" style={{ width: w }} draggable={false} />
    </div>
  );
}
