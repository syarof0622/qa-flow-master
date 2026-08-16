import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';

const contractSource = await readFile(new URL('../../shared/contracts.js', import.meta.url), 'utf8');
const backgroundSource = await (async () => {
  // background.js was split into a thin router + per-domain modules (Phase 2).
  // Concatenate the router + every module so regex checks find all actions.
  const parts = [await readFile(new URL('../../background.js', import.meta.url), 'utf8')];
  const modDir = new URL('../../background/', import.meta.url);
  const files = (await readdir(modDir)).filter(f => f.endsWith('.js')).sort();
  // Resolve against modDir (not path.join on modDir.pathname) - on Windows a
  // file:// URL pathname looks like "/C:/Users/...", which path.join mangles.
  for (const f of files) parts.push(await readFile(new URL(f, modDir), 'utf8'));
  return parts.join('\n');
})();
const sandbox = { self: {}, Set, Object, Array, String };
vm.runInNewContext(contractSource, sandbox);
const contracts = sandbox.self.QAContracts;

test('runtime contract covers every background action', () => {
  const implemented = [...backgroundSource.matchAll(/case '([A-Z0-9_]+)'/g)].map(match => match[1]).sort();
  assert.deepEqual([...contracts.actions].sort(), implemented);
});

test('mutation actions are registered runtime actions', () => {
  for (const action of contracts.mutationActions) assert.equal(contracts.actionSet.has(action), true, action);
});

test('runtime contract rejects malformed messages', () => {
  assert.equal(contracts.validateMessage(null).valid, false);
  assert.equal(contracts.validateMessage({ action: 'UNKNOWN' }).valid, false);
  assert.equal(contracts.validateMessage({ action: 'GET_STATE', payload: [] }).valid, false);
  assert.equal(contracts.validateMessage({ action: 'GET_STATE', payload: {} }).valid, true);
});
