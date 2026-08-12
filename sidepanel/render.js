// sidepanel/render.js - Pure helpers (safe HTML + secret scanning)
// Extracted from sidepanel.js core. Pure: read args, return values - no DOM,
// no chrome, no app state. Loaded before sidepanel.js so callers can use
// escapeHTML() / findHardcodedSecret() from the shared global scope.

  function findHardcodedSecret(value, path = 'suite') {
    if (!value || typeof value !== 'object') return '';
    for (const [key, item] of Object.entries(value)) {
      const nextPath = `${path}.${key}`;
      if (/(password|passwd|token|secret|authorization|api[-_]?key|cookie|otp|pin)/i.test(key) && typeof item === 'string' && item && !/^\{\{[\w.-]+\}\}$/.test(item) && item !== '[REDACTED]') return nextPath;
      if (item && typeof item === 'object') { const found = findHardcodedSecret(item, nextPath); if (found) return found; }
    }
    return '';
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
