// sidepanel/copilot-expert.js - Modular Expert QA Suite Helpers
// Provides specialized prompt builders & engines for Negative Testing,
// Network Mocking (page.route), Self-Healing Selectors, and Bug Report Generation.
// Pure helper functions attached to window.QAFlow for modularity & scalability.

/**
 * Builds an Expert Negative & Edge-Case Testing Prompt based on scraped DOM form metadata
 * @param {Object} domRes - Webpage DOM extraction result containing formSummary, interactiveSummary, etc.
 * @param {string} userPrompt - User prompt or additional constraints
 * @returns {string} Specialized negative testing prompt instructions
 */
export function buildNegativeTestPrompt(domRes = {}, userPrompt = '') {
  const forms = domRes.formSummary || 'Tidak ada form khusus.';
  const inputs = domRes.interactiveSummary || 'Tidak ada input khusus.';
  
  return `[INSTRUKSI EXPORT QA - NEGATIVE & EDGE-CASE TESTING]
Hasilkan skenario pengujian negatif, kasus batas (Boundary Value Analysis), dan nilai input ekstrem untuk form pada halaman ini.

DATA FORM & ELEMEN INTERAKTIF SAAT INI:
${forms}
${inputs}

USER REQUEST / KONTEKS:
${userPrompt || 'Buatkan skenario negative test lengkap'}

ATURAN HASIL KELUARAN:
1. Uji skenario input kosong pada bidang wajib (Required Fields).
2. Uji skenario input melebihi batas karakter maksimum (Boundary Value Testing).
3. Uji skenario karakter khusus (XSS payload: <script>alert(1)</script>, SQL Injection: ' OR 1=1 --).
4. Uji format email/telepon/angka yang salah.
5. Kembalikan 1 kalimat pembuka yang jelas dan sertakan ARRAY JSON dari langkah pengujian Playwright dengan format valid.`;
}

/**
 * Builds Playwright Network Mocking (page.route) Prompt based on active console & network logs
 * @param {Array} logs - Live logs from window.QAFlow.getState().logs
 * @param {string} userPrompt - User prompt
 * @returns {string} Specialized network mocking prompt
 */
export function buildNetworkMockPrompt(logs = [], userPrompt = '') {
  if (typeof logs === 'string') {
    userPrompt = logs;
    logs = [];
  }
  const logContext = Array.isArray(logs) && logs.length > 0 
    ? logs.map(l => JSON.stringify(l)).join('\n') 
    : '';

  return `[INSTRUKSI EXPERT QA - NETWORK MOCKING & API CONTRACT TESTING]
Analisis log jaringan yang tertera pada bagian [LOG CONSOLE & NETWORK ERROR AKTIF PADA WEBPAGE] dan buatkan skrip Playwright route mocking (page.route) untuk simulasi respon API (misal error 500, response timeout, atau response JSON khusus).

USER REQUEST / KONTEKS:
${userPrompt || 'Buatkan Playwright page.route() mock untuk API halaman ini'}
${logContext ? `\nLOG JARINGAN SAAT INI:\n${logContext}` : ''}

ATURAN HASIL KELUARAN:
1. Tuliskan penjelasan singkat dalam Markdown mengenai skenario mock API.
2. Sediakan contoh skrip Playwright page.route('**/api/...', route => route.fulfill({...})) yang siap pakai.
3. Sertakan pula langkah pengujian otomatis JSON jika diminta.`;
}

/**
 * Analyzes fragile/dynamic CSS selectors and generates resilient ARIA Role / data-testid locators
 * @param {string} selector - Original CSS selector
 * @param {Object} elementInfo - Extra element metadata (tagName, role, placeholder, textContent, testId)
 * @returns {Object} { healedSelector, strategy, score }
 */
