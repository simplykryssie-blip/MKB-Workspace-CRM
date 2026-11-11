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
    const send = () => window.parent.postMessage({ mkbWidgetHeight: el.getBoundingClientRect().height + 4 }, window.location.origin);
    send();
    const ro = new ResizeObserver(send);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="mkbsite" style={{ minHeight: 0, background: "transparent" }}>
      <style dangerouslySetInnerHTML={{ __html: `${SITE_CSS}\nhtml,body{background:transparent!important}` }} />
      {children}
    </div>
  );
}
