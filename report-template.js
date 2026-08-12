// report-template.js - Standalone professional QA execution report

const QAReportTemplate = {
  generateHTML(executionData, testSteps = [], logs = [], pageUrl = '', meta = {}) {
    const results = executionData || {};
    const steps = Array.isArray(results.stepDetails) ? results.stepDetails : [];
    const total = Number(results.totalSteps || testSteps.length || 0);
    const passed = Number(results.passedSteps || 0);
    const failed = Number(results.failedSteps || 0);
    const slow = steps.filter(step => String(step.status).toUpperCase() === 'SLOW').length;
    const skipped = Math.max(0, total - passed - failed - slow);
    const passRate = total ? Math.round((passed / total) * 100) : 0;
    const rawStatus = String(results.status || 'IDLE').toUpperCase();
    const hasRun = !['', 'IDLE', 'RUNNING'].includes(rawStatus) && steps.length > 0;
    const isPassed = hasRun && failed === 0 && ['COMPLETED', 'PASSED'].includes(rawStatus);
    const status = !hasRun ? 'NOT RUN' : (isPassed ? 'PASSED' : 'FAILED');
    const generatedAt = new Date();
    const startedAt = this.safeDate(results.startTime);
    const endedAt = this.safeDate(results.endTime);
    const duration = startedAt && endedAt ? Math.max(0, endedAt - startedAt) : steps.reduce((sum, step) => sum + (Number(step.executionTimeMs) || 0), 0);
    const relevantLogs = logs.filter(log => ['console_error', 'network_error', 'uncaught_exception', 'network_slow'].includes(log.type));
    const networkLogs = logs.filter(log => ['network_request', 'network_error', 'network_slow', 'network_resource', 'network_socket'].includes(log.type)).slice(0, 100);
    const errorCount = relevantLogs.filter(log => log.type !== 'network_slow').length;
    const screenshots = [];
    const addScreenshot = (source, title, caption) => {
      const safeSource = this.safeImageSource(source);
      if (safeSource && !screenshots.some(item => item.src === safeSource)) screenshots.push({ src: safeSource, title, caption });
    };
    addScreenshot(meta.pageScreenshot, 'Final page state', 'Snapshot captured when this report was generated.');
    steps.forEach(step => addScreenshot(step.screenshot, `Failure evidence · Step ${Number(step.stepIndex) || '-'}`, step.error || step.description || 'Captured at failure.'));

    const network = results.networkStatus || {};
    const region = String(network.countryCode || '').toUpperCase();
    const runId = `QFM-${generatedAt.toISOString().replace(/\D/g, '').slice(0, 14)}`;
    const safeUrl = this.escapeHTML(pageUrl || 'Not captured');
    const safeSuite = this.escapeHTML(meta.suiteName || 'Test Suite');
    const safeEnvironment = this.escapeHTML(meta.environmentName || 'Default');
    const governance = meta.governance || {};
    const requirements = Array.isArray(governance.requirements) ? governance.requirements : [];
    const coveredIds = new Set(testSteps.flatMap(step => step.requirementIds || []));
    const requirementCoverage = requirements.length ? Math.round(requirements.filter(item => coveredIds.has(item.id)).length / requirements.length * 100) : 0;
    const defects = Array.isArray(governance.defects) ? governance.defects : [];
    const blockers = defects.filter(item => ['OPEN', 'IN_PROGRESS'].includes(item.status) && ['CRITICAL', 'HIGH'].includes(item.severity));
    const verdictCopy = !hasRun
      ? 'No execution result is available yet.'
      : isPassed
        ? `All critical checks passed with a ${passRate}% pass rate.`
        : `${failed} step${failed === 1 ? '' : 's'} failed and require review.`;

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>QA Report · ${safeSuite}</title>
  <style>
    :root{--ink:#172033;--muted:#667085;--line:#e4e7ec;--soft:#f7f9fc;--brand:#2563eb;--ok:#067647;--ok-bg:#ecfdf3;--bad:#b42318;--bad-bg:#fef3f2;--warn:#b54708;--warn-bg:#fffaeb}
    *{box-sizing:border-box}body{margin:0;background:#eef2f7;color:var(--ink);font:14px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}.report{width:min(1120px,calc(100% - 32px));margin:32px auto;background:#fff;border:1px solid var(--line);border-radius:18px;box-shadow:0 18px 48px rgba(16,24,40,.08);overflow:hidden}.header{padding:34px 38px 28px;border-top:5px solid var(--brand)}.header-row,.section-head,.evidence-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}.eyebrow{margin:0 0 7px;color:var(--brand);font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}h1{margin:0;font-size:28px;line-height:1.18;letter-spacing:-.03em}.subtitle{margin:8px 0 0;color:var(--muted)}.verdict{flex:none;padding:7px 12px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.06em}.verdict.passed{color:var(--ok);background:var(--ok-bg);border:1px solid #abefc6}.verdict.failed{color:var(--bad);background:var(--bad-bg);border:1px solid #fecdca}.verdict.not-run{color:var(--warn);background:var(--warn-bg);border:1px solid #fedf89}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-top:28px;border:1px solid var(--line);border-radius:12px;overflow:hidden}.meta-item{min-width:0;padding:13px 15px;background:var(--soft);border-right:1px solid var(--line)}.meta-item:last-child{border-right:0}.label{display:block;margin-bottom:3px;color:var(--muted);font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.meta-value{display:block;overflow:hidden;color:var(--ink);font-size:12px;font-weight:650;text-overflow:ellipsis;white-space:nowrap}.summary{display:grid;grid-template-columns:1.35fr repeat(4,.65fr);border-block:1px solid var(--line)}.summary-main,.metric{padding:22px 24px}.summary-main{background:#f8fafc}.summary-main strong{display:block;margin-bottom:4px;font-size:17px}.summary-main p{margin:0;color:var(--muted)}.metric{border-left:1px solid var(--line)}.metric b{display:block;font-size:24px;line-height:1.2}.metric span{color:var(--muted);font-size:11px}.metric.ok b{color:var(--ok)}.metric.bad b{color:var(--bad)}.metric.warn b{color:var(--warn)}section{padding:28px 38px;border-bottom:1px solid var(--line)}section:last-of-type{border-bottom:0}.section-head{align-items:center;margin-bottom:14px}h2{margin:0;font-size:17px;letter-spacing:-.01em}.section-note{color:var(--muted);font-size:12px}.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:12px}table{width:100%;border-collapse:collapse;font-size:12px}th{padding:10px 12px;background:var(--soft);color:var(--muted);font-size:10px;letter-spacing:.05em;text-align:left;text-transform:uppercase}td{padding:12px;border-top:1px solid var(--line);vertical-align:top}tbody tr:hover{background:#fbfcfe}.num{width:46px;color:var(--muted)}.duration{white-space:nowrap}.code{display:inline-block;max-width:340px;padding:2px 6px;border:1px solid #e2e8f0;border-radius:5px;background:#f8fafc;color:#344054;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}.status{display:inline-block;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:800}.status.passed,.status.completed{color:var(--ok);background:var(--ok-bg)}.status.failed{color:var(--bad);background:var(--bad-bg)}.status.slow{color:var(--warn);background:var(--warn-bg)}.detail-row td{padding:0 12px 13px;background:#fcfcfd}.failure{padding:12px;border-left:3px solid var(--bad);border-radius:6px;background:var(--bad-bg);color:#7a271a}.failure-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 16px}.failure p{margin:0}.failure .wide{grid-column:1/-1}.empty{padding:28px!important;color:var(--muted);text-align:center}.log-message{font-weight:650}.log-url{margin-top:3px;color:var(--muted);font-size:11px;overflow-wrap:anywhere}.evidence-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.evidence{overflow:hidden;border:1px solid var(--line);border-radius:12px;background:var(--soft)}.evidence-head{align-items:center;padding:11px 13px}.evidence-head strong{font-size:12px}.evidence-head span{color:var(--muted);font-size:10px}.evidence img{display:block;width:100%;height:auto;border-top:1px solid var(--line);background:#e5e7eb}.caption{padding:10px 13px;color:var(--muted);font-size:11px}.footer{display:flex;justify-content:space-between;gap:16px;padding:20px 38px;background:var(--soft);color:var(--muted);font-size:11px}.footer strong{color:var(--ink)}
    @media(max-width:760px){.report{width:100%;margin:0;border:0;border-radius:0}.header,section{padding:24px 18px}.header-row{display:block}.verdict{display:inline-block;margin-top:16px}.meta{grid-template-columns:1fr 1fr}.meta-item:nth-child(2){border-right:0}.meta-item:nth-child(-n+2){border-bottom:1px solid var(--line)}.summary{grid-template-columns:1fr 1fr}.summary-main{grid-column:1/-1}.metric{border-top:1px solid var(--line)}.evidence-grid{grid-template-columns:1fr}.footer{padding:18px;flex-direction:column}.failure-grid{grid-template-columns:1fr}.failure .wide{grid-column:auto}}
    @media print{body{background:#fff}.report{width:100%;margin:0;border:0;box-shadow:none}.table-wrap,.evidence{break-inside:avoid}section{break-inside:auto}.footer{background:#fff}@page{margin:14mm}}
  </style>
</head>
<body>
<main class="report">
  <header class="header">
    <div class="header-row">
      <div><p class="eyebrow">QA execution report</p><h1>${safeSuite}</h1><p class="subtitle">Automated test evidence and run diagnostics</p></div>
      <span class="verdict ${status.toLowerCase().replace(' ','-')}">${status}</span>
    </div>
    <div class="meta">
      <div class="meta-item"><span class="label">Run ID</span><span class="meta-value">${runId}</span></div>
      <div class="meta-item"><span class="label">Environment</span><span class="meta-value">${safeEnvironment}</span></div>
      <div class="meta-item"><span class="label">Duration</span><span class="meta-value">${this.formatDuration(duration)}</span></div>
      <div class="meta-item"><span class="label">Generated</span><span class="meta-value">${this.formatDate(generatedAt)}</span></div>
    </div>
  </header>

  <div class="summary">
    <div class="summary-main"><strong>${this.escapeHTML(verdictCopy)}</strong><p title="${safeUrl}">${safeUrl}</p></div>
    <div class="metric ok"><b>${passed}</b><span>Passed</span></div>
    <div class="metric bad"><b>${failed}</b><span>Failed</span></div>
    <div class="metric warn"><b>${slow}</b><span>Slow</span></div>
    <div class="metric"><b>${passRate}%</b><span>Pass rate</span></div>
  </div>

  <section>
    <div class="section-head"><h2>Quality governance</h2><span class="section-note">Release ${this.escapeHTML(governance.release || 'not set')}</span></div>
    <div class="summary"><div class="metric"><b>${requirementCoverage}%</b><span>Requirement coverage</span></div><div class="metric bad"><b>${blockers.length}</b><span>Open blockers</span></div><div class="metric"><b>${Number(governance.exploratorySessions || 0)}</b><span>Exploratory sessions</span></div><div class="metric"><b>${Number(governance.signoffs || 0)}</b><span>Sign-offs</span></div></div>
  </section>

  <section>
    <div class="section-head"><h2>Execution details</h2><span class="section-note">${total} steps · ${skipped} skipped</span></div>
    <div class="table-wrap"><table>
      <thead><tr><th>No.</th><th>Action</th><th>Target</th><th>Input / expected</th><th>Status</th><th>Duration</th></tr></thead>
      <tbody>${steps.length ? steps.map(step => this.renderStep(step)).join('') : '<tr><td class="empty" colspan="6">No execution details recorded.</td></tr>'}</tbody>
    </table></div>
  </section>

  ${screenshots.length ? `<section><div class="section-head"><h2>Visual evidence</h2><span class="section-note">${screenshots.length} screenshot${screenshots.length === 1 ? '' : 's'}</span></div><div class="evidence-grid">${screenshots.map((item, index) => `<figure class="evidence"><div class="evidence-head"><strong>${this.escapeHTML(item.title)}</strong><span>Evidence ${String(index + 1).padStart(2, '0')}</span></div><img src="${item.src}" alt="${this.escapeHTML(item.title)}"><figcaption class="caption">${this.escapeHTML(item.caption)}</figcaption></figure>`).join('')}</div></section>` : ''}

  <section>
    <div class="section-head"><h2>Network activity</h2><span class="section-note">${networkLogs.length} captured requests</span></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Method</th><th>Status</th><th>Endpoint</th><th>Duration</th><th>Size</th></tr></thead>
      <tbody>${networkLogs.length ? networkLogs.map(log => { const details = log.details || {}; const size = Number(details.responseSize || 0); return `<tr><td><span class="code">${this.escapeHTML(details.method || 'GET')}</span></td><td>${this.escapeHTML(details.status || 'ERR')}</td><td>${this.escapeHTML(details.url || log.url || '-')}</td><td>${this.formatDuration(Number(details.durationMs) || 0)}</td><td>${size ? this.escapeHTML(size >= 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`) : '-'}</td></tr>`; }).join('') : '<tr><td class="empty" colspan="5">No network requests captured.</td></tr>'}</tbody>
    </table></div>
  </section>

  <section>
    <div class="section-head"><h2>Runtime issues</h2><span class="section-note">${errorCount} errors · ${relevantLogs.length - errorCount} slow requests</span></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Type</th><th>Message</th><th>Time</th></tr></thead>
      <tbody>${relevantLogs.length ? relevantLogs.map(log => this.renderLog(log)).join('') : '<tr><td class="empty" colspan="3">No console or network issues detected.</td></tr>'}</tbody>
    </table></div>
  </section>

  <footer class="footer"><span><strong>QA Flow Master Pro</strong> · Built by Syarofuddin</span><span>${region ? `${network.isVpn ? 'VPN' : 'Direct'} (${this.escapeHTML(region)})` : 'Network not recorded'}${network.ip ? ` · ${this.escapeHTML(network.ip)}` : ''}</span></footer>
</main>
</body>
</html>`;
  },

  renderStep(step = {}) {
    const status = String(step.status || 'UNKNOWN').toUpperCase();
    const hasDetails = step.error || step.expected != null || step.actual != null || step.healed || step.domSnippet;
    const input = step.value !== undefined && step.value !== '' ? step.value : (step.expected ?? '-');
    return `<tr><td class="num">${Number(step.stepIndex) || '-'}</td><td><span class="code">${this.escapeHTML(String(step.action || 'unknown').toUpperCase())}</span></td><td><span class="code">${this.escapeHTML(step.selector || step.usedSelector || '-')}</span></td><td>${this.escapeHTML(input)}</td><td><span class="status ${this.safeStatusClass(status)}">${this.escapeHTML(status)}</span></td><td class="duration">${this.formatDuration(Number(step.executionTimeMs) || 0)}</td></tr>${hasDetails ? `<tr class="detail-row"><td colspan="6"><div class="failure"><div class="failure-grid">${step.error ? `<p class="wide"><strong>Failure:</strong> ${this.escapeHTML(step.error)}</p>` : ''}${step.expected != null ? `<p><strong>Expected:</strong> ${this.escapeHTML(step.expected)}</p>` : ''}${step.actual != null ? `<p><strong>Actual:</strong> ${this.escapeHTML(step.actual)}</p>` : ''}${step.attempts ? `<p><strong>Attempts:</strong> ${Number(step.attempts) || 1}</p>` : ''}${step.usedSelector ? `<p class="wide"><strong>Locator:</strong> <span class="code">${this.escapeHTML(step.usedSelector)}</span>${step.healed ? ' · fallback used' : ''}</p>` : ''}</div></div></td></tr>` : ''}`;
  },

  renderLog(log = {}) {
    const type = String(log.type || 'unknown').replace(/_/g, ' ').toUpperCase();
    const url = log.details?.url || log.url || '';
    return `<tr><td><span class="status ${log.type === 'network_slow' ? 'slow' : 'failed'}">${this.escapeHTML(type)}</span></td><td><div class="log-message">${this.escapeHTML(log.message || 'No message')}</div>${url ? `<div class="log-url">${this.escapeHTML(url)}</div>` : ''}</td><td class="duration">${this.formatDate(this.safeDate(log.timestamp), true)}</td></tr>`;
  },

  escapeHTML(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  },

  safeStatusClass(status) {
    const value = String(status || '').toLowerCase();
    return ['passed', 'failed', 'slow', 'completed'].includes(value) ? value : 'failed';
  },

  safeImageSource(value) {
    const source = String(value || '');
    return /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(source) ? source : '';
  },

  safeDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  },

  formatDate(value, timeOnly = false) {
    const date = this.safeDate(value);
    if (!date) return '-';
    return new Intl.DateTimeFormat('id-ID', timeOnly
      ? { hour: '2-digit', minute: '2-digit', second: '2-digit' }
      : { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  },

  formatDuration(ms) {
    const value = Math.max(0, Number(ms) || 0);
    if (value < 1000) return `${Math.round(value)} ms`;
    if (value < 60000) return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} s`;
    const minutes = Math.floor(value / 60000);
    const seconds = Math.round((value % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = QAReportTemplate;
