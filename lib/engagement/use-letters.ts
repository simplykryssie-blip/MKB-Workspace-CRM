"use client";

import { useEffect, useState } from "react";
import { BACKEND, call } from "@/lib/sync/remote";
import { DEFAULT_LETTERS, LETTER_KEYS, type Letter, type LetterKey } from "./letters";

export type History = Record<LetterKey, { version: number; note?: string; at?: string; by?: string }[]>;
type Loaded = { letters: Record<LetterKey, Letter>; history: History };

const defaults = (): Loaded => ({
  letters: Object.fromEntries(LETTER_KEYS.map((k) => [k, { key: k, version: 1, ...DEFAULT_LETTERS[k] }])) as Record<LetterKey, Letter>,
  history: Object.fromEntries(LETTER_KEYS.map((k) => [k, [{ version: 1, note: "Original draft" }]])) as History,
});

let cache: Promise<Loaded> | null = null;
/** Forget the cached letters (after an edit). */
export const refreshLetters = () => { cache = null; };

/** Current engagement letters (from the server when connected, otherwise the defaults). */
export function useLetters() {
  const [data, setData] = useState<Loaded | null>(BACKEND ? null : defaults());
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!BACKEND) return;
    cache ??= call<Loaded>("GET", "/api/engagement-letters");
    let live = true;
    cache.then((d) => live && setData(d)).catch(() => { cache = null; });
    return () => { live = false; };
  }, [tick]);
  return { ...(data ?? { letters: null, history: null }), loading: !data, reload: () => { refreshLetters(); setTick((t) => t + 1); } };
}
