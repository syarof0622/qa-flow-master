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
    await page.getByText('PRO v4.4').waitFor();
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
    await page.getByText('PRO v4.4').waitFor();

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
    assert.deepEqual(btnTexts.sort(), ['Jalankan', 'Simpan & Jalankan', 'Simpan'].sort());
    // Send button must re-enable after generation.
    assert.equal(await page.locator('#btnSendCopilot').isEnabled(), true);
  } finally { await context.close(); }
});

test('plan mode discusses first and only generates steps after explicit confirmation', async () => {
  const extensionPath = path.resolve('.');
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await page.getByText('PRO v4.4').waitFor();

    await page.evaluate(() => chrome.storage.local.set({
      qa_ai_settings: { provider: 'gemini', model: 'gemini-2.0-flash', apiKey: 'TEST_KEY' }
    }));
    // Stateful mock: first turn (the planning discussion) returns pure prose
    // with no JSON array; only the second turn (after confirmation) returns
    // the actual step JSON - exactly mirroring what Plan Mode is meant to gate.
    await page.evaluate(() => {
      let calls = 0;
      window.fetch = async (url) => {
        if (!String(url).includes('generativelanguage')) return { ok: false, status: 404, statusText: 'nf', json: async () => ({}) };
        calls += 1;
        const reply = calls === 1
          ? 'Saya paham Anda ingin menguji alur login.\n\n**Rencana:**\n1. Buka halaman login\n2. Isi username dan password valid\n3. Klik tombol login\n\nLanjutkan dengan rencana ini, atau ada yang perlu disesuaikan?'
          : 'Berikut skenario ujinya:\n[{"action":"click","selector":"#login","description":"Klik login"},{"action":"fill","selector":"input[type=password]","value":"secret","description":"Isi password"}]';
        return { ok: true, status: 200, statusText: 'OK', json: async () => ({ candidates: [{ content: { parts: [{ text: reply }] } }] }) };
      };
    });

    await page.locator('#tab-btn-copilot').click();
    // The checkbox itself is visually hidden by the custom toggle-switch CSS
    // (a sibling span renders the visible track/thumb) - same reason the
    // agent-mode tests set chrome.storage.local directly instead of clicking
    // the input. window.QAFlow.isPlanModeEnabled reads this same key fresh
    // on every send, so this is equivalent to a real toggle flip.
    await page.evaluate(() => chrome.storage.local.set({ qa_plan_mode_settings: { enabled: true } }));

    // Turn 1: request a test case with Plan Mode on - must get a PLAN, not a step card.
    await page.locator('#copilotInput').fill('Buatkan test case login');
    await page.locator('#btnSendCopilot').click();
    await page.getByText('Lanjutkan dengan rencana ini').waitFor({ timeout: 15000 });
    assert.equal(await page.locator('.copilot-action-group').count(), 0, 'Plan turn must not render a step card');
    assert.equal(await page.locator('#btnSendCopilot').isEnabled(), true);
    // The pending plan must be persisted so a later reload/session still knows
    // it is awaiting confirmation, not silently treated as a finished answer.
    const storedPending = await page.evaluate(() => new Promise(resolve => chrome.storage.local.get('qa_copilot_threads', res => {
      const threads = res.qa_copilot_threads || [];
      resolve(threads[0]?.messages?.at(-1)?.planPending === true);
    })));
    assert.equal(storedPending, true);

    // Turn 2: confirm the plan - NOW it must actually generate the test case.
    await page.locator('#copilotInput').fill('Ya, lanjutkan');
    await page.locator('#btnSendCopilot').click();
    await page.locator('.copilot-action-group').waitFor({ timeout: 15000 });
    await page.getByText('2 Langkah Tes Di-generate').waitFor();
    assert.equal(await page.locator('.copilot-step-item').count(), 2);
    assert.equal(await page.locator('#btnSendCopilot').isEnabled(), true);
  } finally { await context.close(); }
});

