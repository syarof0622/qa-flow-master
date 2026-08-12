import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import path from 'node:path';
import { createServer } from 'node:http';
test('extension boots and core authoring UI is available', async () => {
  const extensionPath = path.resolve('.');
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await page.getByText('PRO v4.3').waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'), 'id');
    await page.locator('#btnLanguageToggle').click();
    await page.getByText('Record', { exact: true }).waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.equal((await page.locator('#tab-btn-builder').innerText()).trim(), 'Steps');
    assert.equal(await page.locator('#manualAction option[value="click"]').innerText(), 'Click Element');
    assert.equal(await page.locator('#btnLanguageToggle svg').count(), 1);
    await page.locator('#btnLanguageToggle').click();
    await page.getByText('Rekam', { exact: true }).waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'), 'id');
    assert.equal((await page.locator('#tab-btn-builder').innerText()).trim(), 'Langkah');
    assert.equal(await page.locator('#manualAction option[value="click"]').innerText(), 'Klik Elemen');
    assert.equal(await page.locator('#manualAction option').count() >= 25, true);
    await page.evaluate(src => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    }), `chrome-extension://${extensionId}/node_modules/axe-core/axe.min.js`);
    const auditPanel = () => page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })));
    assert.deepEqual(await auditPanel(), [], 'Dark mode must pass automated WCAG 2.1 A/AA checks');
    await page.locator('#btnThemeToggle').click();
    await page.waitForTimeout(400);
    assert.deepEqual(await auditPanel(), [], 'Light mode must pass automated WCAG 2.1 A/AA checks');
    await page.locator('#btnThemeToggle').click();
    const suiteCardFits = await page.locator('.bento-suite-card').evaluate(element => element.scrollWidth <= element.clientWidth);
    assert.equal(suiteCardFits, true, 'Suite controls must stay inside the card border');
    await page.setViewportSize({ width: 355, height: 800 });
    const settingsFit = await page.locator('.bento-settings-card').evaluate(element => element.scrollWidth <= element.clientWidth);
    assert.equal(settingsFit, true, 'Compact settings must stay inside the card');
    const settingsHeight = await page.locator('.bento-settings-card').evaluate(element => element.getBoundingClientRect().height);
    assert.equal(settingsHeight <= 46, true, 'Compact settings must remain a single row');
    assert.equal(await page.locator('#stopOnErrorCheck .stop-on-error-icon').count(), 1, 'Stop-on-error control must have a visible flat icon');
    assert.equal(await page.locator('#stopOnErrorCheck').getAttribute('title'), 'Berhenti saat langkah gagal');
    await page.locator('#tab-btn-monitor').click();
    const logToolbarFits = await page.locator('.bento-log-toolbar').evaluate(element => element.scrollWidth <= element.clientWidth);
    assert.equal(logToolbarFits, true, 'Log toolbar controls must stay inside the card at compact widths');
    await page.locator('#tab-btn-builder').click();
    assert.equal((await page.locator('#btnClearStorage').innerText()).trim(), '');
    const state = await page.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, resolve)));
    assert.equal(state.status, 'SUCCESS');
    assert.equal(Array.isArray(state.data.suites), true);
    await page.locator('#btnSuiteSettings').click();
    await page.locator('#qa-suiteName').fill('Expert Regression');
    await page.locator('#qa-owner').fill('QA Team');
    await page.locator('#qa-priority').selectOption('P0');
    await page.locator('#qa-tags').fill('smoke, critical-path');
    await page.locator('#qa-startUrl').fill('https://example.com/login');
    await page.locator('#qa-release').fill('v1.0.0');
    assert.equal(await page.locator('#qa-suiteName').inputValue(), 'Expert Regression');
    assert.equal(await page.locator('#qa-tags').inputValue(), 'smoke, critical-path');
    await page.locator('.qa-entity-form [type="submit"]').click();
    await page.locator('#qaWorkspaceOverlay').waitFor({ state: 'hidden' });
    const configuredState = await page.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, resolve)));
    const configuredSuite = configuredState.data.suites.find(suite => suite.id === configuredState.data.activeSuiteId);
    assert.equal(configuredSuite.name, 'Expert Regression');
    assert.equal(configuredSuite.owner, 'QA Team');
    assert.equal(configuredSuite.priority, 'P0');
    assert.deepEqual(configuredSuite.tags, ['smoke', 'critical-path']);
    await page.locator('#tab-btn-reports').click();
    assert.equal(await page.locator('.qa-readiness-card .bento-card-header > .qa-governance-menu-wrap').count(), 1);
    assert.equal(await page.locator('.qa-readiness-card .bento-card-header > .qa-governance-actions').count(), 0, 'QA actions must not crowd the card header');
    await page.locator('#btnQaGovernanceMenu').click();
    assert.equal(await page.locator('#qaGovernanceMenu [role="menuitem"]').count(), 12);
    assert.match(await page.locator('#qaGovernanceMenu').innerText(), /Persyaratan/);
    await page.evaluate(() => window.QAI18n.setLanguage('en', false));
    assert.match(await page.locator('#qaGovernanceMenu').innerText(), /Requirements/);
    assert.match(await page.locator('#qaGovernanceMenu').innerText(), /Add defect/);
    assert.equal(await page.evaluate(() => window.QAI18n.t('Halaman siap direkam', 'en')), 'Page ready to record');
    await page.evaluate(() => window.QAI18n.setLanguage('id', false));
    assert.equal(await page.locator('#qaGovernanceMenu [role="menuitem"] svg').count(), 12, 'Governance menu must use consistent flat icons');
    const menuWidth = await page.locator('#qaGovernanceMenu').evaluate(element => element.getBoundingClientRect().width);
    assert.equal(menuWidth <= 155, true, 'Governance menu must remain compact');
    const menuZ = await page.locator('.qa-readiness-card').evaluate(element => Number(getComputedStyle(element).zIndex));
    assert.equal(menuZ >= 40, true, 'Open menu must stay above following report cards');
    assert.equal(await page.locator('#btnQaGovernanceMenu').getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#qaGovernanceMenu').isHidden(), true);
    await page.locator('#tab-btn-builder').click();
    await page.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({
      action: 'UPDATE_STEPS',
      payload: { steps: [{ action: 'fill', selector: '#name', value: 'sss', description: 'Isi nama' }] }
    }, resolve)));
    await page.locator('.step-data-search-toggle').first().click();
    const dataSearch = page.locator('.step-data-search').first();
    await dataSearch.waitFor();
    await dataSearch.fill('nik');
    const nikResult = page.locator('.step-data-result', { hasText: 'Random NIK' });
    await nikResult.waitFor();
    assert.equal(await page.locator('.step-data-result').count(), 1, 'Data search must filter visible results');
    await nikResult.click();
    const updatedState = await page.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, resolve)));
    const activeSuite = updatedState.data.suites.find(suite => suite.id === updatedState.data.activeSuiteId);
    assert.equal(activeSuite.steps[0].value, '{{nik}}', 'Selecting a search result must update the step value');
    await worker.evaluate(() => chrome.runtime.sendMessage({ action: 'EXECUTION_FINISHED', results: { status: 'FAILED', totalSteps: 4, passedSteps: 2, failedSteps: 1, startTime: '2026-01-01T00:00:00.000Z', endTime: '2026-01-01T00:00:02.000Z', stepDetails: [{ stepIndex: 3, status: 'FAILED', error: 'Expected element' }] } }));
    await page.locator('#executionBanner.is-failed').waitFor();
    assert.equal(await page.locator('#bannerText').innerText(), 'Tes gagal');
    assert.match(await page.locator('#bannerDetail').innerText(), /Step 3 gagal · 1 error · 2\.0s/);
    assert.doesNotMatch(await page.locator('#executionBanner').innerText(), /❌|Failed!/);
    await page.locator('#executionBanner').click();
    await page.getByText('Pemeriksa Kegagalan').waitFor();
    assert.match(await page.locator('#qaWorkspaceBody').innerText(), /Elemen yang diharapkan/);
    await page.locator('#qaWorkspaceClose').click();
    await page.locator('#tab-btn-presets').click();
    await page.locator('#btnAddEnvironment').click();
    assert.equal(await page.locator('#bentoModalIcon svg').count(), 1);
    await page.locator('#bentoModalCloseBtn').click();
    await page.locator('#tab-btn-reports').click();
    await page.locator('#btnQaGovernanceMenu').click();
    await page.locator('#btnRequirements').click();
    await page.locator('#qaAddRequirement').click();
    await page.locator('#qa-id').fill('REQ-AUTH-001');
    await page.locator('#qa-title').fill('Pengguna dapat login');
    await page.locator('.qa-entity-form [type="submit"]').click();
    await page.locator('.qa-board-item', { hasText: 'REQ-AUTH-001' }).waitFor();
    await page.locator('#qaWorkspaceClose').click();
    await page.locator('#tab-btn-builder').click();
    await page.locator('.btn-edit-step').first().click();
    await page.locator('.manual-requirement-chip', { hasText: 'REQ-AUTH-001' }).click();
    await page.locator('#manualStepForm [type="submit"]').click();
    const mappedState = await page.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, resolve)));
    const mappedSuite = mappedState.data.suites.find(suite => suite.id === mappedState.data.activeSuiteId);
    assert.deepEqual(mappedSuite.steps[0].requirementIds, ['REQ-AUTH-001']);
    await page.locator('#tab-btn-reports').click();
    await page.locator('#btnQaGovernanceMenu').click();
    await page.locator('#btnAddDefect').click();
    await page.locator('#qa-title').fill('Login gagal');
    await page.locator('#qa-requirementIds').fill('REQ-AUTH-001');
    await page.locator('.qa-entity-form [type="submit"]').click();
    await page.locator('.qa-board-item', { hasText: 'Login gagal' }).waitFor();
    assert.match(await page.locator('.qa-board-item', { hasText: 'Login gagal' }).innerText(), /OPEN/);
  } finally { await context.close(); }
});

