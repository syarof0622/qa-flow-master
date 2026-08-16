function classifyLogSeverity(type, details = {}) {
  if (type === 'uncaught_exception') return 'CRITICAL';
  if (type === 'network_error') {
    const status = details.status;
    if (status >= 500) return 'HIGH';
    if (status >= 400) return 'MEDIUM';
    return 'HIGH'; // connection refused, timeout
  }
  if (type === 'console_error') return 'MEDIUM';
  if (type === 'console_warn') return 'LOW';
  if (type === 'network_slow') return 'LOW';
  if (type === 'network_request') return 'LOW';
  if (type === 'network_resource' || type === 'network_socket') return 'LOW';
  return 'LOW';
}

function scoreSelector(selector = '', healed = false) {
  const value = String(selector);
  if (!value) return 100;
  let score = 55;
  if (/\[data-(test|testid|qa|cy)=/i.test(value)) score += 35;
  else if (/^#[A-Za-z][\w-]*$/.test(value)) score += 30;
  else if (/\[(aria-label|name|role)=/i.test(value)) score += 20;
  if (/>/.test(value)) score -= Math.min(25, value.split('>').length * 5);
  if (/:nth-(child|of-type)/i.test(value)) score -= 25;
  if (/[A-Za-z0-9_-]{18,}/.test(value)) score -= 10;
  if (healed) score -= 15;
  return Math.max(0, Math.min(100, score));
}

function scoreRecordedStep(step) {
  let score = scoreSelector(step.selector, false);
  if (step.fallbackSelectors?.length) score += 5;
  if (step.recordingIntent?.kind === 'choice') score += 5;
  if (step.smart?.assertionSuggestion) score += 5;
  if (step.action === 'fill' && !step.value) score -= 15;
  return Math.max(20, Math.min(100, score));
}

// ========================================
// TEST SUITE RUNNER
// ========================================
async function runTestSuite(tabId, delayBetweenSteps = 500, stopOnError = true, autoRetryCount = 2, scope = {}, stepsOverride = null) {
  if (qaState.execution.results().status === 'RUNNING') throw new Error('Eksekusi lain masih berjalan. Hentikan atau tunggu sampai selesai.');
  qaState.execution.setControl({ runId: `run_${Date.now()}`, paused: false, cancelled: false });
  runtimeVariables = {};
  const waitForControl = async () => {
    while (qaState.execution.control().paused && !qaState.execution.control().cancelled) await new Promise(resolve => setTimeout(resolve, 100));
    return !qaState.execution.control().cancelled;
  };
  const finishCancelled = () => {
    qaState.execution.patchResults({ status: 'CANCELLED', endTime: new Date().toISOString() });
    saveExecutionToHistory();
    saveState();
    broadcastToSidepanel({ action: 'EXECUTION_FINISHED', results: qaState.execution.results() });
    qaState.execution.setControl({ runId: null, paused: false, cancelled: false });
    return qaState.execution.results();
  };
  const activeSuiteForRun = getActiveSuite();
  const expandFlows = (items, stack = []) => items.flatMap(item => {
    if (item.action !== 'use_flow') return [item];
    const name = String(item.value || item.selector || '');
    if (stack.includes(name)) throw new Error(`Circular reusable flow: ${[...stack, name].join(' -> ')}`);
    const flow = activeSuiteForRun?.flows?.[name];
    if (!Array.isArray(flow)) throw new Error(`Reusable flow tidak ditemukan: ${name}`);
    return expandFlows(flow, [...stack, name]);
  });
  const allSteps = expandFlows(Array.isArray(stepsOverride) ? stepsOverride : getActiveSuiteSteps());
  const activeDataset = qaState.data.datasets().find(dataset => dataset.id === qaState.data.activeDatasetId());
  const startIndex = Math.max(0, parseInt(scope.startIndex, 10) || 0);
  const endIndex = Number.isInteger(scope.endIndex) ? Math.min(allSteps.length - 1, scope.endIndex) : allSteps.length - 1;
  const steps = allSteps.map((step, originalIndex) => ({ ...normalizeStep(step), originalIndex })).filter(step => step.enabled && step.originalIndex >= startIndex && step.originalIndex <= endIndex);
  if (!steps.length) {
    throw new Error("Tidak ada langkah tes yang terdaftar di suite aktif.");
  }

  qaState.execution.setResults({
    status: 'RUNNING',
    suiteId: qaState.suites.activeId(),
    suiteName: getActiveSuite()?.name || 'Unknown',
    datasetName: activeDataset?.name || '',
    datasetRow: activeDataset ? qaState.data.activeDatasetRow() + 1 : null,
    totalSteps: steps.length,
    passedSteps: 0,
    failedSteps: 0,
    slowSteps: 0,
    startTime: new Date().toISOString(),
    endTime: null,
    stepDetails: []
  });
  broadcastToSidepanel({ action: 'EXECUTION_STARTED', results: qaState.execution.results() });

  for (let i = 0; i < steps.length; i++) {
    if (!await waitForControl()) return finishCancelled();
    const step = steps[i];
    const stepIndex = step.originalIndex + 1;
    const stepStartedAt = new Date().toISOString();

    broadcastToSidepanel({ action: 'STEP_EXECUTION_START', stepIndex, sequenceIndex: i + 1, totalSteps: steps.length, step });
    if (step.breakpoint) {
      qaState.execution.setControl({ ...qaState.execution.control(), paused: true, reason: 'breakpoint', stepIndex });
      broadcastToSidepanel({ action: 'EXECUTION_CONTROL_CHANGED', control: { paused: true, cancelled: false, reason: 'breakpoint', stepIndex } });
      if (!await waitForControl()) return finishCancelled();
    }

    try {
      let stepResult = null;
      let attempts = 0;
      const retryReasons = [];
      const maxAttempts = (autoRetryCount || 0) + 1;

      while (attempts < maxAttempts) {
        if (!await waitForControl()) return finishCancelled();
        attempts++;
        const resolvedStep = resolveStepVariables(step);
        if (['assert_no_console_errors', 'assert_network_status', 'assert_screenshot', 'assert_security_headers', 'api_request', 'go_back', 'go_forward'].includes(step.action)) {
          stepResult = await executeBackgroundAssertion(resolvedStep, tabId);
        } else {
          stepResult = await sendStepCommandToTab(tabId, resolvedStep, {
            action: 'EXECUTE_STEP',
            stepIndex,
            step: resolvedStep
          });
        }
        if (stepResult.success) break;
        retryReasons.push(stepResult.error || 'Unknown failure');
        if (attempts < maxAttempts) {
          console.warn(`[QA Flow Master] 🔄 Retrying step #${stepIndex} (Attempt ${attempts}/${maxAttempts})...`);
          await new Promise(r => setTimeout(r, 600));
        }
      }

      let screenshot = null;
      try { screenshot = await captureTabScreenshot(tabId, { highQuality: false }); } catch (e) {}

      const isSlow = (stepResult.duration || 0) > (step.performanceThreshold || 3000);

      const stepEndedAt = new Date().toISOString();
      const evidenceLogs = qaState.logs.all().filter(log => log.timestamp >= stepStartedAt && log.timestamp <= stepEndedAt).slice(0, 25).map(log => ({ id: log.id, timestamp: log.timestamp, type: log.type, severity: log.severity, message: log.message, details: log.details }));
      const selectorHealth = scoreSelector(stepResult.usedSelector || step.selector, Boolean(stepResult.healed));
      const detail = {
        stepIndex,
        stepId: step.id,
        action: step.action,
        selector: step.selector,
        value: step.value,
        description: step.description,
        notes: step.notes || '',
        group: step.group || '',
        status: stepResult.success ? (isSlow ? 'SLOW' : 'PASSED') : 'FAILED',
        error: stepResult.error || null,
        executionTimeMs: stepResult.duration || 0,
        screenshot: screenshot,
        attempts,
        usedSelector: stepResult.usedSelector || null,
        healed: Boolean(stepResult.healed),
        triedSelectors: stepResult.triedSelectors || [],
        expected: stepResult.expected ?? null,
        actual: stepResult.actual ?? null,
        baselineCandidate: stepResult.baselineCandidate || null,
        visualDifference: stepResult.visualDifference ?? null,
        domSnippet: stepResult.domSnippet || '',
        retryReasons,
        startedAt: stepStartedAt,
        timestamp: stepEndedAt,
        evidenceLogs,
        selectorHealth
      };

      if (step.selector) {
        const healing = qaState.qa.selectorHealingHistory();
        healing.unshift({ id: `selector_${Date.now()}_${stepIndex}`, suiteId: qaState.suites.activeId(), stepId: step.id, stepIndex, selector: step.selector, usedSelector: stepResult.usedSelector || step.selector, healed: Boolean(stepResult.healed), score: selectorHealth, timestamp: stepEndedAt });
        if (healing.length > 300) healing.length = 300;
      }

      qaState.execution.results().stepDetails.push(detail);

      if (stepResult.success) {
        qaState.execution.patchResults({ passedSteps: qaState.execution.results().passedSteps + 1, slowSteps: isSlow ? qaState.execution.results().slowSteps + 1 : qaState.execution.results().slowSteps });
      } else {
        qaState.execution.patchResults({ failedSteps: qaState.execution.results().failedSteps + 1 });
        if (stopOnError) {
          qaState.execution.patchResults({ status: 'FAILED', endTime: new Date().toISOString() });
          saveExecutionToHistory();
          saveState();
          broadcastToSidepanel({ action: 'EXECUTION_FINISHED', results: qaState.execution.results() });
          qaState.execution.setControl({ runId: null, paused: false, cancelled: false });
          return qaState.execution.results();
        }
      }
    } catch (err) {
      let screenshot = null;
      try { screenshot = await captureTabScreenshot(tabId, { highQuality: false }); } catch (e) {}

      qaState.execution.patchResults({ failedSteps: qaState.execution.results().failedSteps + 1 });
      qaState.execution.results().stepDetails.push({
        stepIndex,
        stepId: step.id,
        action: step.action,
        selector: step.selector,
        notes: step.notes || '',
        status: 'FAILED',
        error: err.message,
        attempts: 1,
        retryReasons: [err.message],
        screenshot: screenshot,
        startedAt: stepStartedAt,
        timestamp: new Date().toISOString(),
        evidenceLogs: qaState.logs.all().filter(log => log.timestamp >= stepStartedAt).slice(0, 25).map(log => ({ id: log.id, timestamp: log.timestamp, type: log.type, severity: log.severity, message: log.message, details: log.details }))
      });

      if (stopOnError) {
        qaState.execution.patchResults({ status: 'FAILED', endTime: new Date().toISOString() });
        saveExecutionToHistory();
        saveState();
        broadcastToSidepanel({ action: 'EXECUTION_FINISHED', results: qaState.execution.results() });
        qaState.execution.setControl({ runId: null, paused: false, cancelled: false });
        return qaState.execution.results();
      }
    }

    broadcastToSidepanel({ action: 'STEP_EXECUTION_PROGRESS', results: qaState.execution.results() });

    if (i < steps.length - 1) {
      await new Promise(res => setTimeout(res, delayBetweenSteps));
    }
  }

  qaState.execution.patchResults({ status: qaState.execution.results().failedSteps === 0 ? 'COMPLETED' : 'FAILED', endTime: new Date().toISOString() });
  saveExecutionToHistory();
  saveState();
  broadcastToSidepanel({ action: 'EXECUTION_FINISHED', results: qaState.execution.results() });
  qaState.execution.setControl({ runId: null, paused: false, cancelled: false });
  return qaState.execution.results();
}

function resolveStepVariables(step) {
  const environment = qaState.data.environments().find(env => env.id === qaState.data.activeEnvironmentId()) || qaState.data.environments()[0] || { variables: {} };
  const dataset = qaState.data.datasets().find(item => item.id === qaState.data.activeDatasetId());
  const datasetVariables = dataset?.rows?.[qaState.data.activeDatasetRow()] || {};
  const variables = { baseUrl: environment.baseUrl || '', ...(environment.variables || {}), ...datasetVariables, ...runtimeVariables, ...sessionSecrets };
  const interpolate = value => String(value ?? '').replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/g, (match, key) => Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key]) : match);
  return { ...step, selector: interpolate(step.selector), value: interpolate(step.value), fallbackSelectors: (step.fallbackSelectors || []).map(interpolate) };
}