export function healSelector(selector = '', elementInfo = {}) {
  const sel = String(selector || '').trim();
  if (!sel) {
    return { healedSelector: 'body', strategy: 'fallback', score: 0 };
  }

  // 1. If element has explicit data-testid or data-cy, prefer that
  if (elementInfo.testId || sel.includes('data-testid') || sel.includes('data-cy')) {
    const testId = elementInfo.testId || sel.match(/\[data-test(?:id|cy)=["']?([^"']+)["']?\]/)?.[1];
    if (testId) {
      return {
        healedSelector: `[data-testid="${testId}"]`,
        strategy: 'data-testid',
        score: 100
      };
    }
  }

  // 2. If element has ARIA role & accessible name
  const role = elementInfo.role || (elementInfo.tagName === 'BUTTON' ? 'button' : (elementInfo.type === 'password' ? 'textbox' : null));
  const name = elementInfo.name || elementInfo.textContent || elementInfo.placeholder;
  if (role && name) {
    return {
      healedSelector: `role=${role}[name="${String(name).trim()}"]`,
      strategy: 'aria-role',
      score: 90
    };
  }

  // 3. If element is an input with precise name or placeholder
  if (elementInfo.nameAttr) {
    return {
      healedSelector: `input[name="${elementInfo.nameAttr}"]`,
      strategy: 'attribute-name',
      score: 85
    };
  }

  if (elementInfo.placeholder) {
    return {
      healedSelector: `[placeholder="${elementInfo.placeholder}"]`,
      strategy: 'placeholder',
      score: 80
    };
  }

  // 4. If dynamic id detected (e.g. #input-89312 or .css-1x89z)
  if (/#[a-z0-9_-]*\d{4,}/i.test(sel) || /\.css-[a-z0-9]+/i.test(sel)) {
    if (elementInfo.textContent) {
      return {
        healedSelector: `button:has-text("${String(elementInfo.textContent).trim()}")`,
        strategy: 'text-has',
        score: 75
      };
    }
  }

  return {
    healedSelector: sel,
    strategy: 'original',
    score: 60
  };
}

/**
 * Drafts a structured Jira / GitHub Bug Report Ticket from failed test steps & error logs
 * @param {Object} failedInfo - Info about the failure { step, errorMsg, pageUrl, suiteName, expected, actual, severity }
 * @param {Array} logs - Console and network logs
 * @returns {string} Formatted Markdown Bug Report Ticket
 */
export function buildBugReportDraft(failedInfo = {}, logs = []) {
  const title = failedInfo.title || `[BUG] Kegagalan pada ${failedInfo.step?.description || failedInfo.step?.action || 'Langkah Pengujian'}`;
  const url = failedInfo.pageUrl || 'https://example.com';
  const errorMsg = failedInfo.errorMsg || 'Elemen tidak ditemukan atau timeout.';
  const suiteName = failedInfo.suiteName || 'QA Flow Test Suite';
  const severity = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(String(failedInfo.severity || '').toUpperCase())
    ? String(failedInfo.severity).toUpperCase()
    : 'HIGH / CRITICAL';
  const actualResult = failedInfo.actual || 'Mengalami timeout / error.';
  const expectedResult = failedInfo.expected || 'Elemen berhasil diinteraksi dan assertion bernilai valid.';

  const logContext = Array.isArray(logs) && logs.length > 0
    ? logs.map(l => `[${l.type}] ${l.message || l.details?.url || JSON.stringify(l)}`).join('\n')
    : '*(Tidak ada log error yang terdeteksi)*';

  return `### 🐞 ${title}

**Environment & Metadata:**
- **Suite**: ${suiteName}
- **URL Halaman**: \`${url}\`
- **Waktu Laporan**: ${new Date().toLocaleString('id-ID')}
- **Keparahan (Severity)**: **${severity}**

---

### 📝 Deskripsi Problem
Pengujian otomatis mengalami kegagalan pada aksi \`${failedInfo.step?.action || 'AKSI'}\` dengan pesan error:
> ⚠️ **${errorMsg}**

---

### 🔄 Langkah Rekonstruksi (Steps to Reproduce)
1. Buka halaman URL \`${url}\`
2. Jalankan skenario tes \`${suiteName}\`
3. Eksekusi langkah: \`${failedInfo.step?.description || failedInfo.step?.action || 'Aksi'}\` dengan selector \`${failedInfo.step?.selector || 'N/A'}\`
4. **Hasil Aktual**: ${actualResult}
5. **Hasil Diharapkan**: ${expectedResult}

---

### 📊 Log Traceback (Console & Network)
${logContext}

---
*Dibuat otomatis oleh QA Flow Master Pro — AI Bug Report Generator*`;
}

// Bind helper functions to window.QAFlow namespace if running in browser context
if (typeof window !== 'undefined') {
  window.QAFlow = window.QAFlow || {};
  window.QAFlow.copilotExpert = {
    buildNegativeTestPrompt,
    buildNetworkMockPrompt,
    healSelector,
    buildBugReportDraft
  };
}
