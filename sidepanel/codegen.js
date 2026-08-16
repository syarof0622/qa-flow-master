// sidepanel/codegen.js - Pure code generators (Playwright & Cypress export)
// Extracted from sidepanel.js core. These are pure functions: they only read
// their arguments and return source strings - no DOM, no chrome, no app state.
// They are loaded via script tag BEFORE sidepanel.js so callers in the core
// (and any module) can invoke them. Unit-tested in tests/unit/codegen.test.mjs.

  // Validate & clamp AI-generated Copilot steps: drop unknown actions, cap the
  // count, and clamp field lengths so a malformed AI response can never pollute
  // the suite or fail at runtime. Pure — the caller passes the allowlist Set.
  function sanitizeCopilotSteps(rawSteps, allowedActions = new Set()) {
    if (!Array.isArray(rawSteps)) return [];
    const clean = value => String(value ?? '').slice(0, 5000);
    const out = [];
    for (const step of rawSteps.slice(0, 200)) {
      if (!step || typeof step !== 'object' || !allowedActions.has(step.action)) continue;
      out.push({
        action: step.action,
        selector: clean(step.selector),
        value: clean(step.value),
        description: clean(step.description),
        notes: clean(step.notes),
        enabled: step.enabled !== false,
        risk: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(step.risk) ? step.risk : 'MEDIUM',
        timeout: Math.max(250, Math.min(60000, parseInt(step.timeout, 10) || 5000))
      });
    }
    return out;
  }

  function jsLiteral(value) {
    return JSON.stringify(String(value ?? ''));
  }

  function safeCodeComment(value) {
    return String(value || '').replace(/[\r\n\u2028\u2029]+/g, ' ').replace(/\*\//g, '* /').slice(0, 180);
  }

  function generatePlaywrightCode(steps, targetUrl) {
    let s = `import { test, expect } from '@playwright/test';\n\n`;
    s += `function frameScope(page, expectedUrl) {\n  const expected = new URL(expectedUrl);\n  const frame = page.frames().find(item => item.url() === expectedUrl) || page.frames().find(item => { try { const current = new URL(item.url()); return current.origin === expected.origin && current.pathname === expected.pathname; } catch { return false; } });\n  if (!frame) throw new Error(\`Frame target not found: \${expectedUrl}\`);\n  return frame;\n}\n\n`;
    s += `test('Automated QA Flow Test', async ({ page, request }) => {\n`;
    s += `  const consoleErrors = [];\n  const responses = [];\n`;
    s += `  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });\n`;
    s += `  page.on('response', response => responses.push({ url: response.url(), status: response.status() }));\n`;
    s += `  await page.goto(${jsLiteral(targetUrl || 'https://example.com')});\n\n`;
    steps.forEach((step, i) => {
      s += `  // Step #${i + 1}: ${safeCodeComment(step.description || step.action)}\n`;
      const sel = jsLiteral(step.selector || '');
      const val = jsLiteral(step.value || '');
      const scope = step.frame?.isTop === false ? `frameScope(page, ${jsLiteral(step.frame.url || '')})` : 'page';
      switch (step.action) {
        case 'click': s += `  await ${scope}.locator(${sel}).click();\n`; break;
        case 'fill': s += `  await ${scope}.locator(${sel}).fill(${val});\n`; break;
        case 'select': s += `  await ${scope}.locator(${sel}).selectOption(${val});\n`; break;
        case 'hover': s += `  await ${scope}.locator(${sel}).hover();\n`; break;
        case 'press': s += step.selector ? `  await ${scope}.locator(${sel}).press(${jsLiteral(step.value || 'Enter')});\n` : `  await page.keyboard.press(${jsLiteral(step.value || 'Enter')});\n`; break;
        case 'go_back': s += `  await page.goBack({ waitUntil: 'domcontentloaded' });\n`; break;
        case 'go_forward': s += `  await page.goForward({ waitUntil: 'domcontentloaded' });\n`; break;
        case 'assert_visible': s += `  await expect(${scope}.locator(${sel})).toBeVisible();\n`; break;
        case 'assert_enabled': s += `  await expect(${scope}.locator(${sel})).toBeEnabled();\n`; break;
        case 'assert_disabled': s += `  await expect(${scope}.locator(${sel})).toBeDisabled();\n`; break;
        case 'assert_checked': s += `  await expect(${scope}.locator(${sel})).toBeChecked();\n`; break;
        case 'assert_unchecked': s += `  await expect(${scope}.locator(${sel})).not.toBeChecked();\n`; break;
        case 'assert_text': s += `  await expect(${scope}.locator(${sel})).toContainText(${val});\n`; break;
        case 'assert_value': s += `  await expect(${scope}.locator(${sel})).toHaveValue(${val});\n`; break;
        case 'assert_attribute': {
          const [name, ...expected] = String(step.value || '').split('=');
          s += `  await expect(${scope}.locator(${sel})).toHaveAttribute(${jsLiteral(name)}, ${jsLiteral(expected.join('='))});\n`; break;
        }
        case 'assert_css': {
          const [name, ...expected] = String(step.value || '').split('=');
          s += `  await expect(${scope}.locator(${sel})).toHaveCSS(${jsLiteral(name)}, ${jsLiteral(expected.join('='))});\n`; break;
        }
        case 'assert_count': s += `  await expect(${scope}.locator(${sel})).toHaveCount(${Number(step.value) || 0});\n`; break;
        case 'assert_url': s += `  await expect(page).toHaveURL(new RegExp(${val}));\n`; break;
        case 'assert_screenshot': s += `  await expect(page).toHaveScreenshot(${jsLiteral(`${step.id || `step-${i + 1}`}.png`)}, { fullPage: true, maxDiffPixelRatio: ${Number(step.maxDiffPixelRatio ?? 0.01)} });\n`; break;
        case 'assert_network_status': s += `  expect([...responses].reverse().find(item => !${sel} || item.url.includes(${sel}))?.status).toBe(${Number(step.value) || 200});\n`; break;
        case 'assert_no_console_errors': s += `  expect(consoleErrors, consoleErrors.join('\\n')).toEqual([]);\n`; break;
        case 'assert_a11y': s += `  // Axe: use the canonical QA Flow runner to attach full violation evidence.\n  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });\n  expect((await page.evaluate(() => axe.run())).violations).toEqual([]);\n`; break;
        case 'assert_performance': s += `  { const budget = JSON.parse(${val}); const nav = await page.evaluate(() => performance.getEntriesByType('navigation')[0]?.duration || 0); if (budget.loadMs != null) expect(nav).toBeLessThanOrEqual(budget.loadMs); }\n`; break;
        case 'assert_security_headers': s += `  { const cfg = JSON.parse(${val}); const res = await request.fetch(${sel}, { method: 'HEAD', failOnStatusCode: false }); const headers = res.headers(); for (const name of (cfg.required || ['content-security-policy','x-content-type-options','referrer-policy','permissions-policy'])) expect(headers[name.toLowerCase()]).toBeTruthy(); }\n`; break;
        case 'api_request': {
          const apiVar = `apiConfig${i + 1}`;
          s += `  const ${apiVar} = JSON.parse(${val});\n`;
          s += `  const apiResponse${i + 1} = await request.fetch(${sel}, { method: ${apiVar}.method || 'GET', headers: ${apiVar}.headers, data: ${apiVar}.body, failOnStatusCode: false });\n`;
          s += `  if (${apiVar}.status != null) expect(apiResponse${i + 1}.status()).toBe(${apiVar}.status);\n`; break;
        }
        case 'mock_route': s += `  { const mock = JSON.parse(${val}); await page.route(${sel}, route => mock.abort ? route.abort() : route.fulfill({ status: mock.status || 200, body: typeof mock.body === 'string' ? mock.body : JSON.stringify(mock.body || {}) })); }\n`; break;
        case 'clear_mocks': s += `  await page.unrouteAll({ behavior: 'wait' });\n`; break;
        case 'use_flow': s += `  // Reusable flow ${safeCodeComment(step.value)} is expanded by QA Flow runner.\n`; break;
        case 'wait': s += `  await page.waitForTimeout(${Math.max(0, Math.min(60000, parseInt(step.value, 10) || 1000))});\n`; break;
        case 'wait_for_element_hidden': s += `  await expect(${scope}.locator(${sel})).toBeHidden();\n`; break;
        case 'wait_for_text': s += `  await expect(${scope}.getByText(${val}).first()).toBeVisible();\n`; break;
        case 'wait_for_url_change': s += `  { const previousUrl = page.url(); await page.waitForURL(url => url.toString() !== previousUrl); }\n`; break;
        case 'wait_for_network_idle': s += `  await page.waitForLoadState('networkidle');\n`; break;
        default: s += `  throw new Error(${jsLiteral(`Unsupported exported action: ${step.action}`)});\n`;
      }
      s += '\n';
    });
    s += '});\n';
    return s;
  }

  function generateCypressCode(steps, targetUrl) {
    let s = `describe('Automated QA Flow Test', () => {\n`;
    s += `  it('should complete all test steps', () => {\n`;
    s += `    cy.visit(${jsLiteral(targetUrl || 'https://example.com')});\n\n`;
    steps.forEach((step, i) => {
      s += `    // Step #${i + 1}: ${safeCodeComment(step.description || step.action)}\n`;
      const sel = jsLiteral(step.selector || '');
      const val = jsLiteral(step.value || '');
      switch (step.action) {
        case 'click': s += `    cy.get(${sel}).click();\n`; break;
        case 'fill': s += `    cy.get(${sel}).clear().type(${val});\n`; break;
        case 'select': s += `    cy.get(${sel}).select(${val});\n`; break;
        case 'hover': s += `    cy.get(${sel}).trigger('mouseover');\n`; break;
        case 'assert_visible': s += `    cy.get(${sel}).should('be.visible');\n`; break;
        case 'assert_text': s += `    cy.get(${sel}).should('contain', ${val});\n`; break;
        case 'assert_value': s += `    cy.get(${sel}).should('have.value', ${val});\n`; break;
        case 'assert_url': s += `    cy.url().should('include', ${val});\n`; break;
        case 'wait': s += `    cy.wait(${Math.max(0, Math.min(60000, parseInt(step.value, 10) || 1000))});\n`; break;
        case 'wait_for_element_hidden': s += `    cy.get(${sel}).should('not.be.visible');\n`; break;
        case 'go_back': s += `    cy.go('back');\n`; break;
        case 'go_forward': s += `    cy.go('forward');\n`; break;
      }
      s += '\n';
    });
    s += '  });\n});\n';
    return s;
  }