async function executeBackgroundAssertion(step, tabId) {
  const start = Date.now();
  if (step.action === 'api_request') return executeApiRequestStep(step, start);
  if (step.action === 'go_back' || step.action === 'go_forward') {
    // Real browser tab navigation (chrome.tabs API), not a page-JS
    // window.history.back()/forward() call - the latter can be intercepted or
    // overridden by SPA routers (pushState apps often swallow popstate), so it
    // is not reliably "browser-compatible" the way this is.
    try {
      const before = await chrome.tabs.get(tabId);
      if (step.action === 'go_back') await chrome.tabs.goBack(tabId);
      else await chrome.tabs.goForward(tabId);
      const timeout = Math.max(250, Math.min(60000, parseInt(step.timeout, 10) || 8000));
      const deadline = Date.now() + timeout;
      let finalUrl = before.url;
      let status = before.status;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 150));
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        if (!tab) break;
        finalUrl = tab.url;
        status = tab.status;
        if (status === 'complete' && finalUrl !== before.url) break;
      }
      if (finalUrl === before.url) {
        const direction = step.action === 'go_back' ? 'sebelumnya' : 'selanjutnya';
        return { success: false, error: `URL tidak berubah setelah ${step.action} - kemungkinan tidak ada riwayat halaman ${direction} pada tab ini.`, expected: 'URL berubah', actual: finalUrl, duration: Date.now() - start };
      }
      return { success: true, actual: finalUrl, duration: Date.now() - start };
    } catch (error) {
      return { success: false, error: `Navigasi ${step.action === 'go_back' ? 'kembali' : 'maju'} gagal: ${error.message}`, duration: Date.now() - start };
    }
  }
  if (step.action === 'assert_security_headers') {
    try {
      const config = step.value ? JSON.parse(step.value) : {};
      const required = Array.isArray(config.required) && config.required.length ? config.required.map(value => String(value).toLowerCase()) : ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy'];
      const response = await secureFetch(step.selector, { method: 'HEAD', credentials: 'omit' });
      const missing = required.filter(name => !response.headers.has(name));
      if (new URL(step.selector).protocol === 'https:' && config.requireHsts !== false && !response.headers.has('strict-transport-security')) missing.push('strict-transport-security');
      return missing.length ? { success: false, error: `Security headers missing: ${[...new Set(missing)].join(', ')}`, expected: required.join(', '), actual: [...response.headers.keys()].join(', '), duration: Date.now() - start } : { success: true, actual: required.join(', '), duration: Date.now() - start };
    } catch (error) { return { success: false, error: `Security header check failed: ${error.message}`, duration: Date.now() - start }; }
  }
  if (step.action === 'assert_screenshot') {
    const current = await captureTabScreenshot(tabId, { highQuality: true });
    if (!current) return { success: false, error: 'Screenshot tidak tersedia', duration: Date.now() - start };
    let visualConfig = {};
    try { visualConfig = step.value?.trim()?.startsWith('{') ? JSON.parse(step.value) : { threshold: parseFloat(step.value) }; } catch (error) { return { success: false, error: `Konfigurasi visual tidak valid: ${error.message}`, duration: Date.now() - start }; }
    const baseline = qaState.qa.visualBaselines()[step.id];
    if (visualConfig.approveBaseline === true) {
      qaState.qa.setVisualBaseline(step.id, current);
      saveState();
      return { success: true, baselineUpdated: true, duration: Date.now() - start };
    }
    if (!baseline) {
      if (visualConfig.requireApproval === true) return { success: false, error: 'Baseline visual menunggu persetujuan', expected: 'Approved baseline', actual: 'Candidate captured', baselineCandidate: current, duration: Date.now() - start };
      qaState.qa.setVisualBaseline(step.id, current);
      const baselines = qaState.qa.visualBaselines();
      const baselineIds = Object.keys(baselines);
      while (baselineIds.length > 20) delete baselines[baselineIds.shift()];
      saveState();
      return { success: true, baselineCreated: true, duration: Date.now() - start };
    }
    const masks = Array.isArray(visualConfig.ignoreRegions) ? visualConfig.ignoreRegions.slice(0, 50) : [];
    const difference = await compareScreenshots(baseline, current, masks);
    const threshold = Math.max(0, Math.min(100, Number(visualConfig.threshold) || 1));
    return difference <= threshold
      ? { success: true, expected: `<=${threshold}%`, actual: `${difference.toFixed(2)}%`, visualDifference: difference, duration: Date.now() - start }
      : { success: false, error: 'Visual regression terdeteksi', expected: `<=${threshold}%`, actual: `${difference.toFixed(2)}%`, visualDifference: difference, baselineCandidate: current, duration: Date.now() - start };
  }
  if (step.action === 'assert_no_console_errors') {
    const errors = qaState.logs.all().filter(log => ['console_error', 'uncaught_exception'].includes(log.type));
    return errors.length
      ? { success: false, error: `${errors.length} console error ditemukan`, expected: '0', actual: String(errors.length), duration: Date.now() - start }
      : { success: true, duration: Date.now() - start };
  }
  const endpoint = String(step.selector || '');
  const expectedStatus = parseInt(step.value, 10);
  const match = qaState.logs.all().find(log => ['network_error', 'network_slow'].includes(log.type) && (!endpoint || String(log.details?.url || '').includes(endpoint)));
  const actualStatus = match?.details?.status;
  return actualStatus === expectedStatus
    ? { success: true, duration: Date.now() - start }
    : { success: false, error: `Status network tidak sesuai`, expected: String(expectedStatus), actual: actualStatus == null ? 'NOT_CAPTURED' : String(actualStatus), duration: Date.now() - start };
}

