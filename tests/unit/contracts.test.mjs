import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { ACTION_NAMES } from '../../runner/lib/action-registry.mjs';
import { validateSuiteDocument } from '../../runner/lib/suite-loader.mjs';

const root = new URL('../../', import.meta.url);

// sidepanel.js was split into a core + modules (incl. pure code generators in
// sidepanel/codegen.js). Concatenate core + all sidepanel modules so regex
// checks keep finding symbols that live in the modules.
const readSidepanel = async () => {
  const parts = [await readFile(new URL('sidepanel.js', root), 'utf8')];
  const modDir = new URL('../../sidepanel/', import.meta.url);
  const files = (await readdir(modDir)).filter(f => f.endsWith('.js')).sort();
  for (const f of files) parts.push(await readFile(path.join(modDir.pathname, f), 'utf8'));
  return parts.join('\n');
};

test('schema action enum matches the action registry', async () => {
  const schema = JSON.parse(await readFile(new URL('qa-flow.schema.json', root), 'utf8'));
  assert.deepEqual([...schema.$defs.step.properties.action.enum].sort(), [...ACTION_NAMES].sort());
});

test('every registered action is implemented by the Playwright engine', async () => {
  const source = await readFile(new URL('tests/qa-flow.spec.mjs', root), 'utf8');
  for (const action of ACTION_NAMES) assert.match(source, new RegExp(`case ['\"]${action}['\"]`), `Missing runner action: ${action}`);
});

test('extension import allowlist matches the action registry', async () => {
  const source = await readFile(new URL('sidepanel.js', root), 'utf8');
  const allowlistMatch = source.match(/const allowedActions = new Set\(\[([^\]]+)\]\)/);
  assert.ok(allowlistMatch, 'Import action allowlist not found');
  const actions = [...allowlistMatch[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.deepEqual(actions.sort(), [...ACTION_NAMES].sort());
});

test('manual step UI exposes every registered action', async () => {
  const html = await readFile(new URL('sidepanel.html', root), 'utf8');
  const select = html.match(/<select id="manualAction"[\s\S]*?<\/select>/)?.[0] || '';
  const actions = [...select.matchAll(/value="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(actions.sort(), [...ACTION_NAMES].sort());
});

test('Playwright code export covers every registered action', async () => {
  const source = await readSidepanel();
  const generator = source.slice(source.indexOf('function generatePlaywrightCode'), source.indexOf('function generateCypressCode'));
  for (const action of ACTION_NAMES) assert.match(generator, new RegExp(`case ['\"]${action}['\"]`), `Missing exported action: ${action}`);
});

test('valid suite passes and unsupported action fails before browser launch', () => {
  const valid = { schemaVersion: 2, suite: { name: 'Smoke', steps: [{ action: 'assert_visible', selector: 'body' }] } };
  assert.equal(validateSuiteDocument(valid).suite.name, 'Smoke');
  assert.throws(() => validateSuiteDocument({ schemaVersion: 2, suite: { name: 'Bad', steps: [{ action: 'execute_script' }] } }), /schema invalid/i);
});
