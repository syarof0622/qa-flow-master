// shared/dom-elements.js - Pure DOM-visibility helpers (dependency-injected)
// Used by content.js (injected as an ISOLATED-world content script) so the
// "detect what a real user sees / would click" logic is unit-testable in Node
// without a browser. Exposed as globalThis.__QADom and injected BEFORE
// content.js.
// Every function takes an explicit `env = { document, innerWidth, innerHeight }`
// so tests can pass lightweight stubs instead of a real DOM.
(function (global) {
  'use strict';
  const dom = {};

  // True when `el` is the topmost thing at its center point — i.e. a real
  // user's click there would hit this element, not a modal/overlay or a
  // covered element behind it.
  dom.isTopmostAtCenter = function (env, el) {
    if (!el || !env || !env.document) return false;
    const rect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
    if (!rect || !rect.width || !rect.height) return false;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    if (cx < 0 || cy < 0 || cx > (env.innerWidth || 0) || cy > (env.innerHeight || 0)) return false;
    const topEl = typeof env.document.elementFromPoint === 'function' ? env.document.elementFromPoint(cx, cy) : null;
    if (!topEl) return false;
    return topEl === el || (typeof el.contains === 'function' && el.contains(topEl));
  };

  // Pick the match a human would actually click when several elements share a
  // label: the one topmost at its center, then any visible one, then the first.
  // A "Register" button hidden behind a popup/modal must never shadow the one
  // inside the popup.
  // `isVisible` is an optional predicate (el => boolean).
  dom.preferTopmostMatch = function (env, matches, isVisible) {
    if (!Array.isArray(matches) || !matches.length) return null;
    const top = matches.find(el => dom.isTopmostAtCenter(env, el));
    if (top) return top;
    if (typeof isVisible === 'function') {
      const visible = matches.find(el => isVisible(el));
      if (visible) return visible;
    }
    return matches[0];
  };

  global.__QADom = dom;
})(typeof globalThis !== 'undefined' ? globalThis : this);
