# BeForward Data Accuracy Testscript

## Objective

Validate that BeForward source inventory, Supabase active/terminal counts, and sampled terminal-row liveness agree closely enough to prove the ingestion state is accurate after a full convergence run.

## Required Environment

- Windows PowerShell or a shell that can run `npx`.
- Node dependencies installed with `npm install`.
- `.env.local` or `.env` present at repo root.
- Required env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` preferred, or `NEXT_PUBLIC_SUPABASE_ANON_KEY` for read-only checks.
- Optional env vars:
  - `BF_FORCE_SCRAPLING=1` when local Scrapling is installed and BeForward blocks plain fetch.
  - `SCRAPLING_PYTHON=<python executable>` when Scrapling is not available through `python3.11`.

## Commands

Run this non-network quality check first:

```powershell
npx eslint scripts/audit-beforward-accuracy.ts
```

Run this non-network import check to verify the BeForward modules used by the audit script load under the repo's `tsx` runtime:

```powershell
npx tsx -e "import './src/features/scrapers/beforward_porsche_collector/detail.ts'; import './src/features/scrapers/beforward_porsche_collector/discover.ts'; import './src/features/scrapers/beforward_porsche_collector/normalize.ts'; console.log('beforward-imports-ok')"
```

Run the live audit only when Supabase env vars are present and BeForward network access is expected to work:

```powershell
npx tsx scripts/audit-beforward-accuracy.ts --sample=20
```

Optional larger confirmation sample:

```powershell
npx tsx scripts/audit-beforward-accuracy.ts --sample=50
```

## Expected Observations

The live audit prints a concise summary:

```text
BeForward Accuracy Audit
sourceTotal=<number or unknown>
sourcePages=<number>
dbActive=<number>
dbTerminal=<number>
activeJapan=<number>
terminalSampleLive=<number>
coverageGap=<percent or unknown>
artifact=<absolute artifact path>
```

The command must not print Supabase keys, tokens, cookies, or full environment values.

The JSON artifact includes:

- `sourceTotal`, `sourcePages`, and `sourcePageOneListings`.
- `dbActive`, `dbTerminal`, `activeJapan`, and `coverageGap`.
- `statusCounts`, `countryCounts`, and `statusCountryCounts`.
- `terminalSample.rows[]` with each sampled row classified as `live`, `terminal`, or `ambiguous`.

## Artifact Path

Artifacts are written to:

```text
agents/testscripts/artifacts/beforward-accuracy-<timestamp>.json
```

Keep the latest artifact attached to any defect report or rollout note.

## Pass/Fail Thresholds

Pass after a completed full-coverage CLI convergence run when all are true:

- `coverageGap <= 10%`, unless accepted model exclusions are documented in the rollout note.
- `terminalSample.live = 0`.
- `terminalSample.ambiguous = 0` or every ambiguous row has a documented network/bot-block reason.
- The completed full-coverage collector run that preceded the audit reported `coverageLimited=false`.
- No secrets were printed to the terminal or written into the artifact.

Fail when any are true:

- `terminalSample.live > 0`.
- `coverageGap > 10%` without accepted model-policy exclusions.
- `sourceTotal` is `unknown` because page 1 could not be discovered.
- Supabase counts cannot be read.
- The artifact is missing or malformed JSON.

## Cleanup

No database cleanup is required because the audit is read-only.

Optional local artifact cleanup:

```powershell
Remove-Item -LiteralPath "agents/testscripts/artifacts/beforward-accuracy-<timestamp>.json"
```

Do not delete artifacts that were used for rollout evidence or defect reports.

## Defect Report Fields

When the test fails, record:

- Title and severity.
- Command executed.
- Environment matrix: OS, Node version, `npm -v`, whether `BF_FORCE_SCRAPLING` was set.
- Artifact path.
- Observed summary fields.
- Expected threshold that failed.
- Sample row IDs and source URLs for live terminal rows.
- Suspected boundary: source discovery, Supabase counts, source fetch, terminal classification, or network/bot-block.
