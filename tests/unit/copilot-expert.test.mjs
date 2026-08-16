import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNegativeTestPrompt, buildNetworkMockPrompt, healSelector, buildBugReportDraft } from '../../sidepanel/copilot-expert.js';

test('buildNegativeTestPrompt builds edge-case prompt instructions', () => {
  const domRes = {
    formSummary: 'Form #loginForm dengan input username & password',
    interactiveSummary: 'input[name="username"], input[name="password"]'
  };
  const prompt = buildNegativeTestPrompt(domRes, 'Uji form login');
  assert.match(prompt, /NEGATIVE & EDGE-CASE TESTING/);
  assert.match(prompt, /Form #loginForm/);
  assert.match(prompt, /input\[name="username"\]/);
  assert.match(prompt, /Uji form login/);
  assert.match(prompt, /Boundary Value Testing/);
});

test('buildNetworkMockPrompt formats network log error details & Playwright page.route instructions', () => {
  const logs = [
    { type: 'network_error', details: { url: 'https://api.example.com/v1/auth' } },
    { type: 'console_error', message: 'Failed to fetch resource 500' }
  ];
  const prompt = buildNetworkMockPrompt(logs, 'Mock endpoint auth');
  assert.match(prompt, /NETWORK MOCKING & API CONTRACT TESTING/);
  assert.match(prompt, /api\.example\.com\/v1\/auth/);
  assert.match(prompt, /page\.route/);
});

test('healSelector heals dynamic & fragile CSS selectors to resilient locators', () => {
  // Test data-testid fallback
  const testIdResult = healSelector('#dynamic-btn', { testId: 'submit-login-btn' });
  assert.equal(testIdResult.healedSelector, '[data-testid="submit-login-btn"]');
  assert.equal(testIdResult.strategy, 'data-testid');

  // Test ARIA role fallback
  const roleResult = healSelector('#random-1234', { tagName: 'BUTTON', textContent: 'Submit Login' });
  assert.equal(roleResult.healedSelector, 'role=button[name="Submit Login"]');
  assert.equal(roleResult.strategy, 'aria-role');

  // Test placeholder fallback
  const phResult = healSelector('#input-8472', { placeholder: 'Masukkan Email Anda' });
  assert.equal(phResult.healedSelector, '[placeholder="Masukkan Email Anda"]');
  assert.equal(phResult.strategy, 'placeholder');

  // Test original fallback
  const origResult = healSelector('#staticInput', {});
  assert.equal(origResult.healedSelector, '#staticInput');
  assert.equal(origResult.strategy, 'original');
});

test('buildBugReportDraft creates structured Markdown Jira issue ticket', () => {
  const failedInfo = {
    title: 'Gagal klik tombol submit login',
    pageUrl: 'https://app.example.com/login',
    errorMsg: 'Element #submit is not visible after 5000ms',
    suiteName: 'Regression Login Suite',
    step: { action: 'click', selector: '#submit', description: 'Klik Submit' }
  };
  const logs = [
    { type: 'console_error', message: 'Uncaught TypeError: Cannot read properties of null' }
  ];

  const draft = buildBugReportDraft(failedInfo, logs);
  assert.match(draft, /🐞 Gagal klik tombol submit login/);
  assert.match(draft, /Regression Login Suite/);
  assert.match(draft, /https:\/\/app\.example\.com\/login/);
  assert.match(draft, /Element #submit is not visible after 5000ms/);
  assert.match(draft, /Uncaught TypeError/);
  assert.match(draft, /Steps to Reproduce/);
});

test('buildBugReportDraft uses explicit severity/expected/actual when the caller (AI Agent) provides them', () => {
  const draft = buildBugReportDraft({
    title: 'Submit gagal karena API 500',
    pageUrl: 'https://toefl.example.my.id/register',
    errorMsg: 'POST /api/register responded 500',
    severity: 'CRITICAL',
    expected: 'Akun berhasil dibuat dan redirect ke dashboard',
    actual: 'Halaman menampilkan error generik, tidak ada redirect',
    step: { action: 'click', selector: 'button[type=submit]', description: 'Klik Daftar' }
  });
  assert.match(draft, /\*\*CRITICAL\*\*/);
  assert.match(draft, /Akun berhasil dibuat dan redirect ke dashboard/);
  assert.match(draft, /Halaman menampilkan error generik/);
});

test('buildBugReportDraft falls back to generic severity/expected/actual when omitted', () => {
  const draft = buildBugReportDraft({ title: 'X', pageUrl: 'https://x.test', errorMsg: 'err' });
  assert.match(draft, /HIGH \/ CRITICAL/);
  assert.match(draft, /Elemen berhasil diinteraksi dan assertion bernilai valid\./);
});
