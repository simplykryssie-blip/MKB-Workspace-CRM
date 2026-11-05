/**
 * Official MKB Financial Group logo (gold artwork, background removed). It is
 * shown on a small navy plate so the gold stays rich on the white sidebar. Source files live in /brand-assets; the web
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
  if (collapsed)
    return (
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-logo-plate shadow-soft">
        <LogoMark height={17} />
      </span>
    );
  return (
    <div className="flex w-full flex-col items-stretch">
      <div className="grid place-items-center rounded-2xl bg-logo-plate px-4 py-2.5 shadow-soft">
        <img
          src="/brand/mkb-logo-sidebar.webp"
          alt="MKB Financial Group"
          width={148}
          height={71}
          className="block h-auto w-[148px] select-none"
          draggable={false}
        />
      </div>
      <div className="mt-2 text-center text-[10.5px] font-semibold uppercase tracking-[0.2em] text-rail-muted">Business Suite</div>
    </div>
  );
}
