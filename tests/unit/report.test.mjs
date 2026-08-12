import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../../report-template.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} }, Intl, Date };
vm.runInNewContext(source, sandbox);
const report = sandbox.module.exports;

test('report escapes unsafe data and includes evidence sections', () => {
  const html = report.generateHTML({ status: 'FAILED', totalSteps: 1, failedSteps: 1, stepDetails: [{ stepIndex: 1, action: 'assert_text', selector: '<script>', status: 'FAILED', error: '<img onerror=alert(1)>', executionTimeMs: 20 }] }, [], [{ type: 'network_request', timestamp: new Date().toISOString(), details: { method: 'GET', status: 200, url: 'https://example.com/api', durationMs: 12, responseSize: 256 } }], 'https://example.com/?q=<script>', { suiteName: 'Security <Smoke>', environmentName: 'Staging' });
  assert.match(html, /Execution details/);
  assert.match(html, /Runtime issues/);
  assert.match(html, /Network activity/);
  assert.match(html, /example\.com\/api/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img onerror/);
});

test('report never marks an unexecuted suite as passed', () => {
  const html = report.generateHTML({ status: 'IDLE' }, [{ action: 'click' }]);
  assert.match(html, /NOT RUN/);
  assert.doesNotMatch(html, /class="verdict passed"/);
});