test('copilot chat does not lose a message when a background state refresh races a reply', async () => {
  const extensionPath = path.resolve('.');
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await page.getByText('PRO v4.4').waitFor();

    await page.evaluate(() => chrome.storage.local.set({
      qa_ai_settings: { provider: 'gemini', model: 'gemini-2.0-flash', apiKey: 'TEST_KEY' }
    }));

    // Turn 1 resolves immediately; turn 2's fetch is held open until the test
    // explicitly releases it, so an unrelated background broadcast can be
    // injected mid-flight - reproducing the reported bug where a second
    // message vanished once the agent replied.
    await page.evaluate(() => {
      let calls = 0;
      window.__releaseSecondReply = null;
      window.fetch = async (url) => {
        if (!String(url).includes('generativelanguage')) return { ok: false, status: 404, statusText: 'nf', json: async () => ({}) };
        calls += 1;
        if (calls === 1) {
          return { ok: true, status: 200, statusText: 'OK', json: async () => ({ candidates: [{ content: { parts: [{ text: 'Halo! Ada yang bisa saya bantu?' }] } }] }) };
        }
        await new Promise(resolve => { window.__releaseSecondReply = resolve; });
        return { ok: true, status: 200, statusText: 'OK', json: async () => ({ candidates: [{ content: { parts: [{ text: 'Baik, ini jawaban kedua saya.' }] } }] }) };
      };
    });

    await page.locator('#tab-btn-copilot').click();
    await page.locator('#copilotInput').fill('Halo');
    await page.locator('#btnSendCopilot').click();
    await page.getByText('Ada yang bisa saya bantu').waitFor({ timeout: 15000 });

    // Second message: send, then - while its reply is deliberately held back -
    // fire a genuine unrelated background action (saving a dataset). Saving
    // anything broadcasts STATE_CHANGED to the sidepanel, which used to
    // re-fetch and replace the in-memory thread array mid-generation.
    await page.locator('#copilotInput').fill('Ini pesan kedua saya');
    await page.locator('#btnSendCopilot').click();
    await page.waitForFunction(() => typeof window.__releaseSecondReply === 'function', null, { timeout: 15000 });
    await page.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({
      action: 'SAVE_DATASET',
      payload: { dataset: { name: 'Unrelated Background Action', rows: [{ x: 1 }] } }
    }, resolve)));
    // Give the STATE_CHANGED broadcast time to actually reach and be handled
    // by the sidepanel's message listener before releasing the held reply.
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__releaseSecondReply());
    await page.getByText('Baik, ini jawaban kedua saya').waitFor({ timeout: 15000 });

    // Both user messages must still be visible in the chat, in order. Checking
    // the innermost bubble text (rather than a bare getByText) avoids matching
    // the same string on nested wrapper elements too.
    const userBubbles = await page.locator('.copilot-msg.user .msg-bubble').allTextContents();
    assert.deepEqual(userBubbles, ['Halo', 'Ini pesan kedua saya'], 'Both user messages must remain visible, in order');

    // ...and all four messages must be persisted, not rendered from a stale copy.
    const stored = await page.evaluate(() => new Promise(resolve => chrome.storage.local.get('qa_copilot_threads', res => resolve(res.qa_copilot_threads || []))));
    const messages = stored[0]?.messages || [];
    assert.equal(messages.length, 4, 'Both user messages and both replies must be persisted');
    assert.equal(messages.filter(m => m.sender === 'user').length, 2);
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
    // The sidepanel's own async init (settings/threads fetch) attaches the tab
    // click listeners after the page's 'load' event fires, not before it -
    // clicking a tab immediately after goto() races that init and can silently
    // no-op (the click lands before any listener exists). Wait for a rendered
    // marker that only appears once init has actually completed, matching the
    // pattern the "ai copilot generates..." test already uses below.
    await sidepanel.getByText('PRO v4.4').waitFor();
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
    // The agent's activity log is intentionally not rendered in the chat UI
    // (appendAgentActivity's call site is commented out - "Di-disable agar
    // tidak muncul di chat") but it must still be captured on the stored
    // thread message, so it survives reloads and stays available for support.
    const storedActivity = await sidepanel.evaluate(() => new Promise(resolve => {
      chrome.storage.local.get('qa_copilot_threads', res => {
        const threads = res.qa_copilot_threads || [];
        const lastMsg = threads[0]?.messages?.at(-1);
        resolve(lastMsg?.activity || null);
      });
    }));
    assert.ok(Array.isArray(storedActivity) && storedActivity.some(h => /click|#login-link/.test(String(h))), 'agent activity history must be captured on the stored message');
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
    // See the comment in the test above: wait for the app to actually finish
    // its async init before clicking any tab, or the click can race a
    // not-yet-attached listener and silently no-op.
    await sidepanel.getByText('PRO v4.4').waitFor();
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
    // The activity log is intentionally not rendered in the chat UI (see the
    // comment in the test above) but must still be captured on the stored
    // thread message.
    const storedActivity = await sidepanel.evaluate(() => new Promise(resolve => {
      chrome.storage.local.get('qa_copilot_threads', res => {
        const threads = res.qa_copilot_threads || [];
        const lastMsg = threads[0]?.messages?.at(-1);
        resolve(lastMsg?.activity || null);
      });
    }));
    assert.ok(Array.isArray(storedActivity) && storedActivity.some(h => /dilewati/.test(String(h))), 'skip must be captured on the stored message');
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
    // See the comment in the earlier agent tests: wait for the app to finish
    // its async init before clicking any tab, or the click can race a
    // not-yet-attached listener and silently no-op.
    await sidepanel.getByText('PRO v4.4').waitFor();
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

test('authoring steps and running a suite completes with passing results', async () => {
  const server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><title>Run Fixture</title><input id="name" name="name"><button id="save" type="button" onclick="document.getElementById(\'result\').textContent=\'Saved: \'+document.getElementById(\'name\').value">Save</button><div id="result"></div>');
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
    const targetTabId = await sidepanel.evaluate(async url => (await chrome.tabs.query({})).find(item => item.url === url)?.id, baseUrl + '/');

    // Author three steps into the active suite.
    const authored = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({
      action: 'UPDATE_STEPS',
      payload: { steps: [
        { action: 'fill', selector: '#name', value: 'Budi', description: 'Isi nama' },
        { action: 'click', selector: '#save', description: 'Klik simpan' },
        { action: 'assert_text', selector: '#result', value: 'Saved: Budi', description: 'Cek hasil' }
      ] }
    }, resolve)));
    assert.equal(authored.status, 'SUCCESS');

    // Run the suite against the live tab.
    const run = await sidepanel.evaluate(tabId => new Promise(resolve => chrome.runtime.sendMessage({
      action: 'RUN_TEST_SUITE',
      payload: { tabId, delay: 0, stopOnError: true, autoRetryCount: 0, scope: {} }
    }, resolve)), targetTabId);
    assert.equal(run.status, 'SUCCESS');

    // Wait for completion and assert all steps passed.
    await sidepanel.waitForFunction(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, response => resolve(response?.data?.executionResults?.status === 'COMPLETED'))), null, { timeout: 20000 });
    const results = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, response => resolve(response?.data?.executionResults))));
    assert.equal(results.status, 'COMPLETED');
    assert.equal(results.totalSteps, 3);
    assert.equal(results.failedSteps, 0);
    assert.equal(results.passedSteps, 3);
    // The live page must reflect the executed steps.
    assert.equal(await target.locator('#result').innerText(), 'Saved: Budi');
    // No failure banner.
    assert.equal(await sidepanel.locator('#executionBanner.is-failed').count(), 0);
  } finally {
    await context?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('go_back action navigates using real chrome.tabs history, not a page-JS call', async () => {
  const server = createServer((request, response) => {
    if (request.url === '/away-page') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<!doctype html><title>Away</title><h1>Away Page</h1>');
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><title>Start</title><a id="next-link" href="/away-page">Go</a>');
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
    await target.goto(baseUrl + '/start-page');
    await target.bringToFront();
    const targetTabId = await sidepanel.evaluate(async url => (await chrome.tabs.query({})).find(item => item.url === url)?.id, baseUrl + '/start-page');

    // Author: navigate away, go back, then verify the URL really is back.
    const authored = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({
      action: 'UPDATE_STEPS',
      payload: { steps: [
        { action: 'click', selector: '#next-link', description: 'Klik ke halaman lain' },
        { action: 'go_back', description: 'Kembali ke halaman sebelumnya' },
        { action: 'assert_url', value: '/start-page', description: 'Verifikasi kembali ke halaman awal' }
      ] }
    }, resolve)));
    assert.equal(authored.status, 'SUCCESS');

    const run = await sidepanel.evaluate(tabId => new Promise(resolve => chrome.runtime.sendMessage({
      action: 'RUN_TEST_SUITE',
      payload: { tabId, delay: 200, stopOnError: true, autoRetryCount: 0, scope: {} }
    }, resolve)), targetTabId);
    assert.equal(run.status, 'SUCCESS');

    await sidepanel.waitForFunction(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, response => resolve(['COMPLETED', 'FAILED'].includes(response?.data?.executionResults?.status)))), null, { timeout: 20000 });
    const results = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, response => resolve(response?.data?.executionResults))));
    assert.equal(results.status, 'COMPLETED');
    assert.equal(results.totalSteps, 3);
    assert.equal(results.passedSteps, 3);
    assert.equal(results.failedSteps, 0);
    assert.equal(await sidepanel.locator('#executionBanner.is-failed').count(), 0);
    // Real browser tab navigation must have actually occurred (not a no-op).
    assert.match(target.url(), /\/start-page$/);
  } finally {
    await context?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('bulk data-entry runs every dataset row, keeps going after a row fails, and reports live progress', async () => {
  const server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><title>Bulk Fixture</title><input id="name">' +
      '<button id="save" type="button" onclick="document.getElementById(\'result\').textContent=\'Saved: \'+document.getElementById(\'name\').value">Save</button>' +
      '<div id="result"></div>' +
      '<button id="reset" type="button" onclick="document.getElementById(\'name\').value=\'\';document.getElementById(\'result\').textContent=\'\'">Isi Lagi</button>');
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
    await sidepanel.getByText('PRO v4.4').waitFor();
    const target = await context.newPage();
    await target.goto(baseUrl + '/');
    await target.bringToFront();

    // Author a fill -> submit -> verify -> reopen-form flow using dataset placeholders.
    const authored = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({
      action: 'UPDATE_STEPS',
      payload: { steps: [
        { action: 'fill', selector: '#name', value: '{{name}}', description: 'Isi nama' },
        { action: 'click', selector: '#save', description: 'Klik simpan' },
        { action: 'assert_text', selector: '#result', value: '{{expected}}', description: 'Verifikasi hasil tersimpan' },
        { action: 'click', selector: '#reset', description: 'Buka form lagi untuk baris berikutnya' }
      ] }
    }, resolve)));
    assert.equal(authored.status, 'SUCCESS');

    // 3-row dataset - row 2 is deliberately given a WRONG expectation so the
    // bulk loop is forced to record a failure and must keep going anyway
    // instead of aborting the whole batch (the old Alt-click behavior).
    const saved = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({
      action: 'SAVE_DATASET',
      payload: { dataset: { name: 'Bulk Test Data', rows: [
        { name: 'Baris1', expected: 'Saved: Baris1' },
        { name: 'Baris2', expected: 'Saved: SALAH' },
        { name: 'Baris3', expected: 'Saved: Baris3' }
      ] } }
    }, resolve)));
    assert.equal(saved.status, 'SUCCESS');

    // The sidepanel tab is backgrounded (target.bringToFront() above is what
    // keeps getActiveTab() resolving to the FIXTURE page, not the sidepanel,
    // when the button's click handler runs) - Chromium does not promptly
    // recompute layout for a backgrounded page, so Playwright's own
    // visibility-based waits/clicks (locator.waitFor, locator.click,
    // locator.innerText) are unreliable here even once the state/class is
    // genuinely correct. Poll plain JS predicates and dispatch clicks via
    // evaluate() instead, exactly like the AI Agent tests above do for the
    // same reason - never bring the sidepanel to front, or getActiveTab()
    // would pick it up instead of the fixture page.
    await sidepanel.waitForFunction(() => !document.getElementById('btnRunAllRows')?.classList.contains('hidden'), null, { timeout: 10000 });

    await sidepanel.evaluate(() => document.getElementById('btnRunAllRows').click());
    await sidepanel.waitForFunction(() => !document.getElementById('bentoModalOverlay')?.classList.contains('hidden'), null, { timeout: 10000 });
    const confirmMessage = await sidepanel.evaluate(() => document.getElementById('bentoModalMessage')?.textContent || '');
    assert.match(confirmMessage, /3 baris dataset/);
    await sidepanel.evaluate(() => document.getElementById('bentoModalConfirmBtn').click());

    // Live progress banner must show row-level counters while the batch runs.
    await sidepanel.waitForFunction(() => /Baris \d\/3/.test(document.getElementById('bannerDetail')?.textContent || ''), null, { timeout: 10000 });

    // Final summary alert: must report the batch kept going past row 2's
    // failure and processed all 3 rows, calling out which row failed.
    await sidepanel.waitForFunction(() => /baris gagal/.test(document.getElementById('bentoModalMessage')?.textContent || ''), null, { timeout: 20000 });
    const summaryText = await sidepanel.evaluate(() => document.getElementById('bentoModalMessage')?.textContent || '');
    assert.match(summaryText, /2 baris sukses, 1 baris gagal dari 3 diproses/);
    assert.match(summaryText, /Baris 2/);
    // The summary is now a confirm dialog offering "retry failed rows only" -
    // #bentoModalConfirmBtn means "yes, retry" (which would kick off a SECOND
    // bulk run for row 2 alone). Dismiss via Cancel here to verify the plain
    // finish path; the retry flow itself is covered by a dedicated test below.
    await sidepanel.evaluate(() => document.getElementById('bentoModalCancelBtn').click());

    // The button must be usable again afterwards (not stuck disabled), and the
    // original active dataset row must have been restored.
    await sidepanel.waitForFunction(() => document.getElementById('btnRunAllRows')?.disabled === false, null, { timeout: 10000 });
    // No resume checkpoint should linger after a batch that ran to completion.
    const checkpointAfterFinish = await sidepanel.evaluate(() => new Promise(resolve => chrome.storage.local.get('qa_bulk_run_checkpoint', res => resolve(res?.qa_bulk_run_checkpoint || null))));
    assert.equal(checkpointAfterFinish, null);
  } finally {
    await context?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('bulk data-entry retry-failed-rows re-runs only the specific rows that failed', async () => {
  const server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><title>Retry Fixture</title><input id="name">' +
      '<button id="save" type="button" onclick="document.getElementById(\'result\').textContent=\'Saved: \'+document.getElementById(\'name\').value">Save</button>' +
      '<div id="result"></div>' +
      '<button id="reset" type="button" onclick="document.getElementById(\'name\').value=\'\';document.getElementById(\'result\').textContent=\'\'">Isi Lagi</button>');
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
    await sidepanel.getByText('PRO v4.4').waitFor();
    const target = await context.newPage();
    await target.goto(baseUrl + '/');
    await target.bringToFront();

    const authored = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({
      action: 'UPDATE_STEPS',
      payload: { steps: [
        { action: 'fill', selector: '#name', value: '{{name}}', description: 'Isi nama' },
        { action: 'click', selector: '#save', description: 'Klik simpan' },
        { action: 'assert_text', selector: '#result', value: '{{expected}}', description: 'Verifikasi hasil tersimpan' },
        { action: 'click', selector: '#reset', description: 'Buka form lagi' }
      ] }
    }, resolve)));
    assert.equal(authored.status, 'SUCCESS');

    // Row 2 is deliberately wrong so it fails on the first pass.
    const saved = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({
      action: 'SAVE_DATASET',
      payload: { dataset: { name: 'Retry Test Data', rows: [
        { name: 'Baris1', expected: 'Saved: Baris1' },
        { name: 'Baris2', expected: 'Saved: SALAH' },
        { name: 'Baris3', expected: 'Saved: Baris3' }
      ] } }
    }, resolve)));
    assert.equal(saved.status, 'SUCCESS');

    await sidepanel.waitForFunction(() => !document.getElementById('btnRunAllRows')?.classList.contains('hidden'), null, { timeout: 10000 });
    await sidepanel.evaluate(() => document.getElementById('btnRunAllRows').click());
    await sidepanel.waitForFunction(() => !document.getElementById('bentoModalOverlay')?.classList.contains('hidden'), null, { timeout: 10000 });
    await sidepanel.evaluate(() => document.getElementById('bentoModalConfirmBtn').click());

    // First pass finishes with row 2 failed - click "Retry Failed Rows" this time.
    await sidepanel.waitForFunction(() => /baris gagal/.test(document.getElementById('bentoModalMessage')?.textContent || ''), null, { timeout: 20000 });
    const firstSummary = await sidepanel.evaluate(() => document.getElementById('bentoModalMessage')?.textContent || '');
    assert.match(firstSummary, /2 baris sukses, 1 baris gagal dari 3 diproses/);
    assert.match(await sidepanel.evaluate(() => document.getElementById('bentoModalConfirmBtn')?.textContent || ''), /Coba Ulang|Retry/);
    await sidepanel.evaluate(() => document.getElementById('bentoModalConfirmBtn').click());

    // The retry pass must show its own distinct "retrying" progress state...
    await sidepanel.waitForFunction(() => /Mencoba Ulang Baris Gagal|Retrying Failed Rows/.test(document.getElementById('bannerText')?.textContent || ''), null, { timeout: 10000 });
    // ...and process EXACTLY 1 row (only row 2), not all 3 again - the second
    // summary must report "dari 1 diproses" and still name row 2 (same wrong
    // expectation, so it fails again), proving the retry scoped correctly.
    // Match "dari 1 diproses" specifically (not just /baris gagal/, which the
    // FIRST summary's still-visible text also contains before this updates).
    await sidepanel.waitForFunction(() => /dari 1 diproses/.test(document.getElementById('bentoModalMessage')?.textContent || ''), null, { timeout: 20000 });
    const retrySummary = await sidepanel.evaluate(() => document.getElementById('bentoModalMessage')?.textContent || '');
    assert.match(retrySummary, /0 baris sukses, 1 baris gagal dari 1 diproses/);
    assert.match(retrySummary, /Baris 2/);
    await sidepanel.evaluate(() => document.getElementById('bentoModalCancelBtn').click());

    await sidepanel.waitForFunction(() => document.getElementById('btnRunAllRows')?.disabled === false, null, { timeout: 10000 });
  } finally {
    await context?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('bulk data-entry resumes an interrupted batch instead of redoing already-completed rows', async () => {
  const server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><title>Resume Fixture</title><input id="name">' +
      '<button id="save" type="button" onclick="document.getElementById(\'result\').textContent=\'Saved: \'+document.getElementById(\'name\').value">Save</button>' +
      '<div id="result"></div>' +
      '<button id="reset" type="button" onclick="document.getElementById(\'name\').value=\'\';document.getElementById(\'result\').textContent=\'\'">Isi Lagi</button>');
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
    await sidepanel.getByText('PRO v4.4').waitFor();
    const target = await context.newPage();
    await target.goto(baseUrl + '/');
    await target.bringToFront();

    const authored = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({
      action: 'UPDATE_STEPS',
      payload: { steps: [
        { action: 'fill', selector: '#name', value: '{{name}}', description: 'Isi nama' },
        { action: 'click', selector: '#save', description: 'Klik simpan' },
        { action: 'assert_text', selector: '#result', value: '{{expected}}', description: 'Verifikasi hasil tersimpan' },
        { action: 'click', selector: '#reset', description: 'Buka form lagi' }
      ] }
    }, resolve)));
    assert.equal(authored.status, 'SUCCESS');

    // Row 1's CURRENT data would fail if actually re-executed (expects text
    // that will never appear) - this is the proof that resume genuinely
    // skips it rather than coincidentally reporting success.
    const saved = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({
      action: 'SAVE_DATASET',
      payload: { dataset: { name: 'Resume Test Data', rows: [
        { name: 'Baris1', expected: 'Saved: THIS_WOULD_FAIL_IF_RERUN' },
        { name: 'Baris2', expected: 'Saved: Baris2' },
        { name: 'Baris3', expected: 'Saved: Baris3' }
      ] } }
    }, resolve)));
    assert.equal(saved.status, 'SUCCESS');
    const datasetId = saved.dataset.id;

    // Simulate an earlier run that was interrupted right after row 1 (index 0)
    // completed successfully - e.g. the browser crashed or the tab was closed.
    await sidepanel.evaluate((id) => new Promise(resolve => chrome.storage.local.set({
      qa_bulk_run_checkpoint: { datasetId: id, rowResults: [{ row: 0, status: 'PASSED', failedSteps: 0, error: null }], savedAt: new Date(0).toISOString() }
    }, resolve)), datasetId);

    await sidepanel.waitForFunction(() => !document.getElementById('btnRunAllRows')?.classList.contains('hidden'), null, { timeout: 10000 });
    await sidepanel.evaluate(() => document.getElementById('btnRunAllRows').click());
    // First confirm: "Run all rows?"
    await sidepanel.waitForFunction(() => !document.getElementById('bentoModalOverlay')?.classList.contains('hidden'), null, { timeout: 10000 });
    await sidepanel.evaluate(() => document.getElementById('bentoModalConfirmBtn').click());

    // Second confirm: must be the RESUME prompt, mentioning where it stopped.
    await sidepanel.waitForFunction(() => /1\/3/.test(document.getElementById('bentoModalMessage')?.textContent || ''), null, { timeout: 10000 });
    const resumeMessage = await sidepanel.evaluate(() => document.getElementById('bentoModalMessage')?.textContent || '');
    assert.match(resumeMessage, /Resume Test Data/);
    await sidepanel.evaluate(() => document.getElementById('bentoModalConfirmBtn').click());

    // Must finish with ALL 3 rows accounted for (1 restored + 2 freshly run)
    // and ZERO failures - if row 1 had actually been redone with its current
    // (failing) data, this would show 1 failure instead.
    await sidepanel.waitForFunction(() => /3\/3.*3.*0/.test(document.getElementById('bannerDetail')?.textContent || ''), null, { timeout: 15000 });
    const finalDetail = await sidepanel.evaluate(() => document.getElementById('bannerDetail')?.textContent || '');
    assert.match(finalDetail, /3\/3/);
    assert.doesNotMatch(finalDetail, /[1-9] gagal/);

    // The checkpoint must be cleared now that the batch is fully complete.
    const checkpointAfter = await sidepanel.evaluate(() => new Promise(resolve => chrome.storage.local.get('qa_bulk_run_checkpoint', res => resolve(res?.qa_bulk_run_checkpoint || null))));
    assert.equal(checkpointAfter, null);
  } finally {
    await context?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('bulk data-entry stays correct at real-world scale and keeps continue-on-error semantics', async () => {
  const server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><title>Scale Fixture</title><input id="name">' +
      '<button id="save" type="button" onclick="document.getElementById(\'result\').textContent=\'Saved: \'+document.getElementById(\'name\').value">Save</button>' +
      '<div id="result"></div>' +
      '<button id="reset" type="button" onclick="document.getElementById(\'name\').value=\'\';document.getElementById(\'result\').textContent=\'\'">Isi Lagi</button>');
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
    await sidepanel.getByText('PRO v4.4').waitFor();
    const target = await context.newPage();
    await target.goto(baseUrl + '/');
    await target.bringToFront();

    const authored = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({
      action: 'UPDATE_STEPS',
      payload: { steps: [
        { action: 'fill', selector: '#name', value: '{{name}}', description: 'Isi nama' },
        { action: 'click', selector: '#save', description: 'Klik simpan' },
        { action: 'assert_text', selector: '#result', value: '{{expected}}', description: 'Verifikasi hasil tersimpan' },
        { action: 'click', selector: '#reset', description: 'Buka form lagi untuk baris berikutnya' }
      ] }
    }, resolve)));
    assert.equal(authored.status, 'SUCCESS');

    // 40 rows is an order of magnitude past the toy 3-row case above - large
    // enough to prove continue-on-error and progress reporting hold up past a
    // handful of rows, with 2 deliberate failures scattered through the batch
    // (not just at the edges) to prove the whole run is scanned, not just the
    // first/last row.
    const ROW_COUNT = 40;
    const FAILING_INDICES = [9, 29]; // 0-based -> displayed as "Baris 10" / "Baris 30"
    const rows = Array.from({ length: ROW_COUNT }, (_, i) => ({
      name: `Baris${i + 1}`,
      expected: FAILING_INDICES.includes(i) ? 'Saved: SALAH' : `Saved: Baris${i + 1}`
    }));
    const saved = await sidepanel.evaluate((rows) => new Promise(resolve => chrome.runtime.sendMessage({
      action: 'SAVE_DATASET',
      payload: { dataset: { name: 'Bulk Scale Data', rows } }
    }, resolve)), rows);
    assert.equal(saved.status, 'SUCCESS');

    // Speed up the per-step delay for this larger batch - a real user running
    // hundreds of rows would do the same. Correctness must hold regardless of
    // delay; only wall-clock time changes.
    await sidepanel.evaluate(() => { document.getElementById('stepDelayInput').value = '30'; });

    await sidepanel.waitForFunction(() => !document.getElementById('btnRunAllRows')?.classList.contains('hidden'), null, { timeout: 10000 });
    await sidepanel.evaluate(() => document.getElementById('btnRunAllRows').click());
    await sidepanel.waitForFunction(() => !document.getElementById('bentoModalOverlay')?.classList.contains('hidden'), null, { timeout: 10000 });
    const confirmMessage = await sidepanel.evaluate(() => document.getElementById('bentoModalMessage')?.textContent || '');
    assert.match(confirmMessage, /40 baris dataset/);
    await sidepanel.evaluate(() => document.getElementById('bentoModalConfirmBtn').click());

    // Progress must advance through the batch (any row count out of 40).
    await sidepanel.waitForFunction((count) => new RegExp(`Baris \\d{1,3}\\/${count}`).test(document.getElementById('bannerDetail')?.textContent || ''), ROW_COUNT, { timeout: 15000 });

    // Real per-step overhead (scripting round-trips, retries) dominates over
    // the 30ms artificial delay - measured at ~67s for 40 rows locally, so
    // this leaves comfortable headroom for a loaded CI runner.
    await sidepanel.waitForFunction(() => /baris gagal/.test(document.getElementById('bentoModalMessage')?.textContent || ''), null, { timeout: 120000 });
    const summaryText = await sidepanel.evaluate(() => document.getElementById('bentoModalMessage')?.textContent || '');
    assert.match(summaryText, /38 baris sukses, 2 baris gagal dari 40 diproses/);
    assert.match(summaryText, /Baris 10:/);
    assert.match(summaryText, /Baris 30:/);
    await sidepanel.evaluate(() => document.getElementById('bentoModalCancelBtn').click());

    await sidepanel.waitForFunction(() => document.getElementById('btnRunAllRows')?.disabled === false, null, { timeout: 10000 });
    const checkpointAfterFinish = await sidepanel.evaluate(() => new Promise(resolve => chrome.storage.local.get('qa_bulk_run_checkpoint', res => resolve(res?.qa_bulk_run_checkpoint || null))));
    assert.equal(checkpointAfterFinish, null);
  } finally {
    await context?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('dataset selector collapses large imports into one option instead of freezing the dropdown', async () => {
  const extensionPath = path.resolve('.');
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const sidepanel = await context.newPage();
    await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await sidepanel.getByText('PRO v4.4').waitFor();

    // 250 rows is past the MAX_PER_ROW_OPTIONS=200 threshold that used to
    // create one <option> per row and freeze the dropdown for large imports.
    const ROW_COUNT = 250;
    const rows = Array.from({ length: ROW_COUNT }, (_, i) => ({ name: `Row${i + 1}` }));
    const saved = await sidepanel.evaluate((rows) => new Promise(resolve => chrome.runtime.sendMessage({
      action: 'SAVE_DATASET',
      payload: { dataset: { name: 'Import Besar', rows } }
    }, resolve)), rows);
    assert.equal(saved.status, 'SUCCESS');

    await sidepanel.locator('#tab-btn-presets').click();
    // <option> elements inside a <select> never satisfy Playwright's
    // "visible" actionability check even when genuinely present in the DOM -
    // poll the plain DOM instead of using a visibility-based locator wait.
    await sidepanel.waitForFunction(() => Array.from(document.querySelectorAll('#datasetSelector option')).some(o => o.textContent.includes('Import Besar')), null, { timeout: 10000 });

    // A 250-row import must collapse to ONE <option>, not 250.
    const options = await sidepanel.locator('#datasetSelector option').allTextContents();
    const matching = options.filter(text => text.includes('Import Besar'));
    assert.equal(matching.length, 1, 'A large dataset must collapse to a single summary option, not one option per row');
    assert.equal(matching[0].trim(), 'Import Besar · 250 baris');

    // Saving a dataset makes it active automatically - the bulk-run button
    // must already be visible without any extra selection step.
    await sidepanel.waitForFunction(() => !document.getElementById('btnRunAllRows')?.classList.contains('hidden'), null, { timeout: 10000 });
  } finally { await context.close(); }
});