async function executeApiRequestStep(step, start = Date.now()) {
  try {
    const config = step.value ? JSON.parse(step.value) : {};
    const url = String(step.selector || config.url || '');
    if (!/^https?:\/\//i.test(url)) throw new Error('API URL harus menggunakan http atau https');
    assertPublicHttpUrl(url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.max(250, Math.min(60000, Number(step.timeout) || 5000)));
    let response;
    try {
      response = await secureFetch(url, {
        method: String(config.method || 'GET').toUpperCase(),
        headers: config.headers && typeof config.headers === 'object' ? config.headers : {},
        body: config.body == null ? undefined : (typeof config.body === 'string' ? config.body : JSON.stringify(config.body)),
        signal: controller.signal,
        cache: 'no-store'
      });
    } finally {
      clearTimeout(timeoutId);
    }
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch (error) {}
    const getJsonPath = (source, path) => String(path || '').replace(/^\$\.?/, '').split('.').filter(Boolean).reduce((current, key) => current?.[key], source);
    const validateSchema = (value, schema, path = '$') => {
      if (!schema || typeof schema !== 'object') return [];
      const errors = [];
      const actualType = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
      if (schema.type && actualType !== schema.type) errors.push(`${path}: expected ${schema.type}, got ${actualType}`);
      if (Array.isArray(schema.enum) && !schema.enum.some(item => JSON.stringify(item) === JSON.stringify(value))) errors.push(`${path}: value is not in enum`);
      if (typeof value === 'string' && schema.pattern) { try { if (!new RegExp(schema.pattern).test(value)) errors.push(`${path}: pattern mismatch`); } catch (error) { errors.push(`${path}: invalid schema pattern`); } }
      if (typeof value === 'number' && schema.minimum != null && value < Number(schema.minimum)) errors.push(`${path}: below minimum`);
      if (typeof value === 'number' && schema.maximum != null && value > Number(schema.maximum)) errors.push(`${path}: above maximum`);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        (schema.required || []).forEach(key => { if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${path}.${key}: required`); });
        Object.entries(schema.properties || {}).forEach(([key, child]) => { if (Object.prototype.hasOwnProperty.call(value, key)) errors.push(...validateSchema(value[key], child, `${path}.${key}`)); });
      }
      if (Array.isArray(value) && schema.items) value.slice(0, 1000).forEach((item, index) => errors.push(...validateSchema(item, schema.items, `${path}[${index}]`)));
      return errors.slice(0, 50);
    };
    if (config.status != null && response.status !== Number(config.status)) {
      return { success: false, error: 'Status API tidak sesuai', expected: String(config.status), actual: String(response.status), duration: Date.now() - start };
    }
    if (config.maxResponseTime != null && Date.now() - start > Number(config.maxResponseTime)) {
      return { success: false, error: 'Response API melebihi batas waktu', expected: `<=${Number(config.maxResponseTime)}ms`, actual: `${Date.now() - start}ms`, duration: Date.now() - start };
    }
    if (config.schema) {
      if (json == null) return { success: false, error: 'Response bukan JSON untuk schema assertion', expected: 'JSON', actual: response.headers.get('content-type') || 'unknown', duration: Date.now() - start };
      const schemaErrors = validateSchema(json, config.schema);
      if (schemaErrors.length) return { success: false, error: `JSON schema gagal: ${schemaErrors[0]}`, expected: 'Schema valid', actual: schemaErrors.join('; '), duration: Date.now() - start };
    }
    for (const assertion of Array.isArray(config.assertions) ? config.assertions : []) {
      const actual = getJsonPath(json, assertion.path);
      if (Object.prototype.hasOwnProperty.call(assertion, 'equals') && JSON.stringify(actual) !== JSON.stringify(assertion.equals)) {
        return { success: false, error: `API assertion gagal: ${assertion.path}`, expected: JSON.stringify(assertion.equals), actual: JSON.stringify(redactLogData(actual)), duration: Date.now() - start };
      }
      if (assertion.exists === true && actual === undefined) {
        return { success: false, error: `API path tidak ditemukan: ${assertion.path}`, expected: 'EXISTS', actual: 'UNDEFINED', duration: Date.now() - start };
      }
    }
    const extracted = {};
    const extractionEntries = Array.isArray(config.extract)
      ? config.extract.map(item => [item.name, item.path])
      : Object.entries(config.extract && typeof config.extract === 'object' ? config.extract : {});
    for (const [name, path] of extractionEntries.slice(0, 50)) {
      if (!/^[a-zA-Z_][\w.-]{0,79}$/.test(String(name || ''))) continue;
      const value = getJsonPath(json, path);
      if (value !== undefined) { runtimeVariables[name] = typeof value === 'object' ? JSON.stringify(value) : String(value); extracted[name] = SENSITIVE_LOG_KEY_RE.test(name) ? '[REDACTED]' : runtimeVariables[name]; }
    }
    return { success: true, expected: config.status == null ? null : String(config.status), actual: String(response.status), extracted, duration: Date.now() - start };
  } catch (error) {
    return { success: false, error: error.name === 'AbortError' ? 'API request timeout' : error.message, duration: Date.now() - start };
  }
}

function assertPublicHttpUrl(value) {
  const url = new URL(String(value || ''));
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('URL harus menggunakan HTTP atau HTTPS');
  if (url.username || url.password) throw new Error('Credential pada URL tidak diizinkan');
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const privateIpv4 = /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
  const privateIpv6 = /^(::|::1$|fc|fd|fe8|fe9|fea|feb)/i;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || privateIpv4.test(host) || privateIpv6.test(host)) throw new Error('Akses API ke private network diblokir');
  return url;
}

async function secureFetch(value, options = {}, maxRedirects = 3) {
  let current = assertPublicHttpUrl(value);
  let requestOptions = { ...options, redirect: 'manual' };
  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    const response = await fetch(current.href, requestOptions);
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    if (redirects === maxRedirects) throw new Error('Terlalu banyak redirect');
    const location = response.headers.get('location');
    if (!location) throw new Error('Redirect tanpa lokasi tujuan');
    const next = assertPublicHttpUrl(new URL(location, current).href);
    if (next.origin !== current.origin) {
      const headers = new Headers(requestOptions.headers || {});
      ['authorization', 'cookie', 'proxy-authorization'].forEach(name => headers.delete(name));
      requestOptions = { ...requestOptions, headers };
    }
    if (response.status === 303 || ((response.status === 301 || response.status === 302) && String(requestOptions.method || 'GET').toUpperCase() === 'POST')) requestOptions = { ...requestOptions, method: 'GET', body: undefined };
    current = next;
  }
  throw new Error('Redirect tidak aman');
}

async function compareScreenshots(baselineUrl, currentUrl, ignoreRegions = []) {
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return 100;
  const [baselineBitmap, currentBitmap] = await Promise.all([
    fetch(baselineUrl).then(response => response.blob()).then(createImageBitmap),
    fetch(currentUrl).then(response => response.blob()).then(createImageBitmap)
  ]);
  if (baselineBitmap.width !== currentBitmap.width || baselineBitmap.height !== currentBitmap.height) return 100;
  const width = baselineBitmap.width;
  const height = baselineBitmap.height;
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(baselineBitmap, 0, 0);
  const baselinePixels = context.getImageData(0, 0, width, height).data;
  context.clearRect(0, 0, width, height);
  context.drawImage(currentBitmap, 0, 0);
  const currentPixels = context.getImageData(0, 0, width, height).data;
  let changed = 0;
  let total = 0;
  for (let index = 0; index < baselinePixels.length; index += 4) {
    const pixel = index / 4;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const ignored = ignoreRegions.some(region => x >= Number(region.x || 0) && x < Number(region.x || 0) + Number(region.width || 0) && y >= Number(region.y || 0) && y < Number(region.y || 0) + Number(region.height || 0));
    if (ignored) continue;
    total++;
    if (Math.abs(baselinePixels[index] - currentPixels[index]) + Math.abs(baselinePixels[index + 1] - currentPixels[index + 1]) + Math.abs(baselinePixels[index + 2] - currentPixels[index + 2]) > 45) changed++;
  }
  baselineBitmap.close();
  currentBitmap.close();
  return total ? (changed / total) * 100 : 0;
}

// ========================================
// EXECUTION HISTORY (P1)
// ========================================
function saveExecutionToHistory() {
  const results = qaState.execution.results();
  const entry = {
    id: 'run_' + Date.now(),
    suiteId: results.suiteId,
    suiteName: results.suiteName,
    datasetName: results.datasetName || '',
    datasetRow: results.datasetRow,
    status: results.status,
    totalSteps: results.totalSteps,
    passedSteps: results.passedSteps,
    failedSteps: results.failedSteps,
    slowSteps: results.slowSteps || 0,
    startTime: results.startTime,
    endTime: results.endTime,
    durationMs: new Date(results.endTime) - new Date(results.startTime),
    stepOutcomes: (results.stepDetails || []).map(detail => ({
      stepId: detail.stepId || `index_${detail.stepIndex}`,
      stepIndex: detail.stepIndex,
      status: detail.status,
      durationMs: detail.executionTimeMs || 0
    }))
  };
  qaState.execution.pushHistory(entry);
}

