import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const browserName = process.env.QA_BROWSER || 'chromium';
const deviceName = process.env.QA_DEVICE || '';
const supportedBrowsers = new Set(['chromium', 'firefox', 'webkit']);
if (!supportedBrowsers.has(browserName)) throw new Error(`Unsupported QA_BROWSER: ${browserName}`);

const projectUse = deviceName && devices[deviceName]
  ? { ...devices[deviceName], browserName }
  : { browserName, viewport: { width: Number(process.env.QA_VIEWPORT_WIDTH) || 1440, height: Number(process.env.QA_VIEWPORT_HEIGHT) || 900 } };
let roleStates = {};
try { roleStates = process.env.QA_STORAGE_STATES ? JSON.parse(process.env.QA_STORAGE_STATES) : {}; } catch (error) { throw new Error(`QA_STORAGE_STATES must be JSON: ${error.message}`); }
const projects = Object.keys(roleStates).length
  ? Object.entries(roleStates).map(([role, storageState]) => ({ name: `${browserName}-${role}`, use: { ...projectUse, storageState: path.resolve(storageState) } }))
  : [{ name: deviceName ? `${browserName}-${deviceName}` : browserName, use: projectUse }];

export default defineConfig({
  testDir: './tests',
  testMatch: 'qa-flow.spec.mjs',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  workers: Number(process.env.QA_WORKERS) || (process.env.CI ? 2 : 1),
  retries: Number(process.env.QA_RETRIES ?? (process.env.CI ? 2 : 0)),
  timeout: Number(process.env.QA_TEST_TIMEOUT) || 120000,
  expect: { timeout: Number(process.env.QA_EXPECT_TIMEOUT) || 10000 },
  outputDir: 'artifacts/test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'artifacts/html-report', open: 'never' }],
    ['junit', { outputFile: 'artifacts/junit.xml' }],
    ['json', { outputFile: 'artifacts/results.json' }],
    ['./runner/reporters/quality-reporter.mjs']
  ],
  use: {
    baseURL: process.env.QA_BASE_URL || undefined,
    headless: process.env.QA_HEADED !== 'true',
    storageState: process.env.QA_STORAGE_STATE ? path.resolve(process.env.QA_STORAGE_STATE) : undefined,
    ignoreHTTPSErrors: process.env.QA_IGNORE_HTTPS_ERRORS === 'true',
    locale: process.env.QA_LOCALE || 'id-ID',
    timezoneId: process.env.QA_TIMEZONE || 'Asia/Jakarta',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure'
  },
  projects
});