test('bug exporter modal renders and exports a report to slack', async () => {
  const extensionPath = path.resolve('.');
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const sidepanel = await context.newPage();
    await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // Mock the webhook POST so the export succeeds without a real endpoint.
    await sidepanel.evaluate(() => {
      window.fetch = async (url) => {
        if (String(url).includes('hooks.slack.com')) {
          return { ok: true, status: 200, statusText: 'OK', json: async () => ({ ok: true }) };
        }
        return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) };
      };
    });

    // Open the exporter via the QA governance menu (the banner button is hidden
    // until there is a bug/failure to export).
    await sidepanel.locator('#tab-btn-reports').click();
    await sidepanel.locator('#btnQaGovernanceMenu').click();
    await sidepanel.locator('#btnExportBugMenu').click();
    await sidepanel.locator('#bentoExportBugModal:not(.hidden)').waitFor();
    assert.equal(await sidepanel.locator('#exportBugTitle').innerText(), 'Bug Exporter');
    assert.equal(await sidepanel.locator('.export-platform').count(), 5, 'Five platform chips');
    assert.equal(await sidepanel.locator('.export-platform.is-active').getAttribute('data-platform'), 'slack');

    await sidepanel.locator('#exportBugTitleInput').fill('Login gagal di halaman utama');
    await sidepanel.locator('#exportBugDescInput').fill('Repro: isi email/password lalu klik masuk.');
    await sidepanel.locator('#exportEndpointInput').fill('https://hooks.slack.com/services/T000/B000/XXXX');
    await sidepanel.locator('#btnSendBugReport').click();

    // Success path closes the modal and re-enables the send button.
    await sidepanel.locator('#bentoExportBugModal').waitFor({ state: 'hidden', timeout: 10000 });
    assert.equal(await sidepanel.locator('#btnSendBugReport').isEnabled(), true);
    assert.equal(await sidepanel.locator('#btnSendBugReport').innerText(), '🚀 Kirim Laporan Bug');
    const savedEndpoint = await sidepanel.evaluate(() => new Promise(resolve => chrome.storage.local.get('qa_export_endpoint', resolve)));
    assert.equal(savedEndpoint.qa_export_endpoint, 'https://hooks.slack.com/services/T000/B000/XXXX');
  } finally { await context.close(); }
});

