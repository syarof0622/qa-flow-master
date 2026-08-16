import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Load the pure helper/codegen modules in a vm sandbox (no DOM/chrome needed —
// these functions are pure). They are loaded like the browser does: via script
// tag into the shared global scope.
const root = new URL('../../', import.meta.url);
const ctx = { console, Set, Map, URL, JSON, String, Number, Math };
vm.runInNewContext(readFileSync(new URL('sidepanel/render.js', root), 'utf8'), ctx, { filename: 'sidepanel/render.js' });
vm.runInNewContext(readFileSync(new URL('sidepanel/codegen.js', root), 'utf8'), ctx, { filename: 'sidepanel/codegen.js' });

test('escapeHTML escapes HTML metacharacters', () => {
  assert.equal(ctx.escapeHTML('<script>&"</script>'), '&lt;script&gt;&amp;&quot;&lt;/script&gt;');
  assert.equal(ctx.escapeHTML(''), '');
  assert.equal(ctx.escapeHTML('plain text'), 'plain text');
});

test('findHardcodedSecret finds credential-like keys but ignores placeholders', () => {
  const obj = { suite: { steps: [{ value: '{{secret}}' }], login: { password: 'hardcoded' } } };
  const found = ctx.findHardcodedSecret(obj);
  assert.ok(found.includes('password'), `expected password path, got: ${found}`);
  assert.ok(!found.includes('{{secret}}'));
});

test('findHardcodedSecret returns empty when only placeholders / redacted', () => {
  const clean = { url: 'https://x', headers: { authorization: '{{auth}}' } };
  assert.equal(ctx.findHardcodedSecret(clean), '');
});

test('jsLiteral safely stringifies values', () => {
  assert.equal(ctx.jsLiteral('a"b'), JSON.stringify('a"b'));
  assert.equal(ctx.jsLiteral(undefined), '""');
});

test('safeCodeComment strips newlines and comment terminators', () => {
  const comment = ctx.safeCodeComment('line1\nline2 */ hack');
  assert.ok(!comment.includes('\n'));
  assert.ok(!comment.includes('*/'));
  assert.ok(comment.length <= 180);
});

test('generatePlaywrightCode emits a runnable spec for a click + fill', () => {
  const code = ctx.generatePlaywrightCode(
    [{ action: 'goto', selector: '', value: '', description: '' }, { action: 'click', selector: '#btn', value: '', description: 'Klik tombol' }, { action: 'fill', selector: '#name', value: 'Budi', description: 'Isi nama' }],
    'https://example.com'
  );
  assert.match(code, /import \{ test, expect \} from '@playwright\/test'/);
  assert.match(code, /page\.goto\("https:\/\/example\.com"\)/);
  assert.match(code, /locator\("#btn"\)\.click\(\)/);
  assert.match(code, /locator\("#name"\)\.fill\("Budi"\)/);
  assert.match(code, /test\('Automated QA Flow Test'/);
});

test('generatePlaywrightCode emits .press() for a selector, and page.keyboard.press() without one', () => {
  const withSelector = ctx.generatePlaywrightCode([{ action: 'press', selector: '#search', value: 'Enter', description: 'Submit search' }], 'https://example.com');
  assert.match(withSelector, /locator\("#search"\)\.press\("Enter"\)/);
  const withoutSelector = ctx.generatePlaywrightCode([{ action: 'press', selector: '', value: 'Enter', description: 'Submit focused field' }], 'https://example.com');
  assert.match(withoutSelector, /page\.keyboard\.press\("Enter"\)/);
});

test('generateCypressCode emits a cypress spec', () => {
  const code = ctx.generateCypressCode([{ action: 'click', selector: '#btn', value: '', description: '' }], 'https://example.com');
  assert.match(code, /describe\('Automated QA Flow Test'/);
  assert.match(code, /cy\.visit\("https:\/\/example\.com"\)/);
  assert.match(code, /cy\.get\("#btn"\)\.click\(\)/);
});
