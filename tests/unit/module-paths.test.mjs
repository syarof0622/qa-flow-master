import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';

const root = new URL('../../', import.meta.url);
const exists = async file => { try { await access(file); return true; } catch { return false; } };
const read = file => readFile(new URL(file, root), 'utf8');
// Resolve a relative reference from the directory of the importing file.
const resolveRel = (baseDir, ref) => {
  // strip query/hash (not expected here, kept for safety)
  const clean = ref.split(/[?#]/)[0];
  return path.posix.normalize(path.posix.join(baseDir, clean));
};

test('sidepanel.html script tags all resolve to existing files', async () => {
  const html = await read('sidepanel.html');
  const refs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
  assert.ok(refs.length >= 6, `expected many scripts, got ${refs.length}`);
  for (const ref of refs) {
    const target = resolveRel('', ref); // script src is relative to sidepanel.html (root)
    assert.ok(await exists(new URL(target, root)), `missing script target: ${ref} -> ${target}`);
  }
});

test('dynamic import() paths inside sidepanel/ modules resolve correctly', async () => {
  const files = (await readdir(new URL('sidepanel/', root))).filter(f => f.endsWith('.js'));
  let checked = 0;
  for (const file of files) {
    const source = await read(`sidepanel/${file}`);
    for (const m of source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const ref = m[1];
      // dynamic imports resolve relative to the importing module's URL
      const target = resolveRel('sidepanel', ref);
      assert.ok(await exists(new URL(target, root)), `${file}: import('${ref}') resolves to missing ${target}`);
      checked++;
    }
  }
  assert.ok(checked >= 2, `expected at least the two ai-client imports, got ${checked}`);
});

test('background.js importScripts targets all exist', async () => {
  const bg = await read('background.js');
  const refs = [...bg.matchAll(/importScripts\(([\s\S]*?)\)/g)]
    .flatMap(m => [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]));
  assert.ok(refs.length >= 1);
  for (const ref of refs) {
    const target = resolveRel('', ref);
    assert.ok(await exists(new URL(target, root)), `importScripts missing target: ${ref} -> ${target}`);
  }
});

test('content script injection loads shared/dom-elements.js before content.js', async () => {
  const injection = await read('background/injection.js');
  const filesMatch = injection.match(/files:\s*\[([^\]]*)\]/);
  assert.ok(filesMatch, 'expected a files array in background/injection.js');
  const files = [...filesMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  assert.ok(files.includes('shared/dom-elements.js'), 'shared/dom-elements.js must be injected');
  assert.ok(files.indexOf('shared/dom-elements.js') < files.indexOf('content.js'), 'shared/dom-elements.js must load before content.js');
});

test('all <script> and dynamic imports use the shared/ folder at the correct depth', async () => {
  // The AI client lives at shared/ai-client.js. From sidepanel/qa-copilot.js the
  // import MUST be ../shared/... (regression guard for the broken ./shared path).
  const copilot = await read('sidepanel/qa-copilot.js');
  const aiImport = [...copilot.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]);
  assert.deepEqual(aiImport, ['../shared/ai-client.js'], 'qa-copilot must import from ../shared/ai-client.js');
  const generator = await read('sidepanel/ai-data-generator.js');
  assert.match(generator, /import\(['"]\.\.\/shared\/ai-client\.js['"]\)/, 'ai-data-generator must import from ../shared/ai-client.js');
});

test('every module referenced by scripts exists (sidepanel dir consistency)', async () => {
  const dirFiles = (await readdir(new URL('sidepanel/', root))).filter(f => f.endsWith('.js'));
  const html = await read('sidepanel.html');
  const refs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]).filter(r => r.includes('sidepanel/'));
  for (const ref of refs) {
    const name = path.basename(ref);
    assert.ok(dirFiles.includes(name), `sidepanel.html references sidepanel/${name} but file not found`);
  }
});