test('ai settings UI opens from the extracted module', async () => {
  const extensionPath = path.resolve('.');
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const sidepanel = await context.newPage();
    await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // Open AI Settings via the header button (on the Copilot tab); the extracted
    // module must render the form.
    await sidepanel.evaluate(() => document.getElementById('tab-btn-copilot').click());
    await sidepanel.locator('#btnOpenAiSettingsDirect').click();
    await sidepanel.locator('#aiProviderSelect').waitFor({ timeout: 10000 });
    assert.equal(await sidepanel.locator('#aiProviderSelect option').count(), 3, 'Three providers');
    assert.equal(await sidepanel.locator('#aiModelSelect option').count() >= 2, true, 'Model list populated');
    // Saving must persist qa_ai_settings locally (no API key needed to render).
    await sidepanel.locator('#aiProviderSelect').selectOption('gemini');
    await sidepanel.locator('#aiApiKey').fill('TEST_KEY_XYZ');
    await sidepanel.locator('#btnSaveAiSettings').click();
    await sidepanel.locator('#qaWorkspaceOverlay').waitFor({ state: 'hidden', timeout: 10000 });
    const saved = await sidepanel.evaluate(() => new Promise(resolve => chrome.storage.local.get('qa_ai_settings', resolve)));
    assert.equal(saved.qa_ai_settings.provider, 'gemini');
    assert.equal(saved.qa_ai_settings.apiKey, 'TEST_KEY_XYZ');
  } finally { await context.close(); }
});

