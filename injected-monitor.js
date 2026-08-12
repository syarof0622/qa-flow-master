// injected-monitor.js - MAIN World Interceptor v3.0
// Features: Console/Error intercept, Fetch/XHR intercept WITH response body capture (P1)
(function () {
  if (window.__QA_MONITOR_INJECTED__) return;
  window.__QA_MONITOR_INJECTED__ = true;

  const SENSITIVE_KEY_RE = /(pass(word|wd)?|token|secret|authorization|api[-_]?key|cookie|session|credential|card|cvv|cvc|pin|otp)/i;
  const REDACTED = '[REDACTED]';
  const SLOW_REQUEST_MS = 2000;
  let qaMockRules = [];
  const monitorConfig = { captureBodies: window.__QFM_CAPTURE_BODIES_ONCE__ === true };
  const controlToken = String(window.__QFM_CONTROL_TOKEN_ONCE__ || '');
  let monitorActive = true;
  let resourceObserver = null;
  let startResourceObserver = () => {};
  try { delete window.__QFM_CAPTURE_BODIES_ONCE__; } catch (error) { window.__QFM_CAPTURE_BODIES_ONCE__ = false; }
  try { delete window.__QFM_CONTROL_TOKEN_ONCE__; } catch (error) { window.__QFM_CONTROL_TOKEN_ONCE__ = ''; }

  const controlEventName = `__QFM_CONTROL_${controlToken}`;
  const handleControl = event => {
    const control = event.detail || {};
    if (control.type === 'disable') {
      monitorActive = false;
      qaMockRules = [];
      resourceObserver?.disconnect();
      resourceObserver = null;
    } else if (control.type === 'enable') {
      monitorActive = true;
      monitorConfig.captureBodies = control.captureBodies === true;
      startResourceObserver();
      window.dispatchEvent(new CustomEvent('__QA_FLOW_MONITOR_READY__'));
    } else if (control.type === 'mock') {
      const config = control.config || {};
      if (config.clear) qaMockRules = [];
      else if (config.pattern) qaMockRules.push(config);
    }
  };
  if (controlToken) window.addEventListener(controlEventName, handleControl);

  function redactSensitive(value, seen = new WeakSet()) {
    if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') return redactSensitiveString(value);
    if (typeof value !== 'object') return String(value);
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);

    if (value instanceof FormData) {
      const result = {};
      value.forEach((item, key) => { result[key] = SENSITIVE_KEY_RE.test(key) ? REDACTED : String(item); });
      return result;
    }

    if (value instanceof URLSearchParams) {
      const result = {};
      value.forEach((item, key) => { result[key] = SENSITIVE_KEY_RE.test(key) ? REDACTED : item; });
      return result;
    }

    if (Array.isArray(value)) return value.map(item => redactSensitive(item, seen));

    const result = {};
    Object.entries(value).forEach(([key, item]) => {
      result[key] = SENSITIVE_KEY_RE.test(key) ? REDACTED : redactSensitive(item, seen);
    });
    return result;
  }

  function redactSensitiveString(input) {
    const text = String(input);
    try {
      const parsed = JSON.parse(text);
      return JSON.stringify(redactSensitive(parsed));
    } catch (e) {}

    try {
      const params = new URLSearchParams(text);
      if ([...params.keys()].length && text.includes('=')) {
        [...params.keys()].forEach(key => {
          if (SENSITIVE_KEY_RE.test(key)) params.set(key, REDACTED);
        });
        return params.toString();
      }
    } catch (e) {}

    return text
      .replace(/(["']?(?:password|passwd|token|secret|authorization|api[-_]?key|cookie|cvv|cvc|otp)["']?\s*[:=]\s*)["']?([^\s,"'&}]+)/gi, `$1${REDACTED}`)
      .replace(/(Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi, `$1${REDACTED}`);
  }

  function sanitizeUrl(value) {
    try {
      const url = new URL(String(value), window.location.href);
      [...url.searchParams.keys()].forEach(key => {
        if (SENSITIVE_KEY_RE.test(key)) url.searchParams.set(key, REDACTED);
      });
      return url.href;
    } catch (e) {
      return redactSensitiveString(value);
    }
  }

  function sendLogToContentScript(type, message, details = {}) {
    if (!monitorActive) return;
    try {
      window.dispatchEvent(new CustomEvent('__QA_FLOW_LOG__', {
        detail: {
          type,
          message: redactSensitiveString(message),
          details: redactSensitive(details),
          timestamp: new Date().toISOString(),
          url: sanitizeUrl(window.location.href)
        }
      }));
    } catch (e) {}
  }

  // 1. Console.error & console.warn
  const origError = console.error;
  const origWarn = console.warn;
  const formatConsoleArg = value => {
    if (typeof value !== 'object' || value === null) return redactSensitiveString(String(value));
    try { return JSON.stringify(redactSensitive(value)); } catch (error) { return '[Unserializable object]'; }
  };

  console.error = function (...args) {
    origError.apply(console, args);
    if (!monitorActive) return;
    const msg = args.map(formatConsoleArg).join(' ');
    sendLogToContentScript('console_error', msg, { args: args.map(String) });
  };

  console.warn = function (...args) {
    origWarn.apply(console, args);
    if (!monitorActive) return;
    const msg = args.map(formatConsoleArg).join(' ');
    sendLogToContentScript('console_warn', msg, { args: args.map(String) });
  };

  // 2. Uncaught errors
  window.addEventListener('error', (event) => {
    const errorMsg = event.message || (event.error && event.error.message) || 'Uncaught Error';
    sendLogToContentScript('uncaught_exception', errorMsg, {
      filename: event.filename, lineno: event.lineno, colno: event.colno,
      stack: event.error ? event.error.stack : null
    });
  });

  // 3. Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = typeof reason === 'object' ? (reason?.message || formatConsoleArg(reason)) : String(reason);
    sendLogToContentScript('uncaught_exception', `Unhandled Promise Rejection: ${msg}`, {
      stack: reason?.stack || null
    });
  });

  // Helper: truncate body to max 2KB
  function truncateBody(body, maxLen = 2048) {
    if (!body) return null;
    const redacted = redactSensitive(body);
    const str = typeof redacted === 'string' ? redacted : JSON.stringify(redacted);
    if (str.length > maxLen) return str.substring(0, maxLen) + '... [TRUNCATED]';
    return str;
  }

  // 4. Fetch API intercept WITH response body capture (P1)
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    if (!monitorActive) return originalFetch.apply(this, args);
    const rawUrl = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || 'Unknown URL';
    const url = sanitizeUrl(rawUrl);
    const method = (args[1] && args[1].method) || 'GET';
    const requestBody = monitorConfig.captureBodies && args[1]?.body ? truncateBody(args[1].body) : null;
    const requestHeaders = Object.fromEntries(new Headers(args[1]?.headers || (args[0] instanceof Request ? args[0].headers : {})).entries());
    const startTime = performance.now();

    const mock = qaMockRules.find(rule => {
      const pattern = String(rule.pattern || '');
      return pattern.includes('*') ? new RegExp(pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')).test(String(rawUrl)) : String(rawUrl).includes(pattern);
    });
    if (mock) {
      if (mock.delayMs) await new Promise(resolve => setTimeout(resolve, Math.min(30000, Number(mock.delayMs))));
      if (mock.abort) throw new TypeError('Failed to fetch');
      return new Response(typeof mock.body === 'string' ? mock.body : JSON.stringify(mock.body ?? {}), { status: Number(mock.status) || 200, headers: mock.headers || { 'content-type': 'application/json' } });
    }

    try {
      const response = await originalFetch.apply(this, args);
      const duration = Math.round(performance.now() - startTime);
      const responseHeaders = Object.fromEntries(response.headers.entries());
      const responseSize = Number(response.headers.get('content-length')) || 0;

      if (!response.ok) {
        // Clone response to read body without consuming it
        let responseBody = null;
        try {
          const clone = response.clone();
          const text = await clone.text();
          responseBody = monitorConfig.captureBodies ? truncateBody(text) : null;
        } catch (e) {}

        sendLogToContentScript('network_error', `HTTP ${response.status} ${response.statusText} on ${method} ${url}`, {
          url, method, resourceType: 'fetch', status: response.status, statusText: response.statusText,
          durationMs: duration, requestHeaders, responseHeaders, responseSize,
          requestBody: requestBody,
          responseBody: responseBody
        });
      } else if (duration >= SLOW_REQUEST_MS) {
        sendLogToContentScript('network_slow', `Slow ${method} ${url} (${duration}ms)`, {
          url, method, resourceType: 'fetch', status: response.status, statusText: response.statusText, durationMs: duration, requestHeaders, responseHeaders, responseSize
        });
      } else {
        sendLogToContentScript('network_request', `${method} ${response.status} ${url}`, {
          url, method, resourceType: 'fetch', status: response.status, statusText: response.statusText,
          durationMs: duration, requestHeaders, responseHeaders, responseSize, requestBody
        });
      }
      return response;
    } catch (err) {
      const duration = Math.round(performance.now() - startTime);
      sendLogToContentScript('network_error', `Fetch Failed: ${err.message} on ${method} ${url}`, {
        url, method, resourceType: 'fetch', error: err.message, durationMs: duration, requestHeaders, requestBody: requestBody
      });
      throw err;
    }
  };

  // 5. XHR intercept WITH response body capture (P1)
  const originalXHR = window.XMLHttpRequest;
  function CustomXHR() {
    if (!monitorActive) return new originalXHR();
    const xhr = new originalXHR();
    let reqUrl = '', reqMethod = 'GET', startTime = 0, reqBody = null;
    const reqHeaders = {};

    const origOpen = xhr.open;
    xhr.open = function (method, url, ...rest) {
      reqMethod = method;
      reqUrl = sanitizeUrl(url);
      return origOpen.apply(this, [method, url, ...rest]);
    };

    const origSend = xhr.send;
    const origSetRequestHeader = xhr.setRequestHeader;
    xhr.setRequestHeader = function (name, value) {
      reqHeaders[String(name).toLowerCase()] = String(value);
      return origSetRequestHeader.apply(this, [name, value]);
    };
    xhr.send = function (body) {
      startTime = performance.now();
      reqBody = monitorConfig.captureBodies && body ? truncateBody(body) : null;

      xhr.addEventListener('load', function () {
        const duration = Math.round(performance.now() - startTime);
        const responseHeaders = xhr.getAllResponseHeaders().trim().split(/[\r\n]+/).filter(Boolean).reduce((headers, line) => {
          const separator = line.indexOf(':');
          if (separator > 0) headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
          return headers;
        }, {});
        const responseSize = Number(responseHeaders['content-length']) || (typeof xhr.responseText === 'string' ? xhr.responseText.length : 0);
        if (xhr.status >= 400) {
          let responseBody = null;
          try { responseBody = monitorConfig.captureBodies ? truncateBody(xhr.responseText) : null; } catch (e) {}

          sendLogToContentScript('network_error', `XHR HTTP ${xhr.status} ${xhr.statusText} on ${reqMethod} ${reqUrl}`, {
            url: reqUrl, method: reqMethod, resourceType: 'xhr', status: xhr.status, statusText: xhr.statusText,
            durationMs: duration, requestHeaders: reqHeaders, responseHeaders, responseSize, requestBody: reqBody, responseBody: responseBody
          });
        } else if (duration >= SLOW_REQUEST_MS) {
          sendLogToContentScript('network_slow', `Slow ${reqMethod} ${reqUrl} (${duration}ms)`, {
            url: reqUrl, method: reqMethod, resourceType: 'xhr', status: xhr.status, statusText: xhr.statusText, durationMs: duration, requestHeaders: reqHeaders, responseHeaders, responseSize
          });
        } else {
          sendLogToContentScript('network_request', `${reqMethod} ${xhr.status} ${reqUrl}`, {
            url: reqUrl, method: reqMethod, resourceType: 'xhr', status: xhr.status, statusText: xhr.statusText,
            durationMs: duration, requestHeaders: reqHeaders, responseHeaders, responseSize, requestBody: reqBody
          });
        }
      });

      xhr.addEventListener('error', function () {
        const duration = Math.round(performance.now() - startTime);
        sendLogToContentScript('network_error', `XHR Connection Failed on ${reqMethod} ${reqUrl}`, {
          url: reqUrl, method: reqMethod, resourceType: 'xhr', durationMs: duration, requestHeaders: reqHeaders, requestBody: reqBody
        });
      });

      xhr.addEventListener('timeout', function () {
        const duration = Math.round(performance.now() - startTime);
        sendLogToContentScript('network_error', `XHR Request Timeout on ${reqMethod} ${reqUrl}`, {
          url: reqUrl, method: reqMethod, resourceType: 'xhr', durationMs: duration, requestHeaders: reqHeaders, requestBody: reqBody
        });
      });

      return origSend.apply(this, [body]);
    };

    return xhr;
  }

  for (let prop in originalXHR) {
    if (originalXHR.hasOwnProperty(prop)) CustomXHR[prop] = originalXHR[prop];
  }
  CustomXHR.prototype = originalXHR.prototype;
  window.XMLHttpRequest = CustomXHR;

  // 6. Browser resource timing (scripts, styles, images, fonts, media, frames).
  const resourceTypeMap = { img: 'image', css: 'style', link: 'style', script: 'script', iframe: 'document', navigation: 'document' };
  const emitResource = entry => {
    const initiator = String(entry.initiatorType || 'resource').toLowerCase();
    if (['fetch', 'xmlhttprequest'].includes(initiator)) return; // Captured above with richer metadata.
    const resourceType = resourceTypeMap[initiator] || initiator;
    sendLogToContentScript('network_resource', `GET ${resourceType.toUpperCase()} ${sanitizeUrl(entry.name)}`, {
      url: sanitizeUrl(entry.name), method: 'GET', resourceType, status: null,
      durationMs: Math.round(entry.duration || 0), responseSize: Number(entry.transferSize || entry.encodedBodySize || 0),
      decodedSize: Number(entry.decodedBodySize || 0), protocol: entry.nextHopProtocol || '', cached: Number(entry.transferSize || 0) === 0
    });
  };
  try {
    performance.getEntriesByType('resource').forEach(emitResource);
    const navigation = performance.getEntriesByType('navigation')[0];
    if (navigation) sendLogToContentScript('network_resource', `GET DOCUMENT ${sanitizeUrl(location.href)}`, {
      url: sanitizeUrl(location.href), method: 'GET', resourceType: 'document', status: null,
      durationMs: Math.round(navigation.duration || 0), responseSize: Number(navigation.transferSize || 0), protocol: navigation.nextHopProtocol || '', cached: false
    });
    startResourceObserver = () => {
      if (!monitorActive || resourceObserver) return;
      resourceObserver = new PerformanceObserver(list => {
        const entries = list.getEntries();
        // Optimasi: Gunakan setTimeout agar tidak memblokir main thread web page saat memproses ratusan resource
        setTimeout(() => {
          entries.forEach(emitResource);
        }, 0);
      });
      resourceObserver.observe({ type: 'resource', buffered: true });
    };
    startResourceObserver();
  } catch (error) {}

  // 7. WebSocket lifecycle and message metadata without retaining message bodies.
  const OriginalWebSocket = window.WebSocket;
  if (OriginalWebSocket) {
    function MonitoredWebSocket(url, protocols) {
      if (!monitorActive) return protocols === undefined ? new OriginalWebSocket(url) : new OriginalWebSocket(url, protocols);
      const socket = protocols === undefined ? new OriginalWebSocket(url) : new OriginalWebSocket(url, protocols);
      const safeUrl = sanitizeUrl(url);
      const startedAt = performance.now();
      socket.addEventListener('open', () => sendLogToContentScript('network_socket', `WebSocket OPEN ${safeUrl}`, { url: safeUrl, method: 'WS', resourceType: 'websocket', event: 'open', durationMs: Math.round(performance.now() - startedAt), protocol: socket.protocol || '' }));
      socket.addEventListener('message', event => sendLogToContentScript('network_socket', `WebSocket MESSAGE ${safeUrl}`, { url: safeUrl, method: 'WS', resourceType: 'websocket', event: 'message', direction: 'in', messageSize: typeof event.data === 'string' ? event.data.length : Number(event.data?.size || event.data?.byteLength || 0) }));
      socket.addEventListener('error', () => sendLogToContentScript('network_error', `WebSocket ERROR ${safeUrl}`, { url: safeUrl, method: 'WS', resourceType: 'websocket', event: 'error' }));
      socket.addEventListener('close', event => sendLogToContentScript('network_socket', `WebSocket CLOSE ${safeUrl}`, { url: safeUrl, method: 'WS', resourceType: 'websocket', event: 'close', code: event.code, clean: event.wasClean, reason: redactSensitiveString(event.reason || '') }));
      const originalSend = socket.send;
      socket.send = function (data) {
        sendLogToContentScript('network_socket', `WebSocket SEND ${safeUrl}`, { url: safeUrl, method: 'WS', resourceType: 'websocket', event: 'message', direction: 'out', messageSize: typeof data === 'string' ? data.length : Number(data?.size || data?.byteLength || 0) });
        return originalSend.call(this, data);
      };
      return socket;
    }
    MonitoredWebSocket.prototype = OriginalWebSocket.prototype;
    Object.defineProperties(MonitoredWebSocket, { CONNECTING: { value: 0 }, OPEN: { value: 1 }, CLOSING: { value: 2 }, CLOSED: { value: 3 } });
    window.WebSocket = MonitoredWebSocket;
  }

  // 8. Server-Sent Events lifecycle. Event payloads are not stored.
  const OriginalEventSource = window.EventSource;
  if (OriginalEventSource) {
    function MonitoredEventSource(url, config) {
      if (!monitorActive) return new OriginalEventSource(url, config);
      const source = new OriginalEventSource(url, config);
      const safeUrl = sanitizeUrl(url);
      source.addEventListener('open', () => sendLogToContentScript('network_socket', `SSE OPEN ${safeUrl}`, { url: safeUrl, method: 'SSE', resourceType: 'eventsource', event: 'open' }));
      source.addEventListener('message', event => sendLogToContentScript('network_socket', `SSE MESSAGE ${safeUrl}`, { url: safeUrl, method: 'SSE', resourceType: 'eventsource', event: 'message', messageSize: String(event.data || '').length, lastEventId: event.lastEventId || '' }));
      source.addEventListener('error', () => sendLogToContentScript(source.readyState === 2 ? 'network_error' : 'network_socket', `SSE ${source.readyState === 2 ? 'CLOSED' : 'RETRY'} ${safeUrl}`, { url: safeUrl, method: 'SSE', resourceType: 'eventsource', event: source.readyState === 2 ? 'close' : 'retry' }));
      return source;
    }
    MonitoredEventSource.prototype = OriginalEventSource.prototype;
    window.EventSource = MonitoredEventSource;
  }

  window.dispatchEvent(new CustomEvent('__QA_FLOW_MONITOR_READY__'));
  console.log("🛡 QA Flow Master v3.0 Monitor Injected (with Response Body Capture).");
})();
