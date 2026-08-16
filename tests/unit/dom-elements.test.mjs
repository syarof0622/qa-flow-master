import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Load the pure DOM-visibility helpers (no browser needed) and exercise them
// with lightweight element/document stubs. This guards the "click the real
// topmost element, not the one behind a popup/modal" logic in content.js.
const root = new URL('../../', import.meta.url);
const ctx = { console, Math, Boolean, Object, Array, String, Number };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('shared/dom-elements.js', root), 'utf8'), ctx, { filename: 'shared/dom-elements.js' });
const dom = ctx.__QADom;

// Minimal element stub exposing only what the helpers need.
function el({ x = 0, y = 0, width = 100, height = 40, contains, closest, id = '' } = {}) {
  return {
    id,
    getBoundingClientRect() {
      return { left: x, top: y, width, height, right: x + width, bottom: y + height };
    },
    contains: contains || (() => false),
    closest: closest || (() => null)
  };
}

function env({ documentElement = el({ id: 'html' }), body = el({ id: 'body' }), innerWidth = 800, innerHeight = 600, elementFromPoint = () => null } = {}) {
  return { document: { documentElement, body, elementFromPoint }, innerWidth, innerHeight };
}

// ---- isTopmostAtCenter ----
test('isTopmostAtCenter: element on top at its center is topmost', () => {
  const target = el({ x: 100, y: 100, width: 200, height: 50 });
  const e = env({ elementFromPoint: () => target });
  assert.equal(dom.isTopmostAtCenter(e, target), true);
});

test('isTopmostAtCenter: element covered by another element (modal/overlay) is not topmost', () => {
  const covered = el({ x: 100, y: 100, width: 200, height: 50 });
  const overlay = el({ id: 'overlay' });
  const e = env({ elementFromPoint: () => overlay });
  assert.equal(dom.isTopmostAtCenter(e, covered), false);
});

test('isTopmostAtCenter: a child element counts as on top of its parent', () => {
  const button = el({ x: 100, y: 100, width: 200, height: 50 });
  const label = el({ x: 120, y: 110, width: 30, height: 20 });
  button.contains = child => child === label;
  const e = env({ elementFromPoint: () => label });
  assert.equal(dom.isTopmostAtCenter(e, button), true);
});

test('isTopmostAtCenter: zero-size and out-of-viewport elements are not topmost', () => {
  const e = env(); // elementFromPoint returns null
  assert.equal(dom.isTopmostAtCenter(e, el({ width: 0, height: 0 })), false);
  assert.equal(dom.isTopmostAtCenter(e, el({ x: 0, y: 900, width: 100, height: 50 })), false);
  // Center below viewport bottom (innerHeight 600):
  const e2 = env({ innerHeight: 600 });
  assert.equal(dom.isTopmostAtCenter(e2, el({ x: 0, y: 590, width: 100, height: 50 })), false);
});

test('isTopmostAtCenter: guards against null element / missing document', () => {
  assert.equal(dom.isTopmostAtCenter(env(), null), false);
  assert.equal(dom.isTopmostAtCenter({ innerWidth: 800, innerHeight: 600 }, el({})), false);
});

// ---- preferTopmostMatch ----
test('preferTopmostMatch: picks the topmost match over the first in DOM order', () => {
  const backgroundButton = el({ x: 0, y: 0, width: 100, height: 40 });
  const popupButton = el({ x: 0, y: 0, width: 100, height: 40 });
  const e = env({ elementFromPoint: () => popupButton });
  const picked = dom.preferTopmostMatch(e, [backgroundButton, popupButton], () => true);
  assert.equal(picked, popupButton);
});

test('preferTopmostMatch: falls back to a visible match, then the first, then null', () => {
  const a = el({});
  const b = el({});
  const e = env(); // elementFromPoint -> null, so nothing is topmost
  assert.equal(dom.preferTopmostMatch(e, [a, b], el => el === b), b);
  assert.equal(dom.preferTopmostMatch(e, [a, b], () => false), a);
  assert.equal(dom.preferTopmostMatch(e, [], () => true), null);
});