test('video settings UI opens and saves from the extracted module', async () => {
  const extensionPath = path.resolve('.');
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const sidepanel = await context.newPage();
    await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // Open Video Settings via the QA governance menu (Reports tab).
    await sidepanel.locator('#tab-btn-reports').click();
    await sidepanel.locator('#btnQaGovernanceMenu').click();
    await sidepanel.locator('#btnVideoSettings').click();
    await sidepanel.locator('#videoUploadUrl').waitFor({ timeout: 10000 });

    await sidepanel.locator('#videoUploadUrl').fill('https://cloud.example/qa-upload.php');
    await sidepanel.locator('#videoApiKey').fill('SECRET_KEY');
    await sidepanel.locator('#btnSaveVideoSettings').click();
    await sidepanel.locator('#qaWorkspaceOverlay').waitFor({ state: 'hidden', timeout: 10000 });
    const saved = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, response => resolve(response?.data?.videoSettings))));
    assert.equal(saved.uploadUrl, 'https://cloud.example/qa-upload.php');
    assert.equal(saved.apiKey, 'SECRET_KEY');
  } finally { await context.close(); }
});

test('recording toggles via the extracted button handler', async () => {
  const server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><title>Rec UI Fixture</title><button id="go" type="button">Go</button>');
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

    // DOM click (no focus steal) so getActiveTab() still sees the target page.
    await sidepanel.evaluate(() => document.getElementById('btnRecord').click());
    await sidepanel.waitForFunction(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, response => resolve(response?.data?.isRecording === true))), null, { timeout: 10000 });
    // Wait for the button UI (class) instead of asserting immediately — the class
    // is added in the START_RECORDING callback, slightly after state flips.
    await sidepanel.locator('#btnRecord.recording').waitFor({ timeout: 10000 });
    await sidepanel.evaluate(() => document.getElementById('btnRecord').click());
    await sidepanel.waitForFunction(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, response => resolve(response?.data?.isRecording === false))), null, { timeout: 10000 });
    await sidepanel.locator('#btnRecord.recording').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  } finally {
    await context?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('governance sign-off opens from the extracted module', async () => {
  const extensionPath = path.resolve('.');
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const sidepanel = await context.newPage();
    await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    await sidepanel.locator('#tab-btn-reports').click();
    await sidepanel.locator('#btnQaGovernanceMenu').click();
    await sidepanel.locator('#btnReleaseSignoff').click();
    // The extracted module must render the structured sign-off form.
    await sidepanel.locator('#qaWorkspaceBody input[name="release"]').waitFor({ timeout: 10000 });
    await sidepanel.locator('#qaWorkspaceBody input[name="approver"]').waitFor();
    assert.equal(await sidepanel.locator('#qaWorkspaceBody select[name="approved"] option').count() >= 2, true, 'Decision select populated');
  } finally { await context.close(); }
});

