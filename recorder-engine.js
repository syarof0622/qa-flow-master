// Isolated recorder domain: event capture, selector generation, debounce and secret-safe values.
(function initRecorderEngine(global) {
  function create({ sendStep, flash, debounceMs = 450 }) {
    let active = false;
    const pendingInputs = new Map();
    const lastRecordedValues = new WeakMap();

    const ignored = element => !element || element.closest?.('[data-qa-recorder-ignore]');
    const selectorFor = element => {
      if (!element || element.nodeType !== Node.ELEMENT_NODE) return { primary: '', fallbacks: [] };
      const candidates = [];
      const attribute = ['data-testid', 'data-test-id', 'data-cy'].find(name => element.hasAttribute(name));
      if (attribute) candidates.push(`[${attribute}="${CSS.escape(element.getAttribute(attribute))}"]`);
      if (element.id && !/\d{5,}/.test(element.id)) candidates.push(`#${CSS.escape(element.id)}`);
      if (element.getAttribute('name')) candidates.push(`${element.tagName.toLowerCase()}[name="${CSS.escape(element.getAttribute('name'))}"]`);
      if (element.getAttribute('aria-label')) candidates.push(`[aria-label="${CSS.escape(element.getAttribute('aria-label'))}"]`);
      if (element.getAttribute('placeholder')) candidates.push(`[placeholder="${CSS.escape(element.getAttribute('placeholder'))}"]`);
      const path = [];
      let current = element;
      for (let depth = 0; current && current.nodeType === Node.ELEMENT_NODE && current.tagName !== 'BODY' && depth < 3; depth++) {
        let selector = current.tagName.toLowerCase();
        if (current.id && !/\d{5,}/.test(current.id)) { path.unshift(`${selector}#${CSS.escape(current.id)}`); break; }
        let position = 1;
        for (let sibling = current.previousElementSibling; sibling; sibling = sibling.previousElementSibling) if (sibling.tagName === current.tagName) position++;
        if (position > 1) selector += `:nth-of-type(${position})`;
        path.unshift(selector);
        current = current.parentElement;
      }
      const domPath = path.join(' > ');
      if (domPath && !candidates.includes(domPath)) candidates.push(domPath);
      return { primary: candidates[0] || domPath || element.tagName.toLowerCase(), fallbacks: candidates.slice(1) };
    };

    const intentFor = (element, selector) => {
      const role = element.getAttribute?.('role') || '';
      if (element.matches?.('input[type="radio"]')) {
        const formKey = element.form?.id || element.form?.getAttribute?.('name') || 'page';
        return { kind: 'choice', group: `radio:${formKey}:${element.name || selector}` };
      }
      if (role === 'tab') {
        const group = element.closest('[role="tablist"]');
        return { kind: 'choice', group: `tab:${group ? selectorFor(group).primary : 'page'}` };
      }
      if (['option', 'menuitem', 'menuitemradio'].includes(role)) {
        const group = element.closest('[role="listbox"],[role="menu"]');
        return { kind: 'choice', group: `${role}:${group ? selectorFor(group).primary : 'page'}` };
      }
      if (element.matches?.('input[type="checkbox"],[role="switch"],[aria-pressed]')) return { kind: 'toggle', group: selector };
      return { kind: 'commit', group: '' };
    };

    const smartFor = (element, selector) => {
      const tag = element.tagName?.toLowerCase() || '';
      const role = element.getAttribute?.('role') || '';
      const href = element.getAttribute?.('href') || '';
      const actionName = `${element.textContent || ''} ${element.getAttribute?.('aria-label') || ''} ${element.id || ''}`;
      const submits = tag === 'button' && (element.type === 'submit' || element.closest('form') || /(save|simpan|submit|kirim|login|masuk|checkout|bayar|confirm|konfirmasi)/i.test(actionName));
      const autoWait = href && !href.startsWith('#') ? 'url' : submits ? 'network' : 'dom';
      let assertionSuggestion = null;
      if (role === 'tab') assertionSuggestion = { action: 'assert_attribute', selector, value: 'aria-selected=true', reason: 'Pastikan tab terpilih' };
      else if (element.matches?.('input[type="checkbox"],[role="switch"]')) assertionSuggestion = { action: element.checked ? 'assert_checked' : 'assert_unchecked', selector, value: '', reason: 'Pastikan status kontrol' };
      else if (href && !href.startsWith('#')) assertionSuggestion = { action: 'assert_url', selector: '', value: href, reason: 'Pastikan navigasi berhasil' };
      return { autoWait, assertionSuggestion, reviewStatus: 'pending' };
    };

    const clearPending = target => {
      const timer = pendingInputs.get(target);
      if (timer) clearTimeout(timer);
      pendingInputs.delete(target);
    };
    const recordValue = target => {
      if (ignored(target)) return;
      const { primary: selector, fallbacks } = selectorFor(target);
      const secret = target.type === 'password' || /(password|passwd|token|secret|otp|pin)/i.test(`${target.name || ''} ${target.id || ''} ${target.autocomplete || ''}`);
      const raw = target.isContentEditable ? target.textContent : target.value;
      const value = secret ? '{{password_secret}}' : String(raw ?? '');
      const action = target.tagName === 'SELECT' ? 'select' : 'fill';
      const signature = `${action}|${selector}|${value}`;
      if (lastRecordedValues.get(target) === signature) return;
      lastRecordedValues.set(target, signature);
      flash(target);
      const assertionSuggestion = { action: 'assert_value', selector, value, reason: 'Pastikan nilai tersimpan' };
      sendStep({ action, selector, fallbackSelectors: fallbacks, value, originalRecordedValue: secret ? '' : value, description: secret ? `Isi data rahasia pada ${selector}` : action === 'select' ? `Pilih opsi "${value}" pada ${selector}` : `Isi "${value}" pada ${selector}`, smart: { autoWait: 'dom', assertionSuggestion: secret ? null : assertionSuggestion, reviewStatus: 'pending' }, timestamp: new Date().toISOString() });
    };
    const flush = () => [...pendingInputs.keys()].forEach(target => { clearPending(target); recordValue(target); });

    const onClick = event => {
      if (!active) return;
      const target = event.target?.closest?.('button,a,[role="button"],[role="tab"],[role="option"],[role="menuitem"],[role="menuitemradio"],[role="switch"],input,select,textarea,summary');
      if (!target) return; // Ignore layout/dead-area clicks that do not express user intent.
      if (ignored(target) || target.matches?.('textarea,select,[contenteditable="true"],input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"])')) return;
      const { primary: selector, fallbacks } = selectorFor(target);
      const text = target.textContent?.trim().substring(0, 30) || '';
      flash(target);
      sendStep({ action: 'click', selector, fallbackSelectors: fallbacks, value: '', description: text ? `Klik "${text}" (${selector})` : `Klik ${selector}`, recordingIntent: intentFor(target, selector), smart: smartFor(target, selector), timestamp: new Date().toISOString() });
    };
    const onChange = event => {
      if (!active || ignored(event.target) || event.target.matches?.('input[type="checkbox"],input[type="radio"]')) return;
      clearPending(event.target);
      recordValue(event.target);
    };
    const onInput = event => {
      const target = event.target;
      if (!active || ignored(target) || !target?.matches?.('input:not([type="checkbox"]):not([type="radio"]),textarea,[contenteditable="true"]')) return;
      clearPending(target);
      pendingInputs.set(target, setTimeout(() => { pendingInputs.delete(target); recordValue(target); }, debounceMs));
    };
    const onFocusOut = event => { if (active && pendingInputs.has(event.target)) { clearPending(event.target); recordValue(event.target); } };

    document.addEventListener('click', onClick, true);
    document.addEventListener('change', onChange, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('focusout', onFocusOut, true);
    return {
      setActive(value) { if (!value) flush(); active = Boolean(value); return active; },
      isActive() { return active; },
      selectorFor,
      destroy() { flush(); document.removeEventListener('click', onClick, true); document.removeEventListener('change', onChange, true); document.removeEventListener('input', onInput, true); document.removeEventListener('focusout', onFocusOut, true); }
    };
  }
  global.QARecorderEngine = Object.freeze({ create });
})(window);
