import { readFile } from 'node:fs/promises';
import path from 'node:path';

const suitePath = path.resolve(process.argv[2] || 'suites/smoke.json');
const document = JSON.parse(await readFile(suitePath, 'utf8'));
const findings = [];
const sensitiveKey = /(pass(word|wd)?|token|secret|authorization|api[-_]?key|cookie|session|credential|cvv|cvc|pin|otp)/i;
const placeholder = /^\{\{[\w.-]+\}\}$/;

function inspect(value, trail = '$') {
  if (Array.isArray(value)) return value.forEach((item, index) => inspect(item, `${trail}[${index}]`));
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    const next = `${trail}.${key}`;
    if (sensitiveKey.test(key) && typeof item === 'string' && item && !placeholder.test(item)) findings.push(`${next}: hardcoded sensitive value`);
    inspect(item, next);
  }
}

inspect(document);
const suite = document.suite || {};
const flowSteps = Object.values(suite.flows || {}).flatMap(steps => Array.isArray(steps) ? steps : []);
const allSteps = [...(suite.beforeEach || []), ...(suite.steps || []), ...(suite.afterEach || []), ...flowSteps];
const urls = [suite.startUrl, document.environment?.baseUrl, ...allSteps.filter(step => ['api_request', 'assert_security_headers'].includes(step.action)).map(step => step.selector)].filter(Boolean);
for (const raw of urls) {
  if (/^http:\/\//i.test(raw) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(raw)) findings.push(`Insecure HTTP target: ${raw}`);
}
if (findings.length) {
  console.error(`[QA Security] blocked\n- ${findings.join('\n- ')}`);
  process.exitCode = 1;
} else console.log('[QA Security] passed: no hardcoded secrets or insecure HTTP targets.');