test('QA Readiness: requirement traceability and defect lifecycle persist end-to-end', async () => {
  const extensionPath = path.resolve('.');
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const sidepanel = await context.newPage();
    await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await sidepanel.getByText('PRO v4.4').waitFor();

    // Add a requirement.
    await sidepanel.locator('#tab-btn-reports').click();
    await sidepanel.locator('#btnQaGovernanceMenu').click();
    await sidepanel.locator('#btnRequirements').click();
    await sidepanel.locator('#qaAddRequirement').click();
    await sidepanel.locator('#qaWorkspaceBody input[name="id"]').fill('REQ-LOGIN-001');
    await sidepanel.locator('#qaWorkspaceBody select[name="risk"]').selectOption('HIGH');
    await sidepanel.locator('#qaWorkspaceBody input[name="title"]').fill('User can log in with valid credentials');
    await sidepanel.locator('.qa-entity-form [type="submit"]').click();
    // Saving re-renders the requirement manager list in place (the overlay stays open).
    await sidepanel.locator('.qa-board-item', { hasText: 'REQ-LOGIN-001' }).waitFor({ timeout: 10000 });

    const afterRequirement = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, resolve)));
    const suite = afterRequirement.data.suites.find(item => item.id === afterRequirement.data.activeSuiteId);
    assert.equal(suite.requirements.length, 1);
    assert.equal(suite.requirements[0].id, 'REQ-LOGIN-001');
    assert.equal(suite.requirements[0].risk, 'HIGH');

    // Log a defect against that requirement.
    await sidepanel.locator('#qaWorkspaceClose').click();
    await sidepanel.locator('#btnQaGovernanceMenu').click();
    await sidepanel.locator('#btnAddDefect').click();
    await sidepanel.locator('#qaWorkspaceBody input[name="title"]').fill('Login button stays disabled after valid input');
    await sidepanel.locator('#qaWorkspaceBody select[name="severity"]').selectOption('CRITICAL');
    await sidepanel.locator('#qaWorkspaceBody textarea[name="requirementIds"]').fill('REQ-LOGIN-001');
    await sidepanel.locator('.qa-entity-form [type="submit"]').click();

    // Saving a defect opens the defect board - the new defect must appear there.
    const boardItem = sidepanel.locator('.qa-board-item', { hasText: 'Login button stays disabled' });
    await boardItem.waitFor({ timeout: 10000 });
    const boardItemText = await boardItem.innerText();
    assert.match(boardItemText, /CRITICAL/);
    assert.match(boardItemText, /OPEN/);
    assert.match(boardItemText, /REQ-LOGIN-001/);

    const afterDefect = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, resolve)));
    const defect = afterDefect.data.defects.find(item => item.requirementIds.includes('REQ-LOGIN-001'));
    assert.ok(defect, 'Defect must be linked to the requirement in stored state, not just shown in the UI');
    assert.equal(defect.status, 'OPEN');
    assert.equal(defect.severity, 'CRITICAL');

    // Close the defect from the board and confirm the lifecycle transition persists.
    await boardItem.locator('.qa-close-defect').click();
    await sidepanel.waitForFunction(() => {
      const items = Array.from(document.querySelectorAll('.qa-board-item'));
      const match = items.find(el => el.textContent.includes('Login button stays disabled'));
      return match ? match.textContent.includes('CLOSED') : false;
    }, null, { timeout: 10000 });

    const finalState = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, resolve)));
    const closedDefect = finalState.data.defects.find(item => item.id === defect.id);
    assert.equal(closedDefect.status, 'CLOSED');
  } finally { await context.close(); }
});

