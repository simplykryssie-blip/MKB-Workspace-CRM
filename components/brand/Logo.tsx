/**
 * Placeholder MKB wordmark built in SVG so it stays crisp at any size.
 * Swap in the official MKB logo file (SVG preferred) when provided.
 */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="mkb-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1592EF" />
          <stop offset="1" stopColor="#0B6FD0" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#mkb-mark)" />
      <path d="M9 27V13.5l5.5 7 5.5-7V27" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 13.5V27M24 20.5l6.5-7M25.5 19l5.5 8" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 31.5c8 3 18 3 27-3.5" fill="none" stroke="#A4D22B" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) return <LogoMark size={38} />;
  return (
    <div className="flex items-center gap-3">
      <LogoMark size={40} />
      <div className="leading-tight">
        <div className="text-[20px] font-extrabold leading-none tracking-tight text-white">MKB</div>
        <div className="mt-1 text-[10.5px] font-bold uppercase leading-none tracking-[0.16em] text-[#5cc8f0]">Financial Group</div>
        <div className="mt-1 text-[11.5px] font-medium leading-none text-rail-muted">Business Suite</div>
      </div>
    </div>
  );
}
