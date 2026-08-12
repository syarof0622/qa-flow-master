import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Load the background worker (router + all modules, incl. qaState service) in a
// sandbox with a chrome stub, then exercise the qaState domain API.
const root = new URL('../../', import.meta.url);

async function loadWorker() {
  const ctx = {
    console,
    crypto,
    Set,
    Map,
    Promise,
    setTimeout,
    clearTimeout,
    URL,
    Headers,
    TextEncoder,
    OffscreenCanvas: undefined,
    createImageBitmap: undefined,
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
    for (const f of files) {
      // readFileSync keeps importScripts synchronous, exactly like a service worker.
      vm.runInNewContext(readFileSync(new URL(f, root), 'utf8'), ctx, { filename: f });
    }
  };
  vm.runInNewContext(await readFile(new URL('background.js', root), 'utf8'), ctx, { filename: 'background.js' });
  return ctx;
}

test('qaState service exposes every domain', async () => {
  const ctx = await loadWorker();
  const domains = vm.runInContext('Object.keys(qaState).sort()', ctx);
  for (const d of ['suites', 'execution', 'recording', 'logs', 'copilot', 'settings', 'data', 'qa', 'network', 'video']) {
    assert.ok(domains.includes(d), `missing qaState.${d}`);
  }
});

test('qaState.suites CRUD keeps active suite consistent', async () => {
  const ctx = await loadWorker();
  vm.runInContext(`
    const a = createSuiteObject('Alpha');
    qaState.suites.add(a);
    const b = createSuiteObject('Beta');
    qaState.suites.add(b);
    qaState.suites.setActive(a.id);
  `, ctx);
  assert.equal(vm.runInContext('qaState.suites.all().length', ctx), 2);
  assert.equal(vm.runInContext('qaState.suites.active().name', ctx), 'Alpha');
  // remove active -> falls back to first suite
  vm.runInContext('qaState.suites.remove(qaState.suites.activeId())', ctx);
  assert.equal(vm.runInContext('qaState.suites.all().length', ctx), 1);
  assert.equal(vm.runInContext('qaState.suites.active().name', ctx), 'Beta');
});

test('qaState.execution results patch and history cap', async () => {
  const ctx = await loadWorker();
  vm.runInContext(`
    qaState.execution.setResults({ status: 'RUNNING', passedSteps: 0, failedSteps: 0, totalSteps: 2, startTime: new Date().toISOString(), endTime: null, stepDetails: [] });
    qaState.execution.patchResults({ failedSteps: 1 });
    for (let i = 0; i < 30; i++) qaState.execution.pushHistory({ id: 'run_' + i, status: 'COMPLETED', passedSteps: 1, failedSteps: 0 });
  `, ctx);
  assert.equal(vm.runInContext('qaState.execution.results().failedSteps', ctx), 1);
  assert.equal(vm.runInContext('qaState.execution.results().status', ctx), 'RUNNING');
  assert.equal(vm.runInContext('qaState.execution.history().length', ctx), 20, 'history capped at 20');
});

test('qaState.copilot thread save/delete/active', async () => {
  const ctx = await loadWorker();
  vm.runInContext(`
    qaState.copilot.saveThread({ id: 't1', title: 'Satu', messages: [] });
    qaState.copilot.saveThread({ id: 't2', title: 'Dua', messages: [] });
    qaState.copilot.deleteThread('t1');
  `, ctx);
  assert.equal(vm.runInContext('qaState.copilot.threads().length', ctx), 1);
  assert.equal(vm.runInContext('qaState.copilot.threads()[0].id', ctx), 't2');
  assert.equal(vm.runInContext('qaState.copilot.activeThreadId()', ctx), 't2');
});

test('qaState.settings secrets sync into sessionSecrets', async () => {
  const ctx = await loadWorker();
  vm.runInContext(`qaState.settings.setSecrets({ api: 'abc' })`, ctx);
  assert.equal(vm.runInContext('sessionSecrets.api', ctx), 'abc');
  assert.equal(vm.runInContext('qaState.settings.secrets().api', ctx), 'abc');
});

test('qaState.data dataset & environment persistence', async () => {
  const ctx = await loadWorker();
  vm.runInContext(`
    qaState.data.saveDataset({ id: 'ds1', name: 'D', rows: [{ a: 1 }] });
    qaState.data.setActiveDataset('ds1', 0);
    qaState.data.saveEnvironment({ id: 'e1', name: 'Env', baseUrl: 'https://x', variables: {} });
    qaState.data.setActiveEnvironment('e1');
  `, ctx);
  assert.equal(vm.runInContext('qaState.data.datasets().length', ctx), 1);
  assert.equal(vm.runInContext('qaState.data.activeDatasetId()', ctx), 'ds1');
  assert.equal(vm.runInContext('qaState.data.activeEnvironmentId()', ctx), 'e1');
});

test('qaState.video history push/cap/clear', async () => {
  const ctx = await loadWorker();
  vm.runInContext(`
    for (let i = 0; i < 60; i++) qaState.video.push({ url: 'v' + i });
  `, ctx);
  assert.equal(vm.runInContext('qaState.video.history().length', ctx), 50, 'video history capped at 50');
  vm.runInContext('qaState.video.clear()', ctx);
  assert.equal(vm.runInContext('qaState.video.history().length', ctx), 0);
});