test('release sign-off enforces the quality gate and records an audited override', async () => {
  const extensionPath = path.resolve('.');
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const sidepanel = await context.newPage();
    await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await sidepanel.getByText('PRO v4.4').waitFor();

    await sidepanel.locator('#tab-btn-reports').click();
    await sidepanel.locator('#btnQaGovernanceMenu').click();
    await sidepanel.locator('#btnReleaseSignoff').click();
    await sidepanel.locator('#qaWorkspaceBody input[name="release"]').waitFor({ timeout: 10000 });

    await sidepanel.locator('#qaWorkspaceBody input[name="release"]').fill('v4.4.0');
    await sidepanel.locator('#qaWorkspaceBody input[name="approver"]').fill('Wahid');
    // No execution history exists yet for this fresh suite, so the "passing
    // run" gate fails on its own - approving without an override reason must
    // be rejected client-side rather than silently signed off.
    await sidepanel.locator('.qa-entity-form [type="submit"]').click();
    await sidepanel.locator('.qa-form-error:not(.hidden)').waitFor({ timeout: 10000 });
    assert.match(await sidepanel.locator('.qa-form-error').innerText(), /Quality gate gagal/);
    assert.equal(await sidepanel.locator('#qaWorkspaceOverlay').isHidden(), false, 'A rejected gate must not close the workspace');

    // Supplying an audited override reason must let it through despite the
    // failing gate, and both the failure and the reason must be recorded.
    await sidepanel.locator('#qaWorkspaceBody textarea[name="overrideReason"]').fill('No CI run yet on this fresh suite; manually smoke-tested locally before this release.');
    await sidepanel.locator('.qa-entity-form [type="submit"]').click();
    await sidepanel.locator('#qaWorkspaceOverlay').waitFor({ state: 'hidden', timeout: 10000 });

    const state = await sidepanel.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, resolve)));
    const signoff = state.data.releaseSignoffs[0];
    assert.equal(signoff.release, 'v4.4.0');
    assert.equal(signoff.approver, 'Wahid');
    assert.equal(signoff.approved, true);
    assert.equal(signoff.gates.passingRun, false);
    assert.match(signoff.overrideReason, /manually smoke-tested/);
  } finally { await context.close(); }
});

test('IP geolocation modal opens from the extracted module', async () => {
  const extensionPath = path.resolve('.');
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const sidepanel = await context.newPage();
    await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    await sidepanel.locator('#tab-btn-reports').click();
    await sidepanel.locator('#btnQaGovernanceMenu').click();
    await sidepanel.locator('#btnCheckIpInfo').click();
    // The extracted module must open the IP modal.
    await sidepanel.locator('#bentoIpModal:not(.hidden)').waitFor({ timeout: 10000 });
    // Close via the module's close button.
    await sidepanel.locator('#btnCloseIpModal').click();
    await sidepanel.locator('#bentoIpModal').waitFor({ state: 'hidden', timeout: 10000 });
  } finally { await context.close(); }
});
