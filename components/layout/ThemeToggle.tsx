"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Mode = "light" | "dark" | "system";

function apply(mode: Mode) {
  const dark =
    mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    let saved: Mode = "light";
    try {
      saved = (localStorage.getItem("mkb-theme") as Mode) || "light";
    } catch {}
    setMode(saved);
  }, []);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = () => apply("system");
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [mode]);

  const choose = (m: Mode) => {
    setMode(m);
    apply(m);
    try {
      localStorage.setItem("mkb-theme", m);
    } catch {}
  };

  const opts: { m: Mode; icon: typeof Sun; label: string }[] = [
    { m: "light", icon: Sun, label: "Light theme" },
    { m: "dark", icon: Moon, label: "Dark theme" },
    { m: "system", icon: Monitor, label: "Match system" },
  ];

  return (
    <div role="radiogroup" aria-label="Color theme" className="flex items-center rounded-full border border-line bg-surface-2 p-0.5">
      {opts.map(({ m, icon: Icon, label }) => (
        <button
          key={m}
          role="radio"
          aria-checked={mode === m}
          aria-label={label}
          title={label}
          onClick={() => choose(m)}
          className={`grid h-7 w-7 place-items-center rounded-full transition-colors ${
            mode === m ? "bg-surface text-accent shadow-soft" : "text-muted hover:text-ink"
          }`}
        >
          <Icon size={15} strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}

/** Inline script that runs before paint so there's no light/dark flash. */
export const themeInitScript = `(function(){try{var m=localStorage.getItem('mkb-theme')||'light';var d=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})();`;