test('monitor captures console and failed network events end-to-end', async () => {
  const server = createServer((request, response) => {
    if (request.url === '/asset.js') {
      response.writeHead(200, { 'content-type': 'text/javascript', 'content-length': '24' });
      response.end('window.fixtureReady=true;');
      return;
    }
    if (request.url === '/fail') {
      response.writeHead(422, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ code: 'VALIDATION_ERROR', message: 'QA monitor fixture' }));
      return;
    }
    if (request.url === '/frame') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<!doctype html><button id="frame-action" type="button">Frame action</button>');
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><title>QA monitor fixture</title><main><div id="dead-area">dead</div><div id="tabs" role="tablist"><button id="tab-a" role="tab">A</button><button id="tab-b" role="tab">B</button></div><div id="live-feed" aria-live="polite"></div><video id="live-video" muted></video><iframe title="Live player" src="/frame"></iframe><input id="flag" type="checkbox"><input id="name" data-cy="name-field"><button id="save" type="button"><span id="save-icon">save</span></button></main><script src="/asset.js"></script><script>setInterval(()=>{document.querySelector("#live-feed").textContent=Date.now()},40)</script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const extensionPath = path.resolve('.');
  let context;
  try {
    context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const sidepanel = await context.newPage();
    await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    const target = await context.newPage();
    await target.goto(baseUrl);
    const targetTabId = await sidepanel.evaluate(async targetUrl => (await chrome.tabs.query({})).find(item => item.url === targetUrl)?.id, baseUrl + '/');
    const monitorEnabled = await sidepanel.evaluate(tabId => new Promise(resolve => chrome.runtime.sendMessage({ action: 'ENSURE_MONITOR_INJECTED', payload: { tabId } }, resolve)), targetTabId);
    assert.equal(monitorEnabled.status, 'SUCCESS', 'Monitor must be enabled explicitly');
    await sidepanel.waitForFunction(async () => Boolean((await chrome.runtime.sendMessage({ action: 'GET_STATE' }))?.data?.monitorStatus?.active));
    await target.evaluate(async () => {
      console.error('[QA Flow] Console monitor self-test');
      await fetch('/ok', { headers: { authorization: 'Bearer qa-secret-token' } });
      await fetch('/fail');
    });
    await sidepanel.waitForFunction(async () => {
      const logs = (await chrome.runtime.sendMessage({ action: 'GET_STATE' }))?.data?.logs || [];
      return logs.some(item => item.message.includes('Console monitor self-test'))
        && logs.some(item => item.type === 'network_error' && item.details?.status === 422)
        && logs.some(item => item.type === 'network_request' && item.details?.status === 200)
        && logs.some(item => item.type === 'network_resource' && item.details?.resourceType === 'script');
    }, undefined, { timeout: 8000 });
    const monitorState = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, resolve)));
    const successfulRequest = monitorState.data.logs.find(item => item.type === 'network_request' && item.details?.status === 200);
    assert.ok(successfulRequest, `Expected successful fetch log; got ${JSON.stringify(monitorState.data.logs.map(item => ({ type: item.type, status: item.details?.status, message: item.message })))}`);
    assert.equal(successfulRequest.details.requestHeaders.authorization, '[REDACTED]');
    const failedRequest = monitorState.data.logs.find(item => item.type === 'network_error' && item.details?.status === 422);
    assert.ok(failedRequest, 'Expected failed fetch log');
    assert.equal(failedRequest.details.responseBody, null, 'Response bodies must remain disabled by default');
    const readiness = await sidepanel.evaluate(tabId => new Promise(resolve => chrome.runtime.sendMessage({ action: 'ENSURE_MONITOR_INJECTED', payload: { tabId } }, resolve)), targetTabId);
    assert.equal(readiness.ready, true, 'Recorder readiness must use a live content-script handshake');
    assert.equal(readiness.recorder.live, true, 'Recorder must detect streaming media and live regions');
    assert.equal(readiness.recorder.liveSignals.media, true);
    assert.equal(readiness.recorder.liveSignals.liveRegion, true);
    const liveWaitResult = await sidepanel.evaluate(tabId => new Promise(resolve => chrome.tabs.sendMessage(tabId, { action: 'EXECUTE_STEP', step: { action: 'click', selector: '#tab-b', timeout: 5000, smart: { autoWait: 'dom' } }, stepIndex: 1 }, resolve)), targetTabId);
    assert.equal(liveWaitResult.success, true);
    assert.equal(liveWaitResult.duration < 1400, true, 'Continuous live mutations must not block adaptive wait');
    const recordingStarted = await sidepanel.evaluate(tabId => new Promise(resolve => chrome.runtime.sendMessage({ action: 'START_RECORDING', payload: { tabId } }, resolve)), targetTabId);
    assert.equal(recordingStarted.status, 'SUCCESS');
    await target.locator('#dead-area').click();
    await target.locator('#tab-a').click();
    await target.locator('#tab-b').click();
    await target.locator('#flag').click();
    await target.locator('#flag').click();
    await target.locator('#name').fill('Syarofuddin');
    await target.waitForTimeout(600);
    await target.locator('#save-icon').click();
    await target.frameLocator('iframe[title="Live player"]').locator('#frame-action').click();
    const recordingStopped = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'STOP_RECORDING' }, resolve)));
    assert.equal(recordingStopped.status, 'SUCCESS');
    assert.equal(recordingStopped.recording.stepCount, 4, 'Smart recorder summary must include final intent from the main page and child frames');
    await target.evaluate(() => console.error('[QA Flow] monitor must be stopped'));
    await target.waitForTimeout(250);
    const recordedState = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, resolve)));
    assert.equal(recordedState.data.monitorStatus.active, false, 'Stopping recording must disable the monitor');
    assert.equal(recordedState.data.logs.some(item => item.message.includes('monitor must be stopped')), false, 'Disabled monitor must not retain new page activity');
    const recordedSuite = recordedState.data.suites.find(suite => suite.id === recordedState.data.activeSuiteId);
    const recordedFill = recordedSuite.steps.filter(step => step.action === 'fill' && step.selector === '[data-cy="name-field"]');
    assert.equal(recordedFill.length, 1, 'Debounced input and stop flush must not create duplicate fill steps');
    assert.equal(recordedFill[0].value, 'Syarofuddin');
    assert.equal(recordedFill[0].smart.autoWait, 'dom');
    assert.equal(recordedFill[0].smart.assertionSuggestion.action, 'assert_value');
    assert.equal(recordedFill[0].smart.confidence > 0, true, 'Recorded steps must include confidence scoring');
    assert.equal(recordedSuite.steps.some(step => step.action === 'click' && step.selector === '#save'), true, 'Nested button content must normalize to the button selector');
    assert.equal(recordedSuite.steps.find(step => step.selector === '#save').smart.autoWait, 'network', 'Submit actions must use adaptive network wait');
    assert.equal(recordedSuite.steps.some(step => step.selector === '#dead-area'), false, 'Dead-area clicks must be ignored');
    assert.equal(recordedSuite.steps.some(step => step.selector === '#tab-a'), false, 'A corrected semantic choice must replace the wrong choice');
    assert.equal(recordedSuite.steps.filter(step => step.selector === '#tab-b').length, 1, 'Only the final semantic choice must remain');
    assert.equal(recordedSuite.steps.some(step => step.selector === '#flag'), false, 'A toggle reverted immediately must be removed');
    const frameStep = recordedSuite.steps.find(step => step.selector === '#frame-action');
    assert.equal(frameStep?.frame?.isTop, false, 'Clicks inside a player iframe must preserve frame context');
    assert.equal(frameStep?.frame?.url.endsWith('/frame'), true);
    await sidepanel.locator('#tab-btn-monitor').click();
    const consoleLog = sidepanel.locator('.log-item.console_error', { hasText: 'Console monitor self-test' }).first();
    await consoleLog.waitFor();
    assert.match(await consoleLog.innerText(), /Console Error/);
    assert.doesNotMatch(await consoleLog.innerText(), /CONSOLE_ERROR/);
    assert.equal(await consoleLog.locator('.btn-copy-log-message').count(), 1);
    assert.equal(await consoleLog.locator('.btn-copy-log-json').count(), 1);
    assert.equal(await sidepanel.locator('#btnCopyLogs').isEnabled(), true);
    await sidepanel.locator('.filter-btn[data-filter="NETWORK"]').click();
    const requestLog = sidepanel.locator('.log-item.network_request').first();
    await requestLog.waitFor();
    assert.equal(await requestLog.locator('.btn-copy-log-curl').count(), 1);
    await sidepanel.locator('#tab-btn-builder').click();
    await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'UPDATE_STEPS', payload: { steps: [{ action: 'assert_visible', selector: 'main', breakpoint: true, description: 'Breakpoint fixture' }, { action: 'wait', value: '3000', description: 'Debugger fixture 2' }] } }, resolve)));
    await sidepanel.evaluate(async targetUrl => {
      const tab = (await chrome.tabs.query({})).find(item => item.url === targetUrl);
      void chrome.runtime.sendMessage({ action: 'RUN_TEST_SUITE', payload: { tabId: tab.id, delay: 0, stopOnError: true, autoRetryCount: 0 } });
    }, baseUrl + '/');
    await sidepanel.waitForFunction(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, response => resolve(response?.data?.executionResults?.status === 'RUNNING'))), null, { timeout: 8000 });
    await sidepanel.locator('#executionBanner.is-paused', { hasText: 'Breakpoint' }).waitFor({ timeout: 8000 });
    const breakpointResume = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'RESUME_EXECUTION' }, resolve)));
    assert.equal(breakpointResume.status, 'SUCCESS');
    await sidepanel.waitForFunction(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, response => resolve((response?.data?.selectorHealingHistory || []).some(item => item.selector === 'main' && item.score >= 0)))), null, { timeout: 8000 });
    const paused = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'PAUSE_EXECUTION' }, resolve)));
    assert.equal(paused.status, 'SUCCESS');
    assert.equal(paused.paused, true);
    const resumed = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'RESUME_EXECUTION' }, resolve)));
    assert.equal(resumed.status, 'SUCCESS');
    const stopped = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'STOP_EXECUTION' }, resolve)));
    assert.equal(stopped.status, 'SUCCESS');
    await sidepanel.waitForFunction(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, response => resolve(response?.data?.executionResults?.status === 'CANCELLED'))));
  } finally {
    await context?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('ai copilot generates and renders steps from a mocked provider response', async () => {
  const extensionPath = path.resolve('.');
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await page.getByText('PRO v4.3').waitFor();

    // Stub the AI key (real key never needed) and mock the provider fetch so the
    // send flow is fully exercised in CI without hitting a live AI API.
    await page.evaluate(() => chrome.storage.local.set({
      qa_ai_settings: { provider: 'gemini', model: 'gemini-2.0-flash', apiKey: 'TEST_KEY' }
    }));
    await page.evaluate(() => {
      window.fetch = async (url) => {
        const reply = 'Berikut skenario ujinya:\n[{"action":"click","selector":"#login","description":"Klik login"},{"action":"fill","selector":"input[type=password]","value":"secret","description":"Isi password"}]';
        if (String(url).includes('generativelanguage')) {
          return { ok: true, status: 200, statusText: 'OK', json: async () => ({ candidates: [{ content: { parts: [{ text: reply }] } }] }) };
        }
        return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) };
      };
    });

    await page.locator('#tab-btn-copilot').click();
    await page.locator('#copilotInput').fill('Buatkan skenario test login');
    await page.locator('#btnSendCopilot').click();

    // User message + generated step card with the three action buttons.
    await page.locator('.copilot-action-group').waitFor({ timeout: 15000 });
    await page.getByText('2 Langkah Tes Di-generate').waitFor();
    assert.equal(await page.locator('.copilot-step-item').count(), 2);
    assert.equal(await page.locator('.copilot-action-btn').count(), 3);
    const btnTexts = await page.locator('.copilot-action-btn span').allInnerTexts();
    assert.deepEqual(btnTexts.sort(), ['Jalankan Saja', 'Simpan & Jalankan', 'Simpan ke Steps'].sort());
    // Send button must re-enable after generation.
    assert.equal(await page.locator('#btnSendCopilot').isEnabled(), true);
  } finally { await context.close(); }
});

