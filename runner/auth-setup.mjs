import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const required = ['QA_LOGIN_URL', 'QA_LOGIN_USER_SELECTOR', 'QA_LOGIN_PASSWORD_SELECTOR', 'QA_LOGIN_SUBMIT_SELECTOR', 'QA_AUTH_USER', 'QA_AUTH_PASSWORD'];
const missing = required.filter(key => !process.env[key]);
if (missing.length) throw new Error(`Missing auth variables: ${missing.join(', ')}`);
const output = path.resolve(process.env.QA_STORAGE_STATE_OUTPUT || 'auth/user.json');
await mkdir(path.dirname(output), { recursive: true });
const browser = await chromium.launch({ headless: process.env.QA_HEADED !== 'true' });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(process.env.QA_LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.locator(process.env.QA_LOGIN_USER_SELECTOR).fill(process.env.QA_AUTH_USER);
  await page.locator(process.env.QA_LOGIN_PASSWORD_SELECTOR).fill(process.env.QA_AUTH_PASSWORD);
  await Promise.all([process.env.QA_LOGIN_SUCCESS_URL ? page.waitForURL(process.env.QA_LOGIN_SUCCESS_URL) : page.waitForLoadState('networkidle'), page.locator(process.env.QA_LOGIN_SUBMIT_SELECTOR).click()]);
  await context.storageState({ path: output });
  console.log(`Authentication state saved: ${output}`);
} finally { await browser.close(); }

