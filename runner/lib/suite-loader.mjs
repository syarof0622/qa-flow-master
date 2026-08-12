import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { ACTION_NAMES } from './action-registry.mjs';

const rootDir = path.resolve(import.meta.dirname, '../..');
const schema = JSON.parse(await readFile(path.join(rootDir, 'qa-flow.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateSchema = ajv.compile(schema);

export function validateSuiteDocument(document) {
  const candidate = document?.suite ? document : { schemaVersion: 2, suite: document };
  const valid = validateSchema(candidate);
  if (!valid) {
    const details = (validateSchema.errors || []).map(error => `${error.instancePath || '/'} ${error.message}`).join('; ');
    throw new Error(`Suite schema invalid: ${details}`);
  }
  const unknown = collectSteps(candidate.suite).filter(step => !ACTION_NAMES.includes(step.action));
  if (unknown.length) throw new Error(`Unsupported actions: ${[...new Set(unknown.map(step => step.action))].join(', ')}`);
  return candidate;
}

export async function loadSuiteDocument(filePath) {
  const absolutePath = path.resolve(filePath);
  const document = JSON.parse(await readFile(absolutePath, 'utf8'));
  return { ...validateSuiteDocument(document), sourcePath: absolutePath };
}

export function collectSteps(suite = {}) {
  return [...(suite.beforeEach || []), ...(suite.steps || []), ...(suite.afterEach || [])];
}

export function resolveDatasetRows(document) {
  const rows = document.dataset?.rows || document.datasets?.find(item => item.id === document.activeDatasetId)?.rows || [];
  return Array.isArray(rows) && rows.length ? rows : [{}];
}
