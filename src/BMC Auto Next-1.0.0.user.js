// ==UserScript==
// @name         BMC Auto Next
// @namespace    https://github.com/JonasWooh/BMC_AutoNext
// @version      1.0.0
// @description  Auto-click NEXT when it unlocks or when progress reaches ~100% on Bloomberg for Education/BMC RusticiEngine lessons.
// @author       JonasWooh
// @license      MIT
// @homepageURL  https://github.com/JonasWooh/BMC_AutoNext
// @supportURL   https://github.com/JonasWooh/BMC_AutoNext/issues
// @match        https://portal.bloombergforeducation.com/courses/*/modules/*/watch*
// @include      https://*/RusticiEngine/*
// @run-at       document-idle
// @grant        none
//

// ==/UserScript==

(function () {
  'use strict';

  // ====== Tunables ======
  const DEBUG = false;// Set to true to debug in DevTools Console
  const DONE_PCT = 99.8;// Progress >= this % is considered completed
  const POLL_MS = 250;// Polling interval
  const CLICK_DELAY_MS = 120;// Delay after unlock/done before clicking (stability)
  const COOLDOWN_MS = 1800;// Prevent repeated clicks
  const MAX_DEPTH = 8;// Nested same-origin frame scan depth
  // ======================


  const log = (...a) => DEBUG && console.log('[BMC AutoNext]', ...a);

  let cooldownUntil = 0;
  const stateByDoc = new WeakMap();

  function isVisible(el) {
    if (!el) return false;
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0' && r.width > 0 && r.height > 0;
  }

  function qs(doc, sel) { return doc.querySelector(sel); }

  function getNextBtn(doc) {
    return qs(doc, '#nav-controls button#next') || qs(doc, 'button#next');
  }

  function getSubmitBtn(doc) {
    return qs(doc, '#nav-controls button#submit') || qs(doc, 'button#submit');
  }

  function isQuizOrSubmit(doc) {
    const s = getSubmitBtn(doc);
    return s && isVisible(s);
  }

  function isNextEnabled(btn) {
    if (!btn) return false;
    const ariaDisabled = (btn.getAttribute('aria-disabled') || '').toLowerCase() === 'true';
    const hasDisabledClass = btn.classList.contains('cs-disabled');
    const disabledProp = btn.disabled === true;
    return isVisible(btn) && !ariaDisabled && !hasDisabledClass && !disabledProp;
  }

  function getProgressFill(doc) {
    // Typical selector observed in RusticiEngine UI:
    //   #seek [data-ref="progressBarFill"]
    return qs(doc, '#seek [data-ref="progressBarFill"]') || qs(doc, '[data-ref="progressBarFill"]');
  }

  function readProgressPct(fill) {
    if (!fill) return null;
    const w = fill.style?.width || '';
    const m = String(w).match(/([0-9.]+)%/);
    if (!m) return null;
    const pct = parseFloat(m[1]);
    return Number.isFinite(pct) ? pct : null;
  }

  function fireMouseSequence(el) {
    // Some players bind navigation to pointer/mouse events rather than a simple click().
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const vw = el.ownerDocument.defaultView;

    const common = { bubbles: true, cancelable: true, composed: true, view: vw, clientX: cx, clientY: cy };

    if (typeof vw.PointerEvent === 'function') {
      el.dispatchEvent(new vw.PointerEvent('pointerdown', { ...common, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 }));
      el.dispatchEvent(new vw.PointerEvent('pointerup', { ...common, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 0 }));
    }

    el.dispatchEvent(new vw.MouseEvent('mousedown', { ...common, button: 0, buttons: 1 }));
    el.dispatchEvent(new vw.MouseEvent('mouseup', { ...common, button: 0, buttons: 0 }));
    el.dispatchEvent(new vw.MouseEvent('click', { ...common, button: 0, buttons: 0 }));

    if (typeof el.click === 'function') el.click();
  }

  function getAllSameOriginDocs(win, depth = 0, out = []) {
    // Recursively collect same-origin documents. Cross-origin frames are skipped automatically.
    if (depth > MAX_DEPTH) return out;

    try {
      if (win.document) out.push(win.document);
    } catch (_) {
      return out; // Cross-origin
    }

    let frames = [];
    try { frames = Array.from(win.frames || []); } catch (_) { frames = []; }

    for (const fwin of frames) {
      try { getAllSameOriginDocs(fwin, depth + 1, out); } catch (_) {}
    }
    return out;
  }

  function tryAdvanceInDoc(doc) {
    if (Date.now() < cooldownUntil) return;
    if (isQuizOrSubmit(doc)) return;

    const btn = getNextBtn(doc);
    const fill = getProgressFill(doc);
    if (!btn && !fill) return;

    let st = stateByDoc.get(doc);
    if (!st) {
      st = { sawDisabled: false, sawNotDone: false, lastEnabled: null };
      stateByDoc.set(doc, st);
      log('controls candidate doc:', doc.location?.href || '<no href>');
    }

    // Arm conditions:
    // - sawDisabled: NEXT was disabled at least once (typical "must finish to unlock")
    // - sawNotDone: progress was < 100% at least once (prevents auto-skipping immediately on load)
    const enabled = btn ? isNextEnabled(btn) : false;
    if (btn && !enabled) st.sawDisabled = true;

    const pct = fill ? readProgressPct(fill) : null;
    if (pct != null && pct < DONE_PCT) st.sawNotDone = true;

    const unlockedNow = (st.lastEnabled === false && enabled === true);
    st.lastEnabled = enabled;

    const doneNow = (pct != null && pct >= DONE_PCT);
    const armed = st.sawDisabled || st.sawNotDone;

    if (armed && btn && enabled && (unlockedNow || doneNow)) {
      setTimeout(() => {
        if (Date.now() < cooldownUntil) return;
        if (isQuizOrSubmit(doc)) return;

        const b = getNextBtn(doc);
        if (!b || !isNextEnabled(b)) return;

        log('Click NEXT', { unlockedNow, doneNow, pct, doc: doc.location?.href });
        const target = b.querySelector('.view-content') || b;
        fireMouseSequence(target);

        cooldownUntil = Date.now() + COOLDOWN_MS;

        // Reset for the next segment.
        st.sawDisabled = false;
        st.sawNotDone = false;
        st.lastEnabled = null;
      }, CLICK_DELAY_MS);
    }
  }

  log('loaded at', location.href, 'top?', window.top === window);

  setInterval(() => {
    const docs = getAllSameOriginDocs(window);
    for (const doc of docs) tryAdvanceInDoc(doc);
  }, POLL_MS);
})();
