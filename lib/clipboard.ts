/**
 * Copy text, working in browsers where the Clipboard API is missing or blocked — e.g. the in-app
 * browsers of Gmail/Outlook on phones, where a "Copy" button otherwise silently does nothing.
 * Resolves when copied; rejects so callers can show "press and hold to copy".
 */
export async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return; }
  } catch { /* fall through to the older method */ }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px";
  document.body.appendChild(ta);
  const sel = document.getSelection();
  const prev = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, text.length); // iOS needs an explicit range
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  document.body.removeChild(ta);
  if (prev && sel) { sel.removeAllRanges(); sel.addRange(prev); }
  if (!ok) throw new Error("copy failed");
}
