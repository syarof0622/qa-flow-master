# Expert automation guide

## Suite lifecycle

1. Record the stable happy path in the extension.
2. Replace dynamic values with `{{variables}}`.
3. Add negative assertions, API checks, and cleanup hooks.
4. Export JSON and run `npm run qa:validate -- <file>`.
5. Run Chromium locally, then use the CI matrix for Firefox and WebKit.
6. Review trace/video for failures; quarantine only with an owner and expiry date.

## Reliable selectors

Prefer `data-testid`, stable IDs, names, and ARIA labels. CSS ancestry is a fallback only. Avoid text generated from time, random IDs, or translated content unless that content is the assertion target.

## API step

Use action `api_request`, put the URL in `selector`, and JSON configuration in `value`:

```json
{
  "action": "api_request",
  "selector": "{{baseUrl}}/api/users/42",
  "value": "{\"method\":\"GET\",\"status\":200,\"maxDurationMs\":1500,\"assertions\":[{\"path\":\"$.id\",\"equals\":42},{\"path\":\"$.email\",\"exists\":true}]}"
}
```

Headers and request bodies are supported through `headers` and `body`. Add `schema` for JSON Schema contract validation. Use `{{secret_name}}`; never put tokens directly in suite JSON.

## Visual testing

```json
{
  "id": "checkout-complete",
  "action": "assert_screenshot",
  "maxDiffPixelRatio": 0.01,
  "fullPage": true,
  "maskSelectors": ["[data-testid=clock]", ".random-banner"]
}
```

Create or approve baselines intentionally:

```bash
QA_UPDATE_SNAPSHOTS=true npm run qa:run -- suites/checkout.json
```

Commit reviewed baseline images. Keep browser, OS, viewport, locale, and timezone stable.

## Authentication

Create Playwright storage state in a protected setup job, then run:

```bash
QA_STORAGE_STATE=auth/admin.json npm run qa:run -- suites/admin.json
```

The `auth/` directory is ignored. CI should create the file from a protected secret or dedicated login setup, never commit it.

Run multiple roles with `QA_STORAGE_STATES='{"admin":"auth/admin.json","user":"auth/user.json","guest":"auth/guest.json"}'`.

The built-in generator uses `QA_LOGIN_URL`, `QA_LOGIN_USER_SELECTOR`, `QA_LOGIN_PASSWORD_SELECTOR`, `QA_LOGIN_SUBMIT_SELECTOR`, `QA_AUTH_USER`, and `QA_AUTH_PASSWORD`. Set `QA_LOGIN_SUCCESS_URL` when login redirects to a predictable URL.

## Accessibility and performance

Use `assert_a11y` with an optional Axe options JSON value. Use `assert_performance` with budgets such as `{"loadMs":3000,"transferBytes":1500000,"requests":80}`. Both attach machine-readable evidence to the Playwright report.

## Network scenarios

Use `mock_route` with a URL/glob selector and JSON value containing `status`, `headers`, `body`, `delayMs`, or `abort`. Use `clear_mocks` in cleanup hooks. These actions work in both the extension and canonical Playwright runner.

## Trends and integrations

Each run produces `quality-summary.json`, `trend-history.json`, and `trend-dashboard.html`. Setting `QA_WEBHOOK_URL` posts the final status and duration to a team-owned webhook.

## Local security

Report download accepts an optional password and uses AES-256-GCM with PBKDF2. Sensitive form fields are blurred before screenshots. Suite mutations retain a bounded, hash-chained local audit trail (each entry links to the previous one's hash, so a retained entry can't be edited in place without breaking the chain) and up to 25 revisions.

There is no CycloneDX SBOM or CI provenance attestation in this project - `npm run qa:security` covers hardcoded secrets and dependency vulnerabilities, but a real SBOM/attestation pipeline would need to be added separately (e.g. `@cyclonedx/cyclonedx-npm` plus a CI step) if that's required for compliance.

## Cloud sync (Supabase) and video storage (cPanel)

Suite/state data optionally syncs to a Supabase Postgres table (`qa_global_state`) so it survives a browser reinstall or moves between your own devices. Each install generates its own random `workspaceId` (stored under the `qa_workspace_id` local key, separate from the synced state) and only ever reads/writes its own row - installs never share or overwrite each other's data.

This requires the Supabase table's `id` column to be `text`, not `bigint` (the previous design used a single shared numeric row for every install, which is why this migration is needed):

```sql
ALTER TABLE qa_global_state ALTER COLUMN id TYPE text;
```

Credentials excluded from every cloud sync: the AI provider API key, the video-upload API key, session secrets, and Copilot chat threads (which can contain scraped page content). Only the video-upload API key and session secrets are restored from local storage after a cloud pull merges in; the AI key and Copilot threads are local-only and never round-trip through Supabase at all.

Video recordings upload to a PHP endpoint you host (e.g. on cPanel), `qa-upload.php`, authenticated with `X-API-Key`. The extension ships with **no working default key** - configure your own in Settings > Video, matching whatever the server expects. On the server side, `qa-upload.php` resolves its key from (in order): the `QA_UPLOAD_API_KEY` environment variable, a sibling `qa-upload.secret.php` file (`<?php return 'your-secret-here';`, kept out of any shared/versioned copy of this project), or a placeholder that rejects all uploads. It also rate-limits by IP and verifies uploaded files by content (magic bytes), not just filename extension.

## Reusable flows

Define `suite.flows` as named arrays of steps, then add a `use_flow` step whose value is the flow name. Circular references and missing flows fail explicitly.

## Data matrix

Every object in `dataset.rows` becomes an independent Playwright test. Use small representative boundary partitions in pull requests and larger regression datasets on schedule.

## Failure triage

- Product defect: assertion fails consistently with valid evidence.
- Automation defect: locator, timing, or test data is wrong.
- Environment defect: dependency, deployment, DNS, or test account is unavailable.
- Flaky: retry passes; investigate trace before accepting quarantine.

CI retries are diagnostic, not a substitute for deterministic tests. A flaky result remains visible in the Playwright report.

## Traceability, defects, and release gates

Add `requirements` in Suite Settings, then map each step with `requirementIds` and a risk level. QA Readiness calculates requirement coverage and open critical/high blockers. Defects support `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, and `WONT_FIX`, with assignee and evidence references.

In the extension, use Requirement Manager from QA Readiness to add, edit, or remove requirements. The step editor exposes requirement chips for mapping without typing IDs. Use Defect Board to edit lifecycle state or close an issue. Clicking a failed execution card opens Failure Inspector with expected/actual values, attempted selectors, retries, related runtime logs, and screenshot evidence.

Use the exploratory-session action to retain charter, tester, duration, notes, and evidence. Release sign-off requires a passing run, the configured minimum coverage, and zero open critical/high defects. A failed gate can only be approved with an auditable `overrideReason`.

Quarantined steps must include `quarantineOwner` and `quarantineUntil`. CI fails when those fields are absent or the quarantine has expired. `artifacts/flaky-tests.json` records retry-derived flake scores.

Run `npm run qa:security -- suites/smoke.json` before execution. It blocks hardcoded secret fields and non-local HTTP targets; CI also fails on high-severity dependency vulnerabilities.

Use `assert_security_headers` with the target URL in `selector`. Its JSON value can define `required` headers and `requireHsts`; by default it checks CSP, MIME sniffing protection, referrer policy, permissions policy, and HSTS on HTTPS. The runner attaches the observed headers as evidence.
