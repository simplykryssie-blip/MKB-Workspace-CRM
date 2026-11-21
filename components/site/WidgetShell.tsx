"use client";

import { useEffect, useRef } from "react";
import { SITE_CSS } from "@/lib/website/site-css";

/**
 * Wraps a form or tool shown inside a plain-HTML website page (in a frame).
 * Tells the page how tall it is so the frame fits without scrollbars.
 */
export function WidgetShell({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.parent === window) return;
    // Report the real content height whenever it changes. Safari can skip ResizeObserver callbacks in a
    // frame that is still small or loading, so content changes and a short timer also trigger a report.
    let last = 0;
    const send = () => {
      const h = Math.ceil(Math.max(el.scrollHeight, el.getBoundingClientRect().height)) + 4;
      if (Math.abs(h - last) < 2) return;
      last = h;
      window.parent.postMessage({ mkbWidgetHeight: h }, window.location.origin);
    };
    send();
    const ro = new ResizeObserver(send);
    ro.observe(el);
    const mo = new MutationObserver(send);
    mo.observe(el, { childList: true, subtree: true, attributes: true, characterData: true });
    window.addEventListener("load", send);
    // A hidden form shown later (e.g. a service tab on Get Started): its frame resizes, or the page asks.
    window.addEventListener("resize", send);
    const ask = (e: MessageEvent) => { if (e.origin === window.location.origin && e.data?.mkbWidgetPing) { last = 0; send(); } };
    window.addEventListener("message", ask);
    const t0 = Date.now();
    const timer = window.setInterval(() => { send(); if (Date.now() - t0 > 15000) window.clearInterval(timer); }, 400);
    return () => { ro.disconnect(); mo.disconnect(); window.removeEventListener("load", send); window.removeEventListener("resize", send); window.removeEventListener("message", ask); window.clearInterval(timer); };
  }, []);
  return (
    <div ref={ref} className="mkbsite" style={{ minHeight: 0, background: "transparent" }}>
      <style dangerouslySetInnerHTML={{ __html: `${SITE_CSS}\nhtml,body{background:transparent!important}` }} />
      {children}
    </div>
  );
}
