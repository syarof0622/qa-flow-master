import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { ACTION_NAMES } from '../../runner/lib/action-registry.mjs';

const root = new URL('../../', import.meta.url);

// --- Pure step sanitizer (sidepanel/codegen.js) ----------------------------
const pureCtx = { console, Set, Map, URL, JSON, String, Number, Math };
vm.runInNewContext(readFileSync(new URL('sidepanel/codegen.js', root), 'utf8'), pureCtx, { filename: 'sidepanel/codegen.js' });

test('sanitizeCopilotSteps drops unknown actions and clamps fields', () => {
  const allow = new Set(ACTION_NAMES);
  const steps = [
    { action: 'click', selector: 'button', description: 'Klik', timeout: 5 },
    { action: 'execute_script', selector: 'x' }, // NOT in allowlist -> dropped
    { action: 'fill', selector: 'input', value: 'v'.repeat(6000) }, // value clamped
    null,
    'garbage'
  ];
  const out = pureCtx.sanitizeCopilotSteps(steps, allow);
  assert.equal(out.length, 2);
  assert.equal(out[0].action, 'click');
  assert.equal(out[0].timeout, 250, 'timeout 5 clamps to minimum 250ms');
  assert.equal(out[1].action, 'fill');
  assert.equal(out[1].value.length, 5000, 'value clamped to 5000 chars');
  assert.equal(out[1].risk, 'MEDIUM', 'default risk MEDIUM');
});

test('sanitizeCopilotSteps caps at 200 and rejects non-arrays', () => {
  const allow = new Set(ACTION_NAMES);
  const many = Array.from({ length: 250 }, (_, i) => ({ action: 'click', selector: `#s${i}` }));
  assert.equal(pureCtx.sanitizeCopilotSteps(many, allow).length, 200);
  // vm-context arrays are cross-realm, so compare via JSON.stringify.
  assert.equal(JSON.stringify(pureCtx.sanitizeCopilotSteps(null, allow)), '[]');
  assert.equal(JSON.stringify(pureCtx.sanitizeCopilotSteps({}, allow)), '[]');
  assert.equal(JSON.stringify(pureCtx.sanitizeCopilotSteps('nope', allow)), '[]');
});

test('sanitizeCopilotSteps clamps timeout bounds and preserves risk enum', () => {
  const allow = new Set(ACTION_NAMES);
  const out = pureCtx.sanitizeCopilotSteps([
    { action: 'click', timeout: 999999, risk: 'BOGUS' },
    { action: 'click', timeout: -5, risk: 'CRITICAL' }
  ], allow);
  assert.equal(out[0].timeout, 60000, 'timeout clamped to 60000 max');
  assert.equal(out[0].risk, 'MEDIUM', 'unknown risk falls back to MEDIUM');
  assert.equal(out[1].timeout, 250, 'timeout clamped to 250 min');
  assert.equal(out[1].risk, 'CRITICAL');
});

// --- Background redaction (background/state.js) ----------------------------
async function loadWorker() {
  const ctx = {
    console, crypto, Set, Map, Promise, setTimeout, clearTimeout, URL, Headers, TextEncoder,
    OffscreenCanvas: undefined, createImageBitmap: undefined,
    fetch: async () => ({ ok: false, status: 0, headers: { has: () => false, keys: () => [] }, text: async () => '', json: async () => ({}) })
  };
  ctx.self = ctx;
  ctx.chrome = {
    runtime: { onMessage: { addListener: () => {} }, onInstalled: { addListener: () => {} }, lastError: null, getURL: () => 'chrome-extension://x/', sendMessage: () => {} },
    storage: { local: { get: (k, cb) => cb && cb({}), set: (o, cb) => cb && cb() } },
    sidePanel: { setPanelBehavior: async () => {} },
    tabs: { query: async () => [], sendMessage: () => {}, captureVisibleTab: () => {} },
    webNavigation: { onCompleted: { addListener: () => {} }, getAllFrames: async () => [] },
    commands: { onCommand: { addListener: () => {} } },
    scripting: { executeScript: async () => [] }
  };
  ctx.importScripts = (...files) => {
    for (const f of files) vm.runInNewContext(readFileSync(new URL(f, root), 'utf8'), ctx, { filename: f });
  };
  vm.runInNewContext(await readFile(new URL('background.js', root), 'utf8'), ctx, { filename: 'background.js' });
  return ctx;
}

