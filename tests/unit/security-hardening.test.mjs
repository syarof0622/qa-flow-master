import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const read = file => readFile(new URL(`../../${file}`, import.meta.url), 'utf8');

// background.js was split into a thin router + per-domain modules (Phase 2).
// Concatenate the router + every module so regex checks keep working.
const readBackground = async () => {
  const parts = [await read('background.js')];
  const modDir = new URL('../../background/', import.meta.url);
  const files = (await readdir(modDir)).filter(f => f.endsWith('.js')).sort();
  for (const f of files) parts.push(await readFile(path.join(modDir.pathname, f), 'utf8'));
  return parts.join('\n');
};

// sidepanel.js core was split into modules (incl. pure code generators in
// sidepanel/codegen.js). Concatenate so regex checks find moved symbols.
const readSidepanel = async () => {
  const parts = [await read('sidepanel.js')];
  const modDir = new URL('../../sidepanel/', import.meta.url);
  const files = (await readdir(modDir)).filter(f => f.endsWith('.js')).sort();
  for (const f of files) parts.push(await readFile(path.join(modDir.pathname, f), 'utf8'));
  return parts.join('\n');
};

test('page monitoring is on-demand and response bodies are opt-in', async () => {
  const [manifest, panel, monitor] = await Promise.all([read('manifest.json'), read('sidepanel.js'), read('injected-monitor.js')]);
  assert.equal(Object.hasOwn(JSON.parse(manifest), 'content_scripts'), false);
  assert.match(panel, /recorderOnly:\s*true/);
  assert.match(monitor, /captureBodies:\s*window\.__QFM_CAPTURE_BODIES_ONCE__\s*===\s*true/);
  assert.match(monitor, /monitorConfig\.captureBodies\s*\?/);
});

test('page event bridge applies type, rate, and payload bounds', async () => {
  const content = await read('content.js');
  assert.match(content, /acceptedLogTypes/);
  assert.match(content, /logWindow\.count\s*>\s*120/);
  assert.match(content, /serialized\.length\s*>\s*32768/);
});

test('background fetch validates each redirect target', async () => {
  const background = await readBackground();
  assert.match(background, /redirect:\s*'manual'/);
  assert.match(background, /const next = assertPublicHttpUrl/);
  assert.match(background, /authorization.*cookie.*proxy-authorization/s);
});

test('workspace restore is size and collection bounded', async () => {
  const background = await readBackground();
  assert.match(background, /> 8 \* 1024 \* 1024/);
  assert.match(background, /backup\.suites\.length > 50/);
  assert.match(background, /source\.steps\.length > 500/);
  assert.match(background, /validateWorkspaceBackup\(backup\)/);
});

test('recorder injection does not wait for streaming pages to become idle', async () => {
  const background = await readBackground();
  const panel = await read('sidepanel.js');
  assert.match(background, /injectImmediately:\s*true/);
  assert.match(background, /Injeksi recorder melewati batas waktu/);
  assert.doesNotMatch(panel, /if \(!ready\) return showBentoAlert\('Halaman belum siap'/);
  assert.match(background, /allFrames:\s*true/);
  assert.match(background, /sendCommandToAllFrames/);
  assert.match(background, /sendStepCommandToTab/);
});

test('monitor lifecycle, CLI redirects, and frame export are hardened', async () => {
  const background = await readBackground();
  const monitor = await read('injected-monitor.js');
  const runner = await read('tests/qa-flow.spec.mjs');
  const panel = await readSidepanel();
  assert.match(background, /case 'STOP_MONITOR'/);
  assert.match(background, /disableMonitor\(tabId\)/);
  assert.match(monitor, /if \(!monitorActive\) return originalFetch/);
  assert.match(monitor, /resourceObserver\?\.disconnect\(\)/);
  assert.match(runner, /safeRequestFetch/);
  assert.match(runner, /maxRedirects:\s*0/);
  assert.match(runner, /resolveStepScope/);
  assert.match(panel, /frameScope\(page, expectedUrl\)/);
});