test('ai sharing agent drives the live page and produces steps', async () => {
  const server = createServer((request, response) => {
    if (request.url === '/login') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<!doctype html><title>Login</title><form id="loginForm"><input id="email" name="email" placeholder="Email"><input id="password" type="password" placeholder="Password"><button id="submit" type="submit">Masuk</button></form>');
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html' });
    // A REAL navigation link: clicking it moves to /login, which exercises the
    // agent's bridge re-injection after navigation.
    response.end('<!doctype html><title>Agent Fixture</title><a id="login-link" href="/login">Login</a>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const extensionPath = path.resolve('.');
  let context;
  try {
    context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const sidepanel = await context.newPage();
    await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    const target = await context.newPage();
    await target.goto(baseUrl + '/');
    await target.bringToFront();

    // Enable agent mode + stateful mocked AI: first answer = click, second = done.
    await sidepanel.evaluate(() => chrome.storage.local.set({
      qa_agent_settings: { enabled: true },
      qa_ai_settings: { provider: 'gemini', model: 'gemini-2.0-flash', apiKey: 'TEST_KEY' }
    }));
    await sidepanel.evaluate(() => {
      let calls = 0;
      window.fetch = async (url) => {
        if (!String(url).includes('generativelanguage')) return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) };
        calls += 1;
        const reply = calls === 1
          ? '{"tool":"click","selector":"#login-link","description":"Buka halaman login"}'
          : '{"tool":"done","summary":"Skenario login selesai","steps":[{"action":"click","selector":"#login-link","description":"Buka halaman login"},{"action":"fill","selector":"#email","value":"test@example.com","description":"Isi email"},{"action":"fill","selector":"#password","value":"Password123!","description":"Isi password"}]}';
        return { ok: true, status: 200, statusText: 'OK', json: async () => ({ candidates: [{ content: { parts: [{ text: reply }] } }] }) };
      };
    });

    // Use DOM-level clicks (page.evaluate) so the sidepanel tab never steals
    // browser focus — the agent's getActiveTab() must see the target page, not
    // the chrome-extension:// sidepanel tab.
    await sidepanel.evaluate(() => document.getElementById('tab-btn-copilot').click());
    await target.bringToFront();
    await sidepanel.evaluate(() => {
      document.getElementById('copilotInput').value = 'Buatkan test case login';
      document.getElementById('btnSendCopilot').click();
    });

    // The agent must click the login button (navigating to /login), then hand
    // over the steps. Waiting on the step card proves the whole loop finished.
    await sidepanel.locator('.copilot-action-group').waitFor({ timeout: 25000 });
    await sidepanel.getByText('3 Langkah Tes Di-generate').waitFor();
    assert.equal(await sidepanel.locator('.copilot-step-item').count(), 3);
    // The live page must have navigated to /login (the agent's click worked).
    await target.waitForURL(/\/login$/, { timeout: 10000 });
    await target.locator('#email').waitFor({ state: 'visible', timeout: 8000 });
    assert.equal(await sidepanel.locator('#btnSendCopilot').isEnabled(), true);
    // The agent's activity log must be visible in the chat (what it did on-page).
    await sidepanel.locator('.agent-activity').waitFor();
    assert.match(await sidepanel.locator('.agent-activity').innerText(), /click|#login-link/);
    // Cleanup: disable agent mode for other tests.
    await sidepanel.evaluate(() => chrome.storage.local.set({ qa_agent_settings: { enabled: false } }));
  } finally {
    await context?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('ai sharing agent asks confirmation before destructive clicks and skips on deny', async () => {
  const server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    // A destructive button + a safe login link. Clicking the destructive button
    // sets a global so we can verify the agent never actually clicked it.
    response.end('<!doctype html><title>Agent Destructive Fixture</title><button id="delete-btn" type="button" onclick="window.__deleteClicked=true">Hapus Akun</button><a id="login-link" href="/login">Login</a>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const extensionPath = path.resolve('.');
  let context;
  try {
    context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const sidepanel = await context.newPage();
    await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    const target = await context.newPage();
    await target.goto(baseUrl + '/');
    await target.bringToFront();

    await sidepanel.evaluate(() => chrome.storage.local.set({
      qa_agent_settings: { enabled: true },
      qa_ai_settings: { provider: 'gemini', model: 'gemini-2.0-flash', apiKey: 'TEST_KEY' }
    }));
    // Mock AI: first asks to click the destructive button, then finishes.
    await sidepanel.evaluate(() => {
      let calls = 0;
      window.fetch = async (url) => {
        if (!String(url).includes('generativelanguage')) return { ok: false, status: 404, statusText: 'nf', json: async () => ({}) };
        calls += 1;
        const reply = calls === 1
          ? '{"tool":"click","selector":"#delete-btn","description":"Hapus akun"}'
          : '{"tool":"done","summary":"Selesai","steps":[{"action":"click","selector":"#login-link","description":"Buka login"},{"action":"assert_url","value":"/login","description":"Cek URL"}]}';
        return { ok: true, status: 200, statusText: 'OK', json: async () => ({ candidates: [{ content: { parts: [{ text: reply }] } }] }) };
      };
    });

    await sidepanel.evaluate(() => document.getElementById('tab-btn-copilot').click());
    await target.bringToFront();
    await sidepanel.evaluate(() => {
      document.getElementById('copilotInput').value = 'Buatkan test case';
      document.getElementById('btnSendCopilot').click();
    });

    // The destructive click must trigger the confirmation modal.
    await sidepanel.locator('#bentoModalConfirmBtn').waitFor({ timeout: 25000 });
    assert.match(await sidepanel.locator('#bentoModalMessage').innerText(), /Hapus Akun/);
    // User denies -> agent must skip the click.
    await sidepanel.locator('#bentoModalCancelBtn').click();

    // Agent finishes with the step card and records the skipped action.
    await sidepanel.locator('.copilot-action-group').waitFor({ timeout: 25000 });
    await sidepanel.getByText('2 Langkah Tes Di-generate').waitFor();
    assert.match(await sidepanel.locator('.agent-activity').innerText(), /dilewati/);
    // The destructive button must NOT have been clicked.
    const clicked = await target.evaluate(() => window.__deleteClicked === true);
    assert.equal(clicked, false, 'Agent must not click a destructive element after user denial');
    await sidepanel.evaluate(() => chrome.storage.local.set({ qa_agent_settings: { enabled: false } }));
  } finally {
    await context?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('ai sharing agent can be cancelled from the chat mid-run', async () => {
  const server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><title>Cancel Fixture</title><a id="login-link" href="/login">Login</a>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const extensionPath = path.resolve('.');
  let context;
  try {
    context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const sidepanel = await context.newPage();
    await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    const target = await context.newPage();
    await target.goto(baseUrl + '/');
    await target.bringToFront();

    await sidepanel.evaluate(() => chrome.storage.local.set({
      qa_agent_settings: { enabled: true },
      qa_ai_settings: { provider: 'gemini', model: 'gemini-2.0-flash', apiKey: 'TEST_KEY' }
    }));
    // Mock AI that keeps waiting for a while, so the test has time to cancel.
    await sidepanel.evaluate(() => {
      let calls = 0;
      window.fetch = async (url) => {
        if (!String(url).includes('generativelanguage')) return { ok: false, status: 404, statusText: 'nf', json: async () => ({}) };
        calls += 1;
        const reply = calls <= 10
          ? '{"tool":"wait","ms":800}'
          : '{"tool":"done","summary":"Selesai","steps":[{"action":"click","selector":"#x","description":"X"}]}';
        return { ok: true, status: 200, statusText: 'OK', json: async () => ({ candidates: [{ content: { parts: [{ text: reply }] } }] }) };
      };
    });

    await sidepanel.evaluate(() => document.getElementById('tab-btn-copilot').click());
    await target.bringToFront();
    await sidepanel.evaluate(() => {
      document.getElementById('copilotInput').value = 'Buatkan test case';
      document.getElementById('btnSendCopilot').click();
    });

    // Cancel button must appear while the agent runs.
    await sidepanel.locator('.copilot-cancel-btn').waitFor({ timeout: 15000 });
    await sidepanel.locator('.copilot-cancel-btn').click();

    // Agent must stop early with a cancellation message, not a step card.
    await sidepanel.getByText('AI Agent dibatalkan oleh pengguna.').waitFor({ timeout: 10000 });
    assert.equal(await sidepanel.locator('.copilot-action-group').count(), 0, 'No step card after cancel');
    assert.equal(await sidepanel.locator('#btnSendCopilot').isEnabled(), true);
    await sidepanel.evaluate(() => chrome.storage.local.set({ qa_agent_settings: { enabled: false } }));
  } finally {
    await context?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
