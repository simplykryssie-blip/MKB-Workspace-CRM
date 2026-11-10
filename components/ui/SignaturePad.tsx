"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { Button } from "./Button";

/**
 * Draw-your-signature box (finger, stylus or mouse). Reports a PNG data URL once
 * there's enough ink to be a real signature, or null when cleared/too short.
 * Always black ink on white so it prints the same in light and dark mode.
 */
export function SignaturePad({ onChange, label = "Sign here", disabled }: { onChange: (png: string | null) => void; label?: string; disabled?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const ink = useRef(0);
  const [empty, setEmpty] = useState(true);

  const setup = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, r.width, r.height);
    g.lineWidth = 2.4;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = "#111111";
    ink.current = 0;
    setEmpty(true);
  }, []);
  useEffect(() => { setup(); }, [setup]);

  const pos = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
    const g = canvas.current!.getContext("2d")!;
    g.beginPath(); g.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2); g.fillStyle = "#111111"; g.fill();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    e.preventDefault();
    const p = pos(e);
    const g = canvas.current!.getContext("2d")!;
    g.beginPath(); g.moveTo(last.current.x, last.current.y); g.lineTo(p.x, p.y); g.stroke();
    ink.current += Math.hypot(p.x - last.current.x, p.y - last.current.y);
    last.current = p;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    // A dot or a tiny tick isn't a signature.
    const ok = ink.current > 60;
    setEmpty(ink.current === 0);
    onChange(ok ? canvas.current!.toDataURL("image/png") : null);
  };
  const clear = () => { setup(); onChange(null); };

  return (
    <div>
      <div className="mb-1 flex items-end justify-between gap-2">
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
        <Button size="sm" variant="ghost" icon={Eraser} disabled={empty || disabled} onClick={clear}>Clear</Button>
      </div>
      <div className="relative">
        <canvas
          ref={canvas}
          role="img"
          aria-label="Signature box — draw your signature with your finger, stylus or mouse"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
          className={`block h-[150px] w-full touch-none rounded-xl border-2 border-dashed ${disabled ? "border-line opacity-60" : "border-line-strong"} bg-white`}
          style={{ cursor: disabled ? "not-allowed" : "crosshair" }}
        />
        {empty && <span className="pointer-events-none absolute inset-0 grid place-items-center text-[14px] text-slate-400">Draw your signature here</span>}
        <span className="pointer-events-none absolute bottom-8 left-4 right-4 border-b border-slate-300" aria-hidden="true" />
      </div>
    </div>
  );
}
