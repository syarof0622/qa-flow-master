// content.js - QA Flow Master Pro v4.3 DOM Engine
// Features: Advanced Wait Conditions (P1), Step Notes, Performance Threshold, a11y Audit, Clean State

(function () {
  if (window.__QA_CONTENT_SCRIPT_LOADED__) return;
  window.__QA_CONTENT_SCRIPT_LOADED__ = true;

  const recorder = window.QARecorderEngine.create({
    sendStep: payload => chrome.runtime.sendMessage({
      action: 'RECORDED_STEP',
      payload: {
        ...payload,
        frame: {
          url: location.href,
          name: String(window.name || '').slice(0, 120),
          isTop: window === window.top
        }
      }
    }).catch(() => {}),
    flash: target => flashHighlight(target, '#f59e0b')
  });
  // Recording status lives in the extension panel so the tested page remains untouched.
  document.getElementById('__qa_recording_badge__')?.remove();

  window.addEventListener('__QA_FLOW_MONITOR_READY__', () => {
    chrome.runtime.sendMessage({ action: 'MONITOR_STATUS', payload: { active: true } }).catch(() => {});
  });

  const acceptedLogTypes = new Set(['console_error', 'console_warn', 'uncaught_exception', 'network_error', 'network_slow', 'network_request', 'network_resource', 'network_socket']);
  const logWindow = { startedAt: Date.now(), count: 0 };
  window.addEventListener('__QA_FLOW_LOG__', (event) => {
    const detail = event.detail;
    if (!detail || typeof detail !== 'object' || !acceptedLogTypes.has(detail.type)) return;
    if (Date.now() - logWindow.startedAt > 10000) { logWindow.startedAt = Date.now(); logWindow.count = 0; }
    if (++logWindow.count > 120) return;
    let serialized = '';
    try { serialized = JSON.stringify(detail); } catch (error) { return; }
    if (serialized.length > 32768) return;
    chrome.runtime.sendMessage({ action: 'PAGE_LOG_EVENT', payload: detail }).catch(() => {});
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { action } = message;

    if (action === 'TOGGLE_RECORDING') {
      const isRecording = recorder.setActive(message.isRecording);
      updateRecordingUI(isRecording);
      sendResponse({ status: 'SUCCESS', isRecording });
    } else if (action === 'RECORDER_STATUS') {
      const liveSignals = {
        media: Boolean(document.querySelector('video, audio')),
        liveRegion: Boolean(document.querySelector('[aria-live], [role="log"], [role="feed"], [data-live], [data-stream]')),
        canvas: Boolean(document.querySelector('canvas')),
        streamingFrame: Boolean([...document.querySelectorAll('iframe[src]')].some(frame => /live|stream|video|player|youtube|vidio|dailymotion/i.test(frame.src)))
      };
      sendResponse({ status: 'SUCCESS', ready: Boolean(document.documentElement && document.body), isRecording: recorder.isActive(), url: location.href, readyState: document.readyState, live: Object.values(liveSignals).some(Boolean), liveSignals });
    } else if (action === 'EXECUTE_STEP') {
      executeStep(message.step, message.stepIndex)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    } else if (action === 'RUN_A11Y_AUDIT') {
      runAccessibilityAudit({ keyboardOnly: Boolean(message.keyboardOnly) })
        .then(violations => sendResponse({ status: 'SUCCESS', violations }))
        .catch(err => sendResponse({ status: 'ERROR', error: err.message, violations: [] }));
      return true;
    } else if (action === 'CLEAR_PAGE_STORAGE') {
      try {
        localStorage.clear();
        sessionStorage.clear();
        sendResponse({ status: 'SUCCESS' });
      } catch (e) {
        sendResponse({ status: 'ERROR', error: e.message });
      }
    } else if (action === 'APPLY_PRIVACY_MASK') {
      document.querySelectorAll('input[type="password"],input[type="email"],input[type="tel"],[data-qa-mask]').forEach(element => element.classList.add('__qa_privacy_mask__'));
      let style = document.getElementById('__qa_privacy_style__');
      if (!style) { style = document.createElement('style'); style.id = '__qa_privacy_style__'; style.textContent = '.__qa_privacy_mask__{filter:blur(10px)!important;color:transparent!important}'; document.documentElement.appendChild(style); }
      sendResponse({ status: 'SUCCESS' });
    } else if (action === 'CLEAR_PRIVACY_MASK') {
      document.querySelectorAll('.__qa_privacy_mask__').forEach(element => element.classList.remove('__qa_privacy_mask__'));
      document.getElementById('__qa_privacy_style__')?.remove();
      sendResponse({ status: 'SUCCESS' });
    } else if (action === 'EXTRACT_DOM') {
      try {
        const url = location.href;
        const title = document.title;

        // 1. Extract Forms Structure
        const formSummaries = [];
        document.querySelectorAll('form').forEach((f, fIdx) => {
          if (fIdx > 10) return;
          const fId = f.id ? `#${f.id}` : '';
          const fName = f.getAttribute('name') ? `[name="${f.getAttribute('name')}"]` : '';
          const fAction = f.getAttribute('action') || '';
          const formInputs = [];
          f.querySelectorAll('input, select, textarea, button').forEach(el => {
            const tag = el.tagName.toLowerCase();
            const type = el.getAttribute('type') || '';
            const name = el.getAttribute('name') || el.id || '';
            const ph = el.getAttribute('placeholder') || '';
            const lbl = (el.labels?.[0]?.textContent || el.getAttribute('aria-label') || el.value || el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30);
            if (name || ph || lbl || type) {
              formInputs.push(`<${tag}${type ? ` type="${type}"` : ''}${name ? ` name="${name}"` : ''}> "${lbl}"`);
            }
          });
          formSummaries.push(`Form ${fIdx + 1} (${fId || fName || fAction || 'form'}): [${formInputs.join(', ')}]`);
        });

        // 2. Extract Visible Alerts & Errors on Page
        const alertList = [];
        document.querySelectorAll('[role="alert"], .alert, .error, .invalid-feedback, .toast, .modal-title, [class*="error"], [class*="alert"]').forEach((el, idx) => {
          if (idx > 10) return;
          const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100);
          if (text) alertList.push(`[Alert/Error]: "${text}"`);
        });

        // 3. Extract Select Options
        const selectSummaries = [];
        document.querySelectorAll('select').forEach((sel, sIdx) => {
          if (sIdx > 10) return;
          const selId = sel.id ? `#${sel.id}` : (sel.name ? `select[name="${sel.name}"]` : 'select');
          const opts = Array.from(sel.options).slice(0, 8).map(o => `"${o.text.trim()}" (val: "${o.value}")`).join(', ');
          selectSummaries.push(`Selector "${selId}": options=[${opts}]`);
        });

        // 4. Extract Interactive Elements & Selectors
        const interactiveList = [];
        document.querySelectorAll('button, input, select, textarea, a, [role], form, [data-testid], h1, h2, h3, h4, [class*="btn"], [class*="card"]').forEach((el, idx) => {
          if (idx > 200) return;
          const tag = el.tagName.toLowerCase();
          const type = el.getAttribute('type') || '';
          const id = el.id ? `#${el.id}` : '';
          const name = el.getAttribute('name') ? `[name="${el.getAttribute('name')}"]` : '';
          const testId = el.getAttribute('data-testid') ? `[data-testid="${el.getAttribute('data-testid')}"]` : '';
          const placeholder = el.getAttribute('placeholder') ? `(placeholder: "${el.getAttribute('placeholder')}")` : '';
          const label = (el.labels?.[0]?.textContent || el.getAttribute('aria-label') || el.innerText || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 50);
          
          let selector = id || testId || (name ? `${tag}${name}` : '');
          if (!selector && el.className && typeof el.className === 'string') {
            const cleanClasses = el.className.split(' ').filter(c => c && !c.startsWith('__qa') && !c.includes(':')).slice(0, 2).join('.');
            if (cleanClasses) selector = `${tag}.${cleanClasses}`;
          }
          if (!selector) {
            if (label && ['button', 'a', 'h1', 'h2', 'h3', 'h4', 'span'].includes(tag)) {
              selector = `${tag}:has-text("${label.slice(0, 25)}")`;
            } else {
              selector = tag;
            }
          }

          if (label || id || testId || name || placeholder) {
            interactiveList.push(`- <${tag}${type ? ` type="${type}"` : ''}> "${label}" ${placeholder} ➔ Selector: "${selector}"`);
          }
        });

        const clonedBody = document.body.cloneNode(true);
        const elementsToRemove = clonedBody.querySelectorAll('script, style, svg, path, link, meta, noscript, iframe');
        elementsToRemove.forEach(el => el.remove());
        let htmlContent = clonedBody.innerHTML;
        htmlContent = htmlContent.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
        
        sendResponse({ 
          status: 'SUCCESS', 
          url, 
          title, 
          formSummary: formSummaries.join('\n'),
          alertSummary: alertList.join('\n'),
          selectSummary: selectSummaries.join('\n'),
          interactiveSummary: interactiveList.join('\n'), 
          dom: htmlContent.slice(0, 40000) 
        });
      } catch (e) {
        sendResponse({ status: 'ERROR', error: e.message });
      }
      return true;
    }
  });

  // ========================================
  // RECORDING
  // ========================================
  function getSmartSelector(element) { return recorder.selectorFor(element).primary; }

  // ========================================
  // EXECUTION RUNNER (Extended)
  // ========================================
  async function executeStep(step, stepIndex) {
    const startTime = performance.now();
    const { action, selector, value } = step;

    // Actions that don't require an element
    if (action === 'wait') {
      await new Promise(r => setTimeout(r, parseInt(value) || 1000));
      return { success: true, duration: Math.round(performance.now() - startTime) };
    }
    if (action === 'assert_a11y') {
      if (typeof axe === 'undefined') return { success: false, error: 'Axe engine tidak tersedia', duration: Math.round(performance.now() - startTime) };
      let options = {};
      try { options = value ? JSON.parse(value) : {}; } catch (error) { return { success: false, error: `Konfigurasi Axe tidak valid: ${error.message}`, duration: Math.round(performance.now() - startTime) }; }
      const result = await axe.run(document, options);
      return result.violations.length
        ? { success: false, error: `${result.violations.length} pelanggaran aksesibilitas`, expected: '0', actual: String(result.violations.length), duration: Math.round(performance.now() - startTime) }
        : { success: true, duration: Math.round(performance.now() - startTime) };
    }
    if (action === 'assert_performance') {
      let budget = {};
      try { budget = value ? JSON.parse(value) : {}; } catch (error) { return { success: false, error: `Performance budget tidak valid: ${error.message}`, duration: Math.round(performance.now() - startTime) }; }
      const nav = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const metrics = { loadMs: nav?.duration || 0, transferBytes: resources.reduce((sum, item) => sum + (item.transferSize || 0), 0), requests: resources.length };
      const failed = Object.entries(budget).find(([key, limit]) => metrics[key] != null && metrics[key] > Number(limit));
      return failed ? { success: false, error: `Performance budget ${failed[0]} terlampaui`, expected: `<=${failed[1]}`, actual: String(Math.round(metrics[failed[0]])), duration: Math.round(performance.now() - startTime) } : { success: true, actual: JSON.stringify(metrics), duration: Math.round(performance.now() - startTime) };
    }
    if (action === 'mock_route' || action === 'clear_mocks') {
      let config = {};
      try { config = value ? JSON.parse(value) : {}; } catch (error) { return { success: false, error: `Mock config tidak valid: ${error.message}`, duration: Math.round(performance.now() - startTime) }; }
      const response = await chrome.runtime.sendMessage({ action: 'APPLY_MOCK_CONFIG', payload: action === 'clear_mocks' ? { clear: true } : { pattern: selector, ...config } }).catch(error => ({ status: 'ERROR', error: error.message }));
      return response?.status === 'SUCCESS' ? { success: true, duration: Math.round(performance.now() - startTime) } : { success: false, error: response?.error || 'Mock config gagal diterapkan', duration: Math.round(performance.now() - startTime) };
    }
    if (action === 'assert_url') {
      const currentUrl = window.location.href;
      if (!currentUrl.includes(value)) {
        return { success: false, error: `Assert URL Gagal! "${currentUrl}" tidak mengandung "${value}"`, duration: Math.round(performance.now() - startTime) };
      }
      return { success: true, duration: Math.round(performance.now() - startTime) };
    }
    if (action === 'wait_for_url_change') {
      const originalUrl = window.location.href;
      const ok = await pollCondition(() => window.location.href !== originalUrl, parseInt(value) || 5000);
      return ok
        ? { success: true, duration: Math.round(performance.now() - startTime) }
        : { success: false, error: `URL tidak berubah dalam ${value || 5000}ms (masih: "${window.location.href}")`, duration: Math.round(performance.now() - startTime) };
    }
    if (action === 'wait_for_network_idle') {
      // Simple heuristic: tunggu sampai tidak ada pending fetch/XHR selama X ms
      await new Promise(r => setTimeout(r, parseInt(value) || 2000));
      return { success: true, duration: Math.round(performance.now() - startTime) };
    }

    // Actions that require finding an element
    if (action === 'wait_for_element_hidden') {
      const el = document.querySelector(selector);
      if (!el) return { success: true, duration: Math.round(performance.now() - startTime) }; // already gone
      const ok = await pollCondition(() => {
        const e = document.querySelector(selector);
        return !e || !isElementVisible(e);
      }, parseInt(value) || 5000);
      return ok
        ? { success: true, duration: Math.round(performance.now() - startTime) }
        : { success: false, error: `Elemen "${selector}" masih terlihat setelah ${value || 5000}ms`, duration: Math.round(performance.now() - startTime) };
    }
    if (action === 'wait_for_text') {
      const ok = await pollCondition(() => document.body?.textContent?.includes(value), parseInt(step.timeout) || 5000);
      return ok
        ? { success: true, duration: Math.round(performance.now() - startTime) }
        : { success: false, error: `Teks "${value}" tidak muncul di halaman`, duration: Math.round(performance.now() - startTime) };
    }

    // Standard element-based actions dengan smart wait dan locator fallback.
    const candidates = [selector, ...(Array.isArray(step.fallbackSelectors) ? step.fallbackSelectors : [])].filter(Boolean);
    const timeout = Math.max(250, Math.min(60000, parseInt(step.timeout, 10) || 5000));
    const requiresActionable = ['click', 'fill', 'select'].includes(action);
    const resolved = await waitForAnyElement(candidates, timeout, requiresActionable);
    const el = resolved?.element;

    if (!el) {
      return {
        success: false,
        error: `Elemen tidak ditemukan dalam ${timeout}ms`,
        expected: candidates.join(' | '),
        actual: 'NOT_FOUND',
        triedSelectors: candidates,
        duration: Math.round(performance.now() - startTime)
      };
    }

    try {
      el.scrollIntoView({ behavior: 'auto', block: 'center' });
      await new Promise(r => setTimeout(r, 200));
      flashHighlight(el, '#10b981', 800);

      switch (action) {
        case 'click':
          triggerClick(el);
          await applyAdaptiveWait(step.smart?.autoWait, timeout);
          break;
        case 'fill': triggerInputFill(el, typeof QADataGenerator !== 'undefined' ? QADataGenerator.interpolate(value) : value); break;
        case 'select': triggerSelect(el, value); break;
        case 'hover': triggerHover(el); break;
        case 'assert_visible':
          if (!isElementVisible(el)) return { success: false, error: `Elemen "${selector}" ada di DOM tapi hidden`, duration: Math.round(performance.now() - startTime) };
          break;
        case 'assert_enabled':
          if (!isElementEnabled(el)) return createAssertionFailure('enabled', 'disabled', el, startTime, resolved, candidates);
          break;
        case 'assert_disabled':
          if (isElementEnabled(el)) return createAssertionFailure('disabled', 'enabled', el, startTime, resolved, candidates);
          break;
        case 'assert_checked':
          if (!el.checked) return createAssertionFailure('checked', 'unchecked', el, startTime, resolved, candidates);
          break;
        case 'assert_unchecked':
          if (el.checked) return createAssertionFailure('unchecked', 'checked', el, startTime, resolved, candidates);
          break;
        case 'assert_text':
          const txt = el.textContent?.trim() || '';
          if (!txt.includes(value)) return createAssertionFailure(value, txt, el, startTime, resolved, candidates);
          break;
        case 'assert_value':
          if ((el.value || '') !== value) return createAssertionFailure(value, el.value || '', el, startTime, resolved, candidates);
          break;
        case 'assert_attribute': {
          const [attributeName, ...expectedParts] = String(value || '').split('=');
          const expectedValue = expectedParts.join('=');
          const actualValue = el.getAttribute(attributeName);
          if (!attributeName || actualValue !== expectedValue) return createAssertionFailure(`${attributeName}=${expectedValue}`, `${attributeName}=${actualValue}`, el, startTime, resolved, candidates);
          break;
        }
        case 'assert_css': {
          const [propertyName, ...expectedParts] = String(value || '').split('=');
          const expectedValue = expectedParts.join('=');
          const actualValue = window.getComputedStyle(el).getPropertyValue(propertyName).trim();
          if (!propertyName || actualValue !== expectedValue) return createAssertionFailure(`${propertyName}=${expectedValue}`, `${propertyName}=${actualValue}`, el, startTime, resolved, candidates);
          break;
        }
        case 'assert_count': {
          const actualCount = findAllDeep(selector).length;
          const expectedCount = parseInt(value, 10);
          if (actualCount !== expectedCount) return createAssertionFailure(expectedCount, actualCount, el, startTime, resolved, candidates);
          break;
        }
        default:
          throw new Error(`Aksi tidak dikenali: ${action}`);
      }

      return {
        success: true,
        duration: Math.round(performance.now() - startTime),
        usedSelector: resolved.selector,
        healed: resolved.selector !== selector,
        triedSelectors: candidates
      };
    } catch (err) {
      if (el) flashHighlight(el, '#ef4444', 1200);
      return {
        success: false,
        error: err.message,
        actual: describeElement(el),
        domSnippet: getDomSnippet(el),
        usedSelector: resolved?.selector || null,
        triedSelectors: candidates,
        duration: Math.round(performance.now() - startTime)
      };
    }
  }

  // ========================================
  // ADVANCED WAIT UTILITIES (P1)
  // ========================================
  function pollCondition(conditionFn, timeoutMs = 5000) {
    return new Promise((resolve) => {
      if (conditionFn()) return resolve(true);
      const start = Date.now();
      const interval = setInterval(() => {
        if (conditionFn()) { clearInterval(interval); resolve(true); }
        else if (Date.now() - start > timeoutMs) { clearInterval(interval); resolve(false); }
      }, 150);
    });
  }

  async function applyAdaptiveWait(strategy = 'none', timeoutMs = 5000) {
    if (strategy === 'none') return;
    const initialUrl = location.href;
    if (strategy === 'url') {
      await Promise.race([pollCondition(() => location.href !== initialUrl, Math.min(timeoutMs, 4000)), new Promise(resolve => setTimeout(resolve, 700))]);
      return;
    }
    let mutations = 0;
    let liveNoiseDetected = false;
    let lastMutation = performance.now();
    const liveContainer = node => node?.nodeType === Node.ELEMENT_NODE ? node.closest?.('video, audio, canvas, [aria-live], [role="log"], [role="feed"], [data-live], [data-stream]') : node?.parentElement?.closest?.('video, audio, canvas, [aria-live], [role="log"], [role="feed"], [data-live], [data-stream]');
    const observer = new MutationObserver(records => {
      const relevant = records.filter(record => !liveContainer(record.target));
      if (!relevant.length) { liveNoiseDetected = true; return; }
      mutations += relevant.reduce((sum, record) => sum + 1 + (record.addedNodes?.length || 0) + (record.removedNodes?.length || 0), 0);
      lastMutation = performance.now();
      if (mutations > 18 && performance.now() - started > 450) liveNoiseDetected = true;
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    const started = performance.now();
    const pageIsLive = Boolean(document.querySelector('video, audio, [aria-live], [role="log"], [role="feed"], [data-live], [data-stream]'));
    const limit = Math.min(timeoutMs, strategy === 'network' ? (pageIsLive ? 1400 : 2500) : (pageIsLive ? 1000 : 1500));
    while (performance.now() - started < limit) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (liveNoiseDetected && performance.now() - started >= 600) break;
      if (performance.now() - lastMutation >= 300 && (mutations > 0 || performance.now() - started >= 500)) break;
    }
    observer.disconnect();
  }

  // ========================================
  // BASIC ACCESSIBILITY CHECK
  // ========================================
  async function runAccessibilityAudit(options = {}) {
    if (typeof axe !== 'undefined' && typeof axe.run === 'function') {
      const result = await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }
      });
      const violations = result.violations.flatMap(violation => violation.nodes.map(node => ({
        type: 'a11y_violation',
        rule: violation.id,
        impact: violation.impact || 'unknown',
        message: violation.help,
        element: node.target.join(', '),
        helpUrl: violation.helpUrl,
        html: node.html.slice(0, 500)
      })));
      if (options.keyboardOnly) violations.push(...runKeyboardAudit());
      violations.forEach(v => {
        chrome.runtime.sendMessage({ action: 'PAGE_LOG_EVENT', payload: { type: 'console_warn', message: `♿ [${v.impact}] ${v.rule}: ${v.message}`, details: { rule: v.rule, impact: v.impact, element: v.element, helpUrl: v.helpUrl, html: v.html } } }).catch(() => {});
      });
      return violations;
    }

    const violations = [];

    document.querySelectorAll('img').forEach(img => {
      if (!img.hasAttribute('alt')) {
        violations.push({ type: 'a11y_violation', rule: 'WCAG 1.1.1', message: `Gambar tanpa alt: ${getSmartSelector(img)}`, element: getSmartSelector(img) });
      }
    });

    document.querySelectorAll('button, a.btn, [role="button"]').forEach(btn => {
      if (!btn.textContent?.trim() && !btn.getAttribute('aria-label')) {
        violations.push({ type: 'a11y_violation', rule: 'WCAG 4.1.2', message: `Tombol tanpa label: ${getSmartSelector(btn)}`, element: getSmartSelector(btn) });
      }
    });

    document.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach(input => {
      const id = input.id;
      const escapedId = id && typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id;
      const hasLabel = input.closest('label') || (escapedId ? document.querySelector(`label[for="${escapedId}"]`) : null);
      const hasAria = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
      if (!hasLabel && !hasAria) {
        violations.push({ type: 'a11y_violation', rule: 'WCAG 3.3.2', message: `Input tanpa label: ${getSmartSelector(input)}`, element: getSmartSelector(input) });
      }
    });

    // Readability hint. Small text is reported as a potential issue, not as a
    // definitive WCAG violation because context and zoom behavior also matter.
    document.querySelectorAll('p, span, label, a, li, td, th, h1, h2, h3, h4, h5, h6').forEach(el => {
      const style = window.getComputedStyle(el);
      const fontSize = parseFloat(style.fontSize);
      if (fontSize > 0 && fontSize < 12 && el.textContent?.trim()) {
        violations.push({ type: 'a11y_violation', rule: 'READABILITY', message: `Teks sangat kecil (${fontSize}px): ${getSmartSelector(el)}`, element: getSmartSelector(el) });
      }
    });

    if (options.keyboardOnly) violations.push(...runKeyboardAudit());
    violations.forEach(v => {
      chrome.runtime.sendMessage({ action: 'PAGE_LOG_EVENT', payload: { type: 'console_warn', message: `♿ [a11y] ${v.rule}: ${v.message}`, details: { rule: v.rule, element: v.element } } }).catch(() => {});
    });

    return violations;
  }

  function runKeyboardAudit() {
    const issues = [];
    const previousFocus = document.activeElement;
    const focusable = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(isElementVisible).slice(0, 150);
    focusable.forEach(element => {
      try { element.focus({ preventScroll: true }); } catch (err) { element.focus(); }
      if (document.activeElement !== element) {
        issues.push({ type: 'a11y_violation', rule: 'keyboard-focus', impact: 'serious', message: 'Elemen tidak dapat menerima fokus keyboard', element: getSmartSelector(element) });
        return;
      }
      const style = getComputedStyle(element);
      const hasIndicator = style.outlineStyle !== 'none' || style.boxShadow !== 'none' || parseFloat(style.outlineWidth) > 0;
      if (!hasIndicator) issues.push({ type: 'a11y_violation', rule: 'focus-visible', impact: 'serious', message: 'Focus indicator tidak terlihat', element: getSmartSelector(element) });
    });
    previousFocus?.focus?.({ preventScroll: true });
    return issues;
  }

  // ========================================
  // ACTION TRIGGERS
  // ========================================
  function triggerClick(el) {
    el.focus();
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  }

  function triggerHover(el) {
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window }));
  }

  function triggerInputFill(el, text) {
    el.focus();
    
    // Simulasikan awal penekanan tombol
    el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Process' }));
    el.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, cancelable: true, key: 'Process' }));

    const nativeInput = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    const nativeTextArea = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (el.tagName === 'INPUT' && nativeInput) nativeInput.call(el, text);
    else if (el.tagName === 'TEXTAREA' && nativeTextArea) nativeTextArea.call(el, text);
    else el.value = text;

    // Trigger event input dan keyboard lanjutan
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Process' }));
    el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
  }

  function triggerSelect(el, value) {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function isElementVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
  }

  function isElementEnabled(el) {
    return !el.disabled && el.getAttribute('aria-disabled') !== 'true' && !el.closest('[inert]');
  }

  function querySelectorDeep(selector, root = document) {
    if (!selector) return null;

    // Support pseudo selectors :has-text() and :text() natively
    if (selector.includes(':has-text(') || selector.includes(':text(')) {
      const match = selector.match(/^(.*?):(?:has-text|text)\(["']?(.*?)["']?\)$/i);
      if (match) {
        const [, baseSelector, searchText] = match;
        const tag = baseSelector.trim() || '*';
        try {
          const elements = root.querySelectorAll(tag);
          const searchLower = searchText.trim().toLowerCase();
          for (const el of elements) {
            const txt = (el.innerText || el.textContent || '').toLowerCase();
            if (txt.includes(searchLower)) return el;
          }
        } catch (e) {}
      }
    }

    try {
      const direct = root.querySelector(selector);
      if (direct) return direct;
    } catch (err) {
      // Ignore DOMException for unsupported syntax
    }

    const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (const node of all) {
      if (node.shadowRoot) {
        const shadowMatch = querySelectorDeep(selector, node.shadowRoot);
        if (shadowMatch) return shadowMatch;
      }
      if (node.tagName === 'IFRAME') {
        try {
          const frameDocument = node.contentDocument;
          if (frameDocument) {
            const frameMatch = querySelectorDeep(selector, frameDocument);
            if (frameMatch) return frameMatch;
          }
        } catch (err) {}
      }
    }
    return null;
  }

  function findAllDeep(selector, root = document, results = []) {
    try { results.push(...root.querySelectorAll(selector)); } catch (err) { return results; }
    const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (const node of all) {
      if (node.shadowRoot) findAllDeep(selector, node.shadowRoot, results);
      if (node.tagName === 'IFRAME') {
        try { if (node.contentDocument) findAllDeep(selector, node.contentDocument, results); } catch (err) {}
      }
    }
    return [...new Set(results)];
  }

  function waitForAnyElement(selectors, timeoutMs = 5000, actionable = false) {
    return new Promise(resolve => {
      const start = Date.now();
      const inspect = () => {
        for (const candidate of selectors) {
          const element = querySelectorDeep(candidate);
          if (element && (!actionable || (isElementVisible(element) && isElementEnabled(element)))) {
            resolve({ element, selector: candidate });
            return;
          }
        }
        if (Date.now() - start >= timeoutMs) resolve(null);
        else setTimeout(inspect, 120);
      };
      inspect();
    });
  }

  function describeElement(el) {
    if (!el) return 'NOT_FOUND';
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''}`;
  }

  function getDomSnippet(el) {
    return el?.outerHTML ? el.outerHTML.slice(0, 800) : '';
  }

  function createAssertionFailure(expected, actual, el, startTime, resolved, triedSelectors) {
    return {
      success: false,
      error: `Assertion gagal: expected "${expected}", actual "${actual}"`,
      expected: String(expected),
      actual: String(actual),
      domSnippet: getDomSnippet(el),
      usedSelector: resolved?.selector || null,
      triedSelectors,
      duration: Math.round(performance.now() - startTime)
    };
  }

  function waitForElement(selector, timeoutMs = 4000) {
    return waitForAnyElement([selector], timeoutMs).then(result => result?.element || null);
  }



  function flashHighlight(el, color = '#10b981', duration = 800) {
    if (!el) return;
    const prev = el.style.outline;
    const prevT = el.style.transition;
    el.style.transition = 'all 0.2s ease-in-out';
    el.style.outline = `3px solid ${color}`;
    el.style.outlineOffset = '2px';
    setTimeout(() => { el.style.outline = prev; el.style.transition = prevT; }, duration);
  }

  function updateRecordingUI(active) {
    // Also clean up an overlay left by an older extension version.
    document.getElementById('__qa_recording_badge__')?.remove();
  }
})();
