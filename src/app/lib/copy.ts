/**
 * Robust clipboard copy that works on Huawei (EMUI / Petal / HMS WebView),
 * iOS Safari, Android WebView, and modern desktop browsers.
 *
 * Critical detail: an `async` function body up to the first `await`
 * runs synchronously, in the same tick as the caller. We exploit that
 * by running the synchronous `document.execCommand("copy")` path FIRST
 * — before any await — so it stays inside the user-gesture window that
 * Huawei's clipboard guard requires. Only if exec genuinely returns
 * false do we await the modern `navigator.clipboard.writeText` API.
 *
 * Why the original ordering didn't work on Huawei:
 *   1. `navigator.clipboard.writeText` was tried first — it returns a
 *      Promise that resolves on Huawei but doesn't actually write,
 *      so try/catch couldn't detect the failure.
 *   2. By the time the catch fell through to execCommand, the user-
 *      gesture context had expired (because we'd already awaited),
 *      and execCommand also refused to write.
 *   3. The toast still said "Copied" because we never checked the
 *      return value.
 */
export async function copyText(text: string): Promise<boolean> {
  // ─── Method 1 — synchronous execCommand (Huawei-safe) ───
  // Runs BEFORE any await so we keep the user-gesture context.
  if (tryExecCommand(text)) {
    // Also kick the modern API as a backup so the OS-level shared
    // clipboard (Android multi-app paste, etc.) gets the value too.
    // Don't await — we already succeeded.
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).catch(() => {});
    }
    return true;
  }

  // ─── Method 2 — async Clipboard API fallback ───
  // For browsers that disable execCommand entirely (some strict
  // iframes, Chromium feature flags). The user-gesture window may
  // already be lost by the time this runs, but most modern browsers
  // honour the call inside a click handler regardless.
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through
    }
  }
  return false;
}

/** Hidden textarea + execCommand — synchronous path that works on
 *  Huawei. The textarea must be in the DOM, focusable, and selected. */
function tryExecCommand(text: string): boolean {
  if (typeof document === "undefined") return false;
  let ta: HTMLTextAreaElement | null = null;
  try {
    ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.setAttribute("aria-hidden", "true");
    ta.style.fontSize = "16px";          // avoid iOS auto-zoom
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "1px";
    ta.style.height = "1px";
    ta.style.padding = "0";
    ta.style.border = "0";
    ta.style.outline = "0";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    // Append INSIDE an open modal/dialog when present. Radix Dialog traps focus
    // within its content, so a textarea on document.body can't be focused/
    // selected → execCommand copies nothing (this broke "copy address" inside
    // the deposit dialog). Hosting the textarea in the dialog keeps it in scope.
    const dialogHost =
      (document.querySelector('[role="dialog"][data-state="open"]') as HTMLElement | null) ??
      (document.querySelector('[role="dialog"]') as HTMLElement | null);
    (dialogHost ?? document.body).appendChild(ta);

    const isIOS = /ipad|iphone|ipod/i.test(navigator.userAgent);
    if (isIOS) {
      ta.contentEditable = "true";
      const range = document.createRange();
      range.selectNodeContents(ta);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
      ta.setSelectionRange(0, text.length);
    } else {
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
    }

    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    if (ta && ta.parentNode) ta.parentNode.removeChild(ta);
  }
}
