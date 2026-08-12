import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { loadSuiteDocument, resolveDatasetRows } from './lib/suite-loader.mjs';

const suitePath = process.argv[2];
if (!suitePath) {
  console.error('Usage: npm run qa:run -- path/to/suite.json');
  process.exit(2);
}

const document = await loadSuiteDocument(suitePath);
const enabledSteps = (document.suite.steps || []).filter(step => step.enabled !== false);
if (!enabledSteps.length) throw new Error('Suite has no enabled test steps.');
await mkdir('artifacts', { recursive: true });
console.log(`[QA Flow] ${document.suite.name} · ${enabledSteps.length} steps · ${resolveDatasetRows(document).length} dataset rows`);

const cliPath = path.resolve('node_modules/@playwright/test/cli.js');
const args = [cliPath, 'test', '--config=playwright.config.mjs'];
if (process.env.QA_UPDATE_SNAPSHOTS === 'true') args.push('--update-snapshots');
const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  env: { ...process.env, QA_SUITE_PATH: document.sourcePath }
});
child.on('exit', code => { process.exitCode = code ?? 1; });
child.on('error', error => { console.error(error); process.exitCode = 1; });
