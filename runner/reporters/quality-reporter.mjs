import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { assertSafeNetworkTarget } from '../lib/safe-network.mjs';
export default class QualityReporter {
  constructor() { this.outcomes = []; }
  onTestEnd(test, result) {
    this.outcomes.push({ id: test.id, title: test.title, status: result.status, retry: result.retry, durationMs: result.duration });
  }
  async onEnd(result) {
    await mkdir('artifacts', { recursive: true });
    const grouped = new Map();
    this.outcomes.forEach(item => { const rows = grouped.get(item.id) || []; rows.push(item); grouped.set(item.id, rows); });
    const flakyTests = [...grouped.values()].filter(rows => rows.some(item => item.status !== 'passed') && rows.some(item => item.status === 'passed')).map(rows => ({ id: rows[0].id, title: rows[0].title, attempts: rows.length, flakeScore: Math.round(rows.filter(item => item.status !== 'passed').length / rows.length * 100) }));
    const entry = { timestamp: new Date().toISOString(), status: result.status, durationMs: result.duration, tests: grouped.size, flakyTests, flakeRate: grouped.size ? Math.round(flakyTests.length / grouped.size * 100) : 0 };
    let history = [];
    try { history = JSON.parse(await readFile('artifacts/trend-history.json', 'utf8')); } catch (error) {}
    history = [...history, entry].slice(-100);
    await writeFile('artifacts/quality-summary.json', JSON.stringify(entry, null, 2));
    await writeFile('artifacts/flaky-tests.json', JSON.stringify(flakyTests, null, 2));
    await writeFile('artifacts/trend-history.json', JSON.stringify(history, null, 2));
    const rows = history.map(item => `<tr><td>${escapeHtml(item.timestamp)}</td><td>${escapeHtml(item.status)}</td><td>${Math.round(item.durationMs)} ms</td><td>${Number(item.flakeRate || 0)}%</td></tr>`).join('');
    await writeFile('artifacts/trend-dashboard.html', `<!doctype html><meta charset="utf-8"><title>QA Trend</title><style>body{font:14px system-ui;margin:32px;color:#172033}table{border-collapse:collapse;width:100%;max-width:760px}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}</style><h1>QA execution trend</h1><table><thead><tr><th>Run</th><th>Status</th><th>Duration</th><th>Flake</th></tr></thead><tbody>${rows}</tbody></table>`);
    if (process.env.QA_WEBHOOK_URL) {
      try {
        const target = assertSafeNetworkTarget(process.env.QA_WEBHOOK_URL);
        const response = await fetch(target.href, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: 'QA Flow Master', ...entry }) });
        if (!response.ok) console.warn(`QA webhook returned HTTP ${response.status}`);
      } catch (error) {
        console.warn(`QA webhook target rejected: ${error.message}`);
      }
    }
  }
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char]); }