test('redactLogData redacts credential-like keys and nested values', async () => {
  const ctx = await loadWorker();
  const redacted = vm.runInContext(`
    redactLogData({
      user: { password: 'hunter2', name: 'Budi' },
      headers: { authorization: 'Bearer abc.def.ghi', token: 'xyz' },
      card: { number: '4111 1111', cvv: '123' },
      otp: '123456',
      safe: { url: 'https://x.com', method: 'POST' }
    })
  `, ctx);
  assert.equal(redacted.user.password, '[REDACTED]');
  assert.equal(redacted.user.name, 'Budi');
  assert.equal(redacted.headers.authorization, '[REDACTED]');
  assert.equal(redacted.headers.token, '[REDACTED]');
  assert.equal(redacted.card, '[REDACTED]', 'sensitive parent key collapses whole subtree');
  assert.equal(redacted.otp, '[REDACTED]');
  assert.equal(redacted.safe.url, 'https://x.com');
});

test('redactLogData handles string patterns, Bearer tokens, arrays, and cycles', async () => {
  const ctx = await loadWorker();
  const res = vm.runInContext(`
    (() => {
      const cyc = { name: 'a' }; cyc.self = cyc;
      return {
        str: redactLogData('password=sekret&email=a@b.com'),
        bearer: redactLogData('Bearer eyJhbGciOiJIUzI1NiJ9.payload'),
        arr: redactLogData([{ api_key: 'k1' }, 'plain']),
        cyc: redactLogData(cyc)
      };
    })()
  `, ctx);
  assert.match(res.str, /password=\[REDACTED\]/);
  assert.ok(!res.str.includes('sekret'));
  assert.match(res.bearer, /Bearer \[REDACTED\]/);
  assert.equal(res.arr[0].api_key, '[REDACTED]');
  assert.equal(res.arr[1], 'plain');
  assert.equal(res.cyc.self, '[CIRCULAR]');
});

test('sanitizeCopilotThreadsForCloud redacts credentials but keeps normal text', async () => {
  const ctx = await loadWorker();
  const out = vm.runInContext(`
    sanitizeCopilotThreadsForCloud([
      {
        id: 't1',
        title: 'Skenario login password=rahasia123',
        messages: [
          { id: 'm1', sender: 'user', text: 'isi password: secret123', cleanReply: 'ok' },
          { id: 'm2', sender: 'system', text: 'Langkah berhasil dibuat', cleanReply: 'Berhasil',
            steps: [
              { action: 'fill', selector: 'input[type=password]', value: 'S3cret!', description: 'Isi password' },
              { action: 'click', selector: '#login', value: '', description: 'Klik login' }
            ] }
        ]
      }
    ])
  `, ctx);
  assert.ok(!out[0].title.includes('rahasia123'), 'title credential redacted');
  assert.ok(!out[0].messages[0].text.includes('secret123'), 'message credential redacted');
  assert.equal(out[0].messages[1].steps[0].value, '[REDACTED]', 'step value redacted for password step');
  assert.equal(out[0].messages[1].steps[1].value, '', 'non-sensitive step value preserved');
  assert.equal(out[0].messages[1].cleanReply, 'Berhasil', 'normal reply preserved');
});

test('sanitizeCopilotThreadsForCloud preserves ordinary prose', async () => {
  const ctx = await loadWorker();
  const out = vm.runInContext(`
    sanitizeCopilotThreadsForCloud([{ id: 't1', title: 'Verifikasi halaman beranda', messages: [{ id: 'm1', sender: 'user', text: 'Buatkan skenario cek judul dan tombol utama', cleanReply: 'Berhasil', steps: [{ action: 'click', selector: '#submit', value: '', description: 'Klik submit' }] }] }])
  `, ctx);
  assert.equal(out[0].title, 'Verifikasi halaman beranda', 'prose title preserved');
  assert.equal(out[0].messages[0].text, 'Buatkan skenario cek judul dan tombol utama', 'prose message preserved');
  assert.equal(out[0].messages[0].steps[0].value, '', 'step value preserved');
});

test('sanitizeCopilotThreadsForCloud handles non-array input', async () => {
  const ctx = await loadWorker();
  assert.equal(vm.runInContext('sanitizeCopilotThreadsForCloud(null)', ctx), null);
  assert.equal(JSON.stringify(vm.runInContext('sanitizeCopilotThreadsForCloud([])', ctx)), '[]');
});

// --- Shared contract: step action vocabulary stays in sync -----------------
test('QAContracts.stepActions matches runner ACTION_NAMES and validator works', async () => {
  const ctx = { Set, Object, String };
  vm.runInNewContext(readFileSync(new URL('shared/contracts.js', root), 'utf8'), ctx, { filename: 'shared/contracts.js' });
  assert.deepEqual([...ctx.QAContracts.stepActions].sort(), [...ACTION_NAMES].sort());
  assert.equal(ctx.QAContracts.isSupportedStepAction('click'), true);
  assert.equal(ctx.QAContracts.isSupportedStepAction('execute_script'), false);
  assert.equal(ctx.QAContracts.isSupportedStepAction(''), false);
  assert.equal(ctx.QAContracts.isSupportedStepAction(null), false);
});
