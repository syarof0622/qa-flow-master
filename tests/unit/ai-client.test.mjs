import test from 'node:test';
import assert from 'node:assert/strict';
import { AIClient } from '../../shared/ai-client.js';

// Provide a global fetch mock. AIClient uses the global fetch, so we can drive
// every provider without a real API key and verify requests + response parsing.
const calls = [];
let nextResponse = { ok: true, status: 200, json: async () => ({}) };
const origFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  calls.push({ url, options });
  return nextResponse;
};

test.after(() => { globalThis.fetch = origFetch; });

function makeResponse(payload) {
  return { ok: true, status: 200, statusText: 'OK', json: async () => payload };
}

test('AIClient throws when no API key is set', async () => {
  const ai = new AIClient('gemini', '');
  await assert.rejects(() => ai.sendPrompt('sys', 'user'), /API Key belum diatur/);
});

test('Gemini request builds correct endpoint, payload, and parses reply', async () => {
  calls.length = 0;
  nextResponse = makeResponse({ candidates: [{ content: { parts: [{ text: 'hello gemini' }] } }] });
  const ai = new AIClient('gemini', 'KEY', 'gemini-2.0-flash');
  const out = await ai.sendPrompt('SYSTEM', 'USER PROMPT', 'DOM CONTEXT', [{ type: 'text', name: 't.md', content: 'case' }]);
  assert.equal(out, 'hello gemini');
  assert.equal(calls.length, 1);
  const { url, options } = calls[0];
  assert.match(url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.0-flash:generateContent$/);
  assert.equal(options.headers['x-goog-api-key'], 'KEY');
  const body = JSON.parse(options.body);
  assert.equal(body.systemInstruction.parts[0].text, 'SYSTEM');
  assert.match(body.contents[0].parts[0].text, /USER PROMPT/);
  assert.match(body.contents[0].parts[0].text, /BEGIN_UNTRUSTED_CONTEXT/);
  assert.match(body.contents[0].parts[0].text, /DOM CONTEXT/);
  assert.match(body.contents[0].parts[0].text, /t\.md/);
  assert.equal(body.generationConfig.maxOutputTokens, 8192);
});

test('Gemini attaches base64 images as inlineData', async () => {
  calls.length = 0;
  nextResponse = makeResponse({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] });
  const ai = new AIClient('gemini', 'K');
  await ai.sendPrompt('s', 'u', null, [{ type: 'image', name: 'shot.png', mimeType: 'image/png', base64: 'QUJD' }]);
  const body = JSON.parse(calls[0].options.body);
  const inline = body.contents[0].parts.find(p => p.inlineData);
  assert.deepEqual(inline.inlineData, { mimeType: 'image/png', data: 'QUJD' });
});

test('Claude request sends x-api-key and parses content', async () => {
  calls.length = 0;
  nextResponse = makeResponse({ content: [{ type: 'text', text: 'claude reply' }] });
  const ai = new AIClient('claude', 'SK', 'claude-3-haiku-20240307');
  const out = await ai.sendPrompt('SYSTEM', 'PROMPT');
  assert.equal(out, 'claude reply');
  const { url, options } = calls[0];
  assert.equal(url, 'https://api.anthropic.com/v1/messages');
  assert.equal(options.headers['x-api-key'], 'SK');
  assert.equal(options.headers['anthropic-version'], '2023-06-01');
  const body = JSON.parse(options.body);
  assert.equal(body.model, 'claude-3-haiku-20240307');
  assert.equal(body.max_tokens, 4096);
  assert.equal(body.system, 'SYSTEM');
  assert.equal(body.messages[0].role, 'user');
  assert.match(body.messages[0].content[0].text, /PROMPT/);
});

test('Claude sends image attachments as base64 source blocks', async () => {
  calls.length = 0;
  nextResponse = makeResponse({ content: [{ type: 'text', text: 'ok' }] });
  const ai = new AIClient('claude', 'SK');
  await ai.sendPrompt('s', 'u', null, [{ type: 'image', name: 'i.png', mimeType: 'image/png', base64: 'WFla' }]);
  const body = JSON.parse(calls[0].options.body);
  const img = body.messages[0].content.find(b => b.type === 'image');
  assert.deepEqual(img.source, { type: 'base64', media_type: 'image/png', data: 'WFla' });
});

test('DeepSeek request sends Bearer auth and max_tokens, parses choices', async () => {
  calls.length = 0;
  nextResponse = makeResponse({ choices: [{ message: { content: 'deepseek reply' } }] });
  const ai = new AIClient('deepseek', 'DSKEY', 'deepseek-chat');
  const out = await ai.sendPrompt('SYSTEM', 'PROMPT');
  assert.equal(out, 'deepseek reply');
  const { url, options } = calls[0];
  assert.equal(url, 'https://api.deepseek.com/chat/completions');
  assert.equal(options.headers['Authorization'], 'Bearer DSKEY');
  const body = JSON.parse(options.body);
  assert.equal(body.model, 'deepseek-chat');
  assert.equal(body.max_tokens, 4096, 'DeepSeek must send max_tokens');
  assert.equal(body.messages[0].role, 'system');
  assert.equal(body.messages[0].content, 'SYSTEM');
  assert.equal(body.messages[1].role, 'user');
  assert.match(body.messages[1].content, /PROMPT/);
});

test('DeepSeek notes image attachments by name without sending base64', async () => {
  calls.length = 0;
  nextResponse = makeResponse({ choices: [{ message: { content: 'ok' } }] });
  const ai = new AIClient('deepseek', 'K');
  await ai.sendPrompt('s', 'u', null, [{ type: 'image', name: 'shot.png', base64: 'QUJD' }]);
  const body = JSON.parse(calls[0].options.body);
  assert.match(body.messages[1].content, /shot\.png/);
  assert.ok(!body.messages[1].content.includes('QUJD'), 'base64 must not be sent to DeepSeek');
});

test('AIClient surfaces provider errors with status text', async () => {
  calls.length = 0;
  nextResponse = { ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({ error: { message: 'invalid key' } }) };
  const ai = new AIClient('gemini', 'BAD');
  await assert.rejects(() => ai.sendPrompt('s', 'u'), /invalid key/);
});

test('AIClient timeout aborts and reports a friendly message', async () => {
  calls.length = 0;
  // fetch that never resolves -> AbortController fires at timeoutMs.
  // Drive _fetchWithTimeout directly with a short timeout so the test is fast.
  globalThis.fetch = async (_url, options) => {
    await new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
    });
  };
  const ai = new AIClient('gemini', 'K');
  await assert.rejects(() => ai._fetchWithTimeout('https://x', { method: 'POST' }, 50), /Waktu tunggu koneksi ke server AI habis/);
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return nextResponse; };
});
