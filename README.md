# QA Flow Master Pro 4.2

Chrome recorder plus a production Playwright automation runner. A suite recorded in the extension can be exported, schema-validated, executed against datasets, and used as a CI quality gate.

## Quick start

```bash
npm ci
npx playwright install chromium
npm run check
npm test
npm run qa:validate -- suites/smoke.json
npm run qa:run -- suites/smoke.json
```

Artifacts are written to `artifacts/`:

- `html-report/index.html`
- `junit.xml`
- `results.json`
- failure screenshots, video, and Playwright traces

## Extension

1. Open `chrome://extensions` and enable Developer mode.
2. Choose **Load unpacked** and select this directory.
3. Record or author steps, configure environment/data, and export JSON.
4. Validate and execute that JSON with the commands above.

## CI controls

| Variable | Purpose | Default |
|---|---|---|
| `QA_BASE_URL` | Overrides suite base URL | suite environment |
| `QA_BROWSER` | `chromium`, `firefox`, or `webkit` | `chromium` |
| `QA_DEVICE` | Playwright device name | desktop viewport |
| `QA_WORKERS` | Parallel workers | `1` local, `2` CI |
| `QA_RETRIES` | Retry failed tests | `0` local, `2` CI |
| `QA_TAGS` | Comma-separated suite filter | all suites |
| `QA_STORAGE_STATE` | Authentication state JSON path | none |
| `QA_STORAGE_STATES` | JSON role-to-storage-state matrix | none |
| `QA_ALLOW_PRIVATE_NETWORK` | Explicitly allow trusted private API targets in CI | `false` |
| `QA_VAR_*` | Secret/runtime variables | none |
| `QA_UPDATE_SNAPSHOTS` | Approve visual baselines | `false` |
| `QA_VISUAL_THRESHOLD` | Allowed screenshot pixel ratio | `0.01` |

Example secret: `QA_VAR_PASSWORD_SECRET` resolves `{{password_secret}}` without writing the secret into the exported suite.

## Suite capabilities

- Smart locators with up to eight fallbacks
- Assertions for visibility, state, text, value, attribute, CSS, count, URL, console, network, and screenshots
- API requests with status and JSON-path assertions
- Axe accessibility gates and performance budgets
- Network response mocking, latency, and abort scenarios
- Environment variables and full dataset-row parameterization
- `beforeEach` and `afterEach` hooks
- Tags, owner, priority, and start URL metadata
- Multi-browser/device projects
- HTML, JUnit, JSON, screenshot, video, and trace artifacts
- Trend dashboard and optional `QA_WEBHOOK_URL` notification
- Local encrypted reports, hash-chained audit trail, and revision history (no SBOM/provenance attestation pipeline yet - see [Expert guide](docs/expert-guide.md))
- Requirement-to-step traceability, risk coverage, defect lifecycle, exploratory sessions, and audited release sign-off
- Flake scoring plus owner/expiry-enforced quarantine governance
- CI security gate for hardcoded secrets, unsafe HTTP targets, and high-severity dependency vulnerabilities

See [Expert guide](docs/expert-guide.md) for authoring and CI patterns.

Generate reusable login state with `npm run qa:auth`. The required environment variables are documented in the expert guide.

The extension remains local-first and does not require a user account. Governance records are included in suite JSON exports.

Optional Supabase cloud sync and cPanel video upload are configured in Settings; see [Cloud sync (Supabase) and video storage (cPanel)](docs/expert-guide.md#cloud-sync-supabase-and-video-storage-cpanel) for the required one-time Supabase migration and server-side key setup.
