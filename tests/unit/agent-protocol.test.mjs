import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Load the pure AI Sharing Agent protocol module (no DOM/chrome needed).
const root = new URL('../../', import.meta.url);
const ctx = { console, Set, Map, URL, JSON, String, Number, Math, Object };
vm.runInNewContext(readFileSync(new URL('sidepanel/agent-protocol.js', root), 'utf8'), ctx, { filename: 'sidepanel/agent-protocol.js' });

test('parseAgentAction parses click/fill/select actions', () => {
  const click = ctx.parseAgentAction('{"tool":"click","selector":"#login-link"}');
  assert.equal(click.tool, 'click');
  assert.equal(click.selector, '#login-link');
  const fill = ctx.parseAgentAction('{"tool":"fill","selector":"#email","value":"a@b.com"}');
  assert.equal(fill.tool, 'fill');
  assert.equal(fill.value, 'a@b.com');
  const select = ctx.parseAgentAction('{"tool":"select","selector":"select#country","value":"ID"}');
  assert.equal(select.tool, 'select');
  assert.equal(select.value, 'ID');
});

test('parseAgentAction tolerates markdown code fences around JSON', () => {
  const done = ctx.parseAgentAction('```json\n{"tool":"done","summary":"Selesai","steps":[{"action":"click","selector":"#x"}]}\n```');
  assert.equal(done.tool, 'done');
  assert.equal(done.steps.length, 1);
});

test('parseAgentAction returns retry for non-JSON or unknown tools', () => {
  assert.equal(ctx.parseAgentAction('').tool, 'retry');
  const noJson = ctx.parseAgentAction('Saya akan klik tombol login');
  assert.equal(noJson.tool, 'retry');
  assert.match(noJson.reason, /JSON/);
  const badTool = ctx.parseAgentAction('{"tool":"execute_script","selector":"x"}');
  assert.equal(badTool.tool, 'retry');
  assert.match(badTool.reason, /execute_script/);
  const malformed = ctx.parseAgentAction('{"tool":"click", oops}');
  assert.equal(malformed.tool, 'retry');
});

test('parseAgentAction normalizes tool to lowercase', () => {
  const a = ctx.parseAgentAction('{"tool":"DONE","steps":[]}');
  assert.equal(a.tool, 'done');
});

test('isTerminalAction only true for done', () => {
  assert.equal(ctx.isTerminalAction({ tool: 'done' }), true);
  assert.equal(ctx.isTerminalAction({ tool: 'click' }), false);
  assert.equal(ctx.isTerminalAction(null), false);
  assert.equal(ctx.isTerminalAction(undefined), false);
});

test('agentToolDocs exposes the tool vocabulary', () => {
  const docs = ctx.agentToolDocs();
  for (const tool of ['click', 'fill', 'select', 'wait', 'done']) {
    assert.match(docs, new RegExp(tool), `tool docs must mention ${tool}`);
  }
});
