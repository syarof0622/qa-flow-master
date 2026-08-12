import { loadSuiteDocument, resolveDatasetRows } from './lib/suite-loader.mjs';

const paths = process.argv.slice(2);
if (!paths.length) {
  console.error('Usage: npm run qa:validate -- suite.json [suite-2.json]');
  process.exit(2);
}

for (const filePath of paths) {
  const document = await loadSuiteDocument(filePath);
  const enabled = document.suite.steps.filter(step => step.enabled !== false).length;
  console.log(`VALID ${filePath} · ${enabled} enabled steps · ${resolveDatasetRows(document).length} data rows`);
}

