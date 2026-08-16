import { test, expect } from '@playwright/test';
import Ajv2020 from 'ajv/dist/2020.js';
import path from 'node:path';
import { loadSuiteDocument, resolveDatasetRows } from '../runner/lib/suite-loader.mjs';
import { assertSafeNetworkTarget } from '../runner/lib/safe-network.mjs';
import { AIClient } from '../shared/ai-client.js';

const suitePath = process.env.QA_SUITE_PATH;
if (!suitePath) throw new Error('QA_SUITE_PATH is required. Run through npm run qa:run -- <suite.json>.');
const document = await loadSuiteDocument(suitePath);
const suite = document.suite;
const datasetRows = resolveDatasetRows(document);
const envVariables = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('QA_VAR_')).map(([key, value]) => [key.slice(7).toLowerCase(), value]));
const requiredTags = String(process.env.QA_TAGS || '').split(',').map(item => item.trim()).filter(Boolean);
const suiteTags = Array.isArray(suite.tags) ? suite.tags : [];
const shouldRun = !requiredTags.length || requiredTags.some(tag => suiteTags.includes(tag));

test.describe(suite.name || 'QA Flow Suite', () => {
  test.skip(!shouldRun, `Suite tags do not match QA_TAGS=${requiredTags.join(',')}`);
  for (const [rowIndex, row] of datasetRows.entries()) {
    test(`${suite.name || 'Suite'}${datasetRows.length > 1 ? ` · data ${rowIndex + 1}` : ''}`, async ({ page, request }, testInfo) => {
      const state = { networkEvents: [], consoleErrors: [], previousUrl: '', lastApiResponse: null };
      page.on('response', response => state.networkEvents.push({ url: response.url(), status: response.status(), method: response.request().method() }));
      page.on('console', message => { if (message.type() === 'error') state.consoleErrors.push(message.text()); });
      const variables = { baseUrl: process.env.QA_BASE_URL || document.environment?.baseUrl || '', ...(document.environment?.variables || {}), ...(row || {}), ...envVariables };
      const interpolate = value => String(value ?? '').replace(/\{\{([\w.-]+)\}\}/g, (match, key) => Object.hasOwn(variables, key) ? String(variables[key]) : match);
      await page.addInitScript(() => {
        globalThis.__qaWebVitals = { lcp: 0, cls: 0, inp: 0 };
        try { new PerformanceObserver(list => { const entries = list.getEntries(); globalThis.__qaWebVitals.lcp = entries.at(-1)?.startTime || 0; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (error) {}
        try { new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) globalThis.__qaWebVitals.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (error) {}
        try { new PerformanceObserver(list => { for (const entry of list.getEntries()) globalThis.__qaWebVitals.inp = Math.max(globalThis.__qaWebVitals.inp, entry.duration || 0); }).observe({ type: 'event', buffered: true, durationThreshold: 16 }); } catch (error) {}
      });
      const startUrl = interpolate(suite.startUrl || variables.baseUrl || 'https://example.com');
      await test.step(`Open ${startUrl}`, () => page.goto(startUrl, { waitUntil: 'domcontentloaded' }));
      await runSteps(suite.beforeEach || [], 'Setup', { page, request, testInfo, state, interpolate });
      try {
        await runSteps((suite.steps || []).filter(step => step.enabled !== false), 'Test', { page, request, testInfo, state, interpolate });
      } catch (error) {
        if (process.env.QA_AI_API_KEY) {
          console.log(`\n[AI Root Cause Analysis] Menganalisis kegagalan...`);
          try {
            const ai = new AIClient(process.env.QA_AI_PROVIDER, process.env.QA_AI_API_KEY, process.env.QA_AI_MODEL);
            const dom = await page.content().catch(() => '');
            const logs = JSON.stringify(state.consoleErrors);
            const network = JSON.stringify(state.networkEvents.filter(n => n.status >= 400));
            const prompt = `Tes gagal dengan error: ${error.message}.\nLogs: ${logs}\nNetwork Errors: ${network}\nBerdasarkan DOM, log, dan network, apa penyebab kegagalan ini dan bagaimana solusinya? Berikan penjelasan ringkas dalam Bahasa Indonesia (maksimal 3 paragraf).`;
            const analysis = await ai.sendPrompt("Anda adalah QA Root Cause Analyzer.", prompt, dom.substring(0, 40000));
            await testInfo.attach('AI-Root-Cause-Analysis', { body: Buffer.from(analysis), contentType: 'text/plain' });
            console.log(`[AI Root Cause Analysis] ✅ Analisis ditambahkan ke report Playwright.`);
          } catch (aiErr) {
            console.log(`[AI Root Cause Analysis] ❌ Gagal: ${aiErr.message}`);
          }
        }
        throw error;
      } finally {
        await runSteps(suite.afterEach || [], 'Cleanup', { page, request, testInfo, state, interpolate });
      }
    });
  }
});

async function runSteps(steps, phase, context) {
  for (const [index, step] of steps.entries()) {
    if (step.quarantined) {
      if (!step.quarantineOwner || !step.quarantineUntil) throw new Error(`Quarantine requires owner and expiry: ${step.id || step.description || index + 1}`);
      if (Date.parse(step.quarantineUntil) < Date.now()) throw new Error(`Quarantine expired: ${step.id || step.description || index + 1}`);
      await context.testInfo.attach('quarantined-step', { body: Buffer.from(JSON.stringify({ id: step.id, owner: step.quarantineOwner, until: step.quarantineUntil }, null, 2)), contentType: 'application/json' });
      continue;
    }
    if (step.action === 'use_flow') {
      const name = context.interpolate(step.value || step.selector);
      const flow = suite.flows?.[name];
      if (!Array.isArray(flow)) throw new Error(`Reusable flow not found: ${name}`);
      await runSteps(flow, `Flow ${name}`, context);
      continue;
    }
    await test.step(`${phase} ${index + 1}: ${step.description || step.action}`, async () => executeStep(step, context));
  }
}

async function executeStep(step, { page, request, testInfo, state, interpolate }) {
  const action = step.action;
  const value = interpolate(step.value);
  const timeout = Math.max(250, Math.min(60000, Number(step.timeout) || 5000));
  const selectors = [step.selector, ...(step.fallbackSelectors || [])].filter(Boolean).map(interpolate);
  // 'press' can target a specific element (Locator.press) or - when no selector
  // is given - simulate a global keypress on whatever currently has focus (the
  // common "type into a search box, hit Enter" pattern with no dedicated button).
  const targetRequired = !['assert_url','assert_screenshot','assert_network_status','assert_no_console_errors','assert_a11y','assert_performance','assert_security_headers','api_request','mock_route','clear_mocks','use_flow','wait','press','go_back','go_forward','wait_for_text','wait_for_url_change','wait_for_network_idle'].includes(action);
  const scope = await resolveStepScope(page, step, interpolate);
  const shouldResolveLocator = selectors.length > 0 && (targetRequired || action === 'press');
  let locator = shouldResolveLocator ? await resolveLocator(scope, selectors, timeout) : null;
  
  if (targetRequired && !locator) {
    if (process.env.QA_AI_API_KEY) {
      console.log(`\n[AI Self-Healing] Elemen tidak ditemukan: ${selectors.join(' | ')}. Meminta AI untuk memperbaiki...`);
      try {
        const ai = new AIClient(process.env.QA_AI_PROVIDER, process.env.QA_AI_API_KEY, process.env.QA_AI_MODEL);
        const htmlContent = await page.evaluate(() => {
          const clonedBody = document.body.cloneNode(true);
          clonedBody.querySelectorAll('script, style, svg, path, link, meta, noscript, iframe').forEach(el => el.remove());
          return clonedBody.innerHTML.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
        });
        const systemPrompt = "Anda adalah AI Self-Healing untuk Playwright. Berikut adalah struktur DOM halaman saat ini. Tolong temukan satu CSS selector terbaik yang sesuai untuk elemen target dengan deskripsi '" + (step.description || action) + "'. Anda HARUS mengembalikan HANYA string CSS selector-nya tanpa penjelasan tambahan, tanpa markdown, tanpa tanda kutip.";
        const newSelector = (await ai.sendPrompt(systemPrompt, `Mencari elemen untuk aksi: ${action}`, htmlContent.substring(0, 40000))).replace(/`/g, '').trim();
        console.log(`[AI Self-Healing] Selector baru dari AI: ${newSelector}`);
        const healedLocator = await resolveLocator(scope, [newSelector], 5000);
        if (healedLocator) {
          locator = healedLocator;
          console.log(`[AI Self-Healing] ✅ Berhasil pulih menggunakan selector AI.`);
        } else {
          throw new Error(`AI memberikan selector ${newSelector} tapi elemen tetap tidak ditemukan.`);
        }
      } catch (e) {
        console.log(`[AI Self-Healing] ❌ Gagal melakukan self-healing: ${e.message}`);
        throw new Error(`Element not found: ${selectors.join(' | ')}`);
      }
    } else {
      throw new Error(`Element not found: ${selectors.join(' | ')}`);
    }
  }

  switch (action) {
    case 'click': state.previousUrl = page.url(); await locator.click({ timeout }); break;
    case 'fill': await locator.fill(value, { timeout }); break;
    case 'select': await locator.selectOption(value, { timeout }); break;
    case 'hover': await locator.hover({ timeout }); break;
    case 'press': {
      const key = value || 'Enter';
      if (step.selector) {
        if (!locator) throw new Error(`Element not found: ${selectors.join(' | ')}`);
        await locator.press(key, { timeout });
      } else {
        await page.keyboard.press(key);
      }
      break;
    }
    case 'go_back': state.previousUrl = page.url(); await page.goBack({ timeout, waitUntil: 'domcontentloaded' }); break;
    case 'go_forward': state.previousUrl = page.url(); await page.goForward({ timeout, waitUntil: 'domcontentloaded' }); break;
    case 'assert_visible': await expect(locator).toBeVisible({ timeout }); break;
    case 'assert_enabled': await expect(locator).toBeEnabled({ timeout }); break;
    case 'assert_disabled': await expect(locator).toBeDisabled({ timeout }); break;
    case 'assert_checked': await expect(locator).toBeChecked({ timeout }); break;
    case 'assert_unchecked': await expect(locator).not.toBeChecked({ timeout }); break;
    case 'assert_text': await expect(locator).toContainText(value, { timeout }); break;
    case 'assert_value': await expect(locator).toHaveValue(value, { timeout }); break;
    case 'assert_count': await expect(scope.locator(interpolate(step.selector))).toHaveCount(Number(value), { timeout }); break;
    case 'assert_attribute': { const [name, ...parts] = value.split('='); await expect(locator).toHaveAttribute(name, parts.join('='), { timeout }); break; }
    case 'assert_css': { const [name, ...parts] = value.split('='); await expect(locator).toHaveCSS(name, parts.join('='), { timeout }); break; }
    case 'assert_url': await expect(page).toHaveURL(new RegExp(escapeRegExp(value)), { timeout }); break;
    case 'assert_no_console_errors': expect(state.consoleErrors, state.consoleErrors.join('\n')).toEqual([]); break;
    case 'assert_network_status': { const match = [...state.networkEvents].reverse().find(event => !step.selector || event.url.includes(interpolate(step.selector))); expect(match?.status, `No matching response for ${step.selector || 'latest request'}`).toBe(Number(value)); break; }
    case 'assert_screenshot': {
      const name = `${String(step.id || `step-${testInfo.title}`).replace(/[^a-z0-9_-]/gi, '_')}.png`;
      const masks = (step.maskSelectors || []).map(selector => scope.locator(interpolate(selector)));
      await expect(page).toHaveScreenshot(name, { fullPage: step.fullPage !== false, maxDiffPixelRatio: Number(step.maxDiffPixelRatio ?? process.env.QA_VISUAL_THRESHOLD ?? 0.01), mask: masks, animations: 'disabled' });
      break;
    }
    case 'assert_a11y': {
      await page.addScriptTag({ path: path.resolve('node_modules/axe-core/axe.min.js') });
      const result = await page.evaluate(config => globalThis.axe.run(document, config), parseJson(value, {}));
      await testInfo.attach('axe-results', { body: Buffer.from(JSON.stringify(result, null, 2)), contentType: 'application/json' });
      expect(result.violations.map(item => `${item.id}: ${item.help}`).join('\n')).toBe('');
      break;
    }
    case 'assert_performance': {
      const budget = parseJson(value, {});
      const metrics = await page.evaluate(() => { const nav = performance.getEntriesByType('navigation')[0]; const resources = performance.getEntriesByType('resource'); return { loadMs: nav?.duration || 0, ttfb: nav?.responseStart || 0, transferBytes: resources.reduce((sum, item) => sum + (item.transferSize || 0), 0), requests: resources.length, ...(globalThis.__qaWebVitals || {}) }; });
      await testInfo.attach('performance-budget', { body: Buffer.from(JSON.stringify(metrics, null, 2)), contentType: 'application/json' });
      if (budget.loadMs != null) expect(metrics.loadMs).toBeLessThanOrEqual(Number(budget.loadMs));
      if (budget.transferBytes != null) expect(metrics.transferBytes).toBeLessThanOrEqual(Number(budget.transferBytes));
      if (budget.requests != null) expect(metrics.requests).toBeLessThanOrEqual(Number(budget.requests));
      if (budget.ttfb != null) expect(metrics.ttfb).toBeLessThanOrEqual(Number(budget.ttfb));
      if (budget.lcp != null) expect(metrics.lcp).toBeLessThanOrEqual(Number(budget.lcp));
      if (budget.cls != null) expect(metrics.cls).toBeLessThanOrEqual(Number(budget.cls));
      if (budget.inp != null) expect(metrics.inp).toBeLessThanOrEqual(Number(budget.inp));
      break;
    }
    case 'assert_security_headers': {
      const config = value ? JSON.parse(value) : {};
      const required = Array.isArray(config.required) && config.required.length ? config.required.map(item => String(item).toLowerCase()) : ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy'];
      const response = await safeRequestFetch(request, interpolate(step.selector), { method: 'HEAD', failOnStatusCode: false, timeout }, Math.max(0, Math.min(3, Number(config.maxRedirects) || 0)));
      const headers = response.headers();
      const missing = required.filter(name => !headers[name]);
      if (new URL(interpolate(step.selector)).protocol === 'https:' && config.requireHsts !== false && !headers['strict-transport-security']) missing.push('strict-transport-security');
      expect(missing, `Missing security headers: ${missing.join(', ')}`).toEqual([]);
      await testInfo.attach('security-headers', { body: Buffer.from(JSON.stringify(headers, null, 2)), contentType: 'application/json' });
      break;
    }
    case 'api_request': await executeApiStep(step, { request, state, interpolate, timeout }); break;
    case 'mock_route': {
      const config = parseJson(value, {});
      await page.route(interpolate(step.selector), async route => {
        if (config.delayMs) await new Promise(resolve => setTimeout(resolve, Math.min(30000, Number(config.delayMs))));
        if (config.abort) return route.abort(config.abort === true ? 'failed' : config.abort);
        return route.fulfill({ status: Number(config.status) || 200, headers: config.headers || { 'content-type': 'application/json' }, body: typeof config.body === 'string' ? config.body : JSON.stringify(config.body ?? {}) });
      });
      break;
    }
    case 'clear_mocks': await page.unrouteAll({ behavior: 'wait' }); break;
    case 'use_flow': break;
    case 'wait': await page.waitForTimeout(Math.min(60000, Number(value) || 1000)); break;
    case 'wait_for_element_hidden': await expect(locator).toBeHidden({ timeout }); break;
    case 'wait_for_text': await expect(scope.getByText(value).first()).toBeVisible({ timeout }); break;
    case 'wait_for_network_idle': await page.waitForLoadState('networkidle', { timeout }); break;
    case 'wait_for_url_change': await page.waitForURL(url => url.toString() !== (state.previousUrl || page.url()), { timeout }); break;
    default: throw new Error(`Unsupported action: ${action}`);
  }
}

async function resolveLocator(page, selectors, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const candidate = page.locator(selector).first();
      if (await candidate.count()) return candidate;
    }
    await page.waitForTimeout(100);
  }
  return null;
}

async function resolveStepScope(page, step, interpolate) {
  if (!step?.frame || step.frame.isTop !== false) return page;
  const expectedUrl = interpolate(step.frame.url || '');
  let expected = null;
  try { expected = expectedUrl ? new URL(expectedUrl) : null; } catch (error) {}
  const frame = page.frames().find(item => item.url() === expectedUrl)
    || page.frames().find(item => {
      try {
        const current = new URL(item.url());
        return expected && current.origin === expected.origin && current.pathname === expected.pathname;
      } catch (error) { return false; }
    });
  if (!frame) throw new Error(`Frame target not found: ${expectedUrl || step.frame.name || 'unknown'}`);
  return frame;
}

async function executeApiStep(step, { request, state, interpolate, timeout }) {
  let config = {};
  try { config = step.value ? JSON.parse(interpolate(step.value)) : {}; } catch (error) { throw new Error(`Invalid API config JSON: ${error.message}`); }
  const url = interpolate(step.selector || config.url);
  assertSafeNetworkTarget(url);
  const method = String(config.method || 'GET').toUpperCase();
  const startedAt = Date.now();
  const response = await safeRequestFetch(request, url, { method, headers: config.headers || {}, data: config.body, timeout, failOnStatusCode: false }, Math.max(0, Math.min(3, Number(config.maxRedirects) || 0)));
  const durationMs = Date.now() - startedAt;
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch (error) {}
  state.lastApiResponse = { status: response.status(), headers: response.headers(), text, json };
  if (config.status != null) expect(response.status()).toBe(Number(config.status));
  if (config.maxDurationMs != null) expect(durationMs).toBeLessThanOrEqual(Number(config.maxDurationMs));
  if (config.schema) {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(config.schema);
    expect(validate(json), JSON.stringify(validate.errors || [], null, 2)).toBe(true);
  }
  for (const assertion of config.assertions || []) {
    const actual = getJsonPath(json, assertion.path);
    if (Object.hasOwn(assertion, 'equals')) expect(actual).toEqual(assertion.equals);
    if (assertion.exists === true) expect(actual).not.toBeUndefined();
    if (assertion.contains != null) expect(String(actual)).toContain(String(assertion.contains));
  }
}

function getJsonPath(value, path) { return String(path || '').replace(/^\$\.?/, '').split('.').filter(Boolean).reduce((current, key) => current?.[key], value); }
function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function parseJson(value, fallback) { try { return value ? JSON.parse(value) : fallback; } catch (error) { throw new Error(`Invalid JSON config: ${error.message}`); } }
async function safeRequestFetch(request, value, options = {}, maxRedirects = 0) {
  let current = assertSafeNetworkTarget(value);
  let requestOptions = { ...options, maxRedirects: 0 };
  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    const response = await request.fetch(current.href, requestOptions);
    if (![301, 302, 303, 307, 308].includes(response.status())) return response;
    if (redirects === maxRedirects) throw new Error(`Redirect blocked for ${current.href}; increase maxRedirects only for trusted public targets`);
    const location = response.headers().location;
    if (!location) throw new Error('Redirect response has no Location header');
    const next = assertSafeNetworkTarget(new URL(location, current).href);
    if (next.origin !== current.origin) {
      const headers = { ...(requestOptions.headers || {}) };
      for (const key of Object.keys(headers)) if (['authorization', 'cookie', 'proxy-authorization'].includes(key.toLowerCase())) delete headers[key];
      requestOptions = { ...requestOptions, headers };
    }
    const method = String(requestOptions.method || 'GET').toUpperCase();
    if (response.status() === 303 || ([301, 302].includes(response.status()) && method === 'POST')) requestOptions = { ...requestOptions, method: 'GET', data: undefined };
    current = next;
  }
  throw new Error('Unsafe redirect chain');
}
