# BaT Live Refresh Merge And Cron Status - 2026-05-15

## Locality Envelope

- Files changed by this tracking note: 1
- Approx LOC/file: this file ~95 LOC
- Dependencies added: 0

## Branch And Merge Status

- Feature branch: `codex/porsche-bat-live-refresh`
- Feature worktree: `.worktrees/porsche-bat-live-refresh`
- Feature commit: `25c5ca2 feat(scrapers): add porsche bat live refresh workflow`
- Merged to `main` with merge commit: `d7f1745 merge: porsche bat live refresh`
- Pushed to `origin/main`.
- Later workflow schedule hardening commits on `main`:
  - `f2b81e1 ci: offset bat live refresh schedule`
  - `e8baeed ci: use explicit bat live refresh cron minutes`

## What Was Implemented

- Added GitHub Actions workflow: `.github/workflows/bat-live-refresh.yml`
- Added CLI entrypoint: `scripts/bat-live-refresh.ts`
- Added live refresh implementation: `src/features/scrapers/porsche_collector/live_refresh.ts`
- Added focused tests: `src/features/scrapers/porsche_collector/live_refresh.test.ts`
- Added package script:
  - `npm run scrapers:bat-live-refresh`

The workflow currently:

- Runs on manual `workflow_dispatch`.
- Is intended to run every five minutes via `schedule`.
- Uses `concurrency.group: bat-live-refresh`.
- Uses `cancel-in-progress: false`.
- Calls:

```bash
npx tsx scripts/bat-live-refresh.ts \
  --limit=${{ github.event.inputs.limit || '60' }} \
  --timeBudgetMs=${{ github.event.inputs.time_budget_ms || '480000' }} \
  --delayMs=${{ github.event.inputs.delay_ms || '2500' }} \
  ${{ github.event.inputs.dry_run == 'true' && '--dryRun' || '' }}
```

## Live Refresh Behavior

- Queries active/future Porsche Bring a Trailer listings.
- Also performs a bounded sweep of expired active listings.
- Fetches current BaT detail pages.
- Parses current bid, bid count, end time, and terminal auction result when present.
- Writes listing updates and `price_history` rows when a live bid changes.
- Marks terminal listings only when there is explicit terminal evidence.
- Does not treat generic market-commentary text like "sold for $181k" as a terminal result.
- Does not treat sidebar/watchlist bid UI as the authoritative current bid.
- Expired rows without clear terminal result are verification-only updates.

## Tests Already Run

### Local Unit Tests

Command:

```bash
npm test -- src/features/scrapers/porsche_collector/live_refresh.test.ts
```

Result:

- Passed.
- 17 tests passed.
- 1 test file passed.

### Local Live DB Tests

Several live local runs were executed against real BaT pages and Supabase.

Observed successful update examples:

- Listing `7227f8f8-1333-4cb0-9fb5-7a8db5947f28`
  - Updated to `current_bid: 82666`
  - Updated to `bid_count: 28`
  - Inserted `price_history.price_usd: 82666`
- Listing `b1a47c5a-53da-453e-9c78-24e349c9134d`
  - Updated to `current_bid: 17052`
  - Updated to `bid_count: 8`

Observed terminal handling:

- Listings `f43b555e...` and `816b1082...` were marked `unsold` from explicit terminal evidence.
- No false sale prices were written from market-commentary text.

Broad local dry-run after fixes:

- `limit=20`
- `delayMs=500`
- `checked: 30`
- `changed: 2`
- `terminal: 0`
- `priceHistoryInserted: 2`
- `errors: []`

## GitHub Actions Manual Live Tests

Workflow name:

- `BaT Live Refresh`

Workflow ID:

- `277025455`

Dry-run dispatch:

- Run ID: `25891073787`
- URL: `https://github.com/monza-lab/monza-Cars-marketplace/actions/runs/25891073787`
- Event: `workflow_dispatch`
- Branch: `main`
- Commit: `d7f174585fdd989544f8b08a224c05f09cca58e7`
- Result: success.
- Logs showed `bat_live_refresh.dry_no_change`, one `bat_live_refresh.dry_change`, and `bat_live_refresh.done`.

Non-dry dispatch:

- Run ID: `25891117221`
- URL: `https://github.com/monza-lab/monza-Cars-marketplace/actions/runs/25891117221`
- Event: `workflow_dispatch`
- Branch: `main`
- Commit: `d7f174585fdd989544f8b08a224c05f09cca58e7`
- Result: success.
- Logs showed several `bat_live_refresh.no_change` events and `bat_live_refresh.done`.
- No DB mutation was expected from this run because the checked listings were already current.

## Cron / Schedule Status

This is the remaining unresolved item.

The workflow is active:

```text
BaT Live Refresh active 277025455
```

The workflow file exists on `main`:

```text
.github/workflows/bat-live-refresh.yml
```

Manual `workflow_dispatch` runs work, but GitHub has not emitted a `schedule` event for this new workflow yet.

Schedule attempts tested:

1. Initial schedule:

```yaml
- cron: '*/5 * * * *'
```

2. Offset schedule to avoid busy five-minute boundaries:

```yaml
- cron: '2-59/5 * * * *'
```

3. Explicit minute-list schedule to avoid ambiguity in stepped range parsing:

```yaml
- cron: '2,7,12,17,22,27,32,37,42,47,52,57 * * * *'
```

After each schedule change, the workflow was pushed to `main` and monitored with GitHub CLI. As of the last check on `2026-05-15T00:04:06Z`, no `schedule` run existed for `BaT Live Refresh`; only the two successful manual dispatches existed.

The workflow was also disabled and re-enabled once with:

```bash
gh workflow disable "BaT Live Refresh" --repo monza-lab/monza-Cars-marketplace
gh workflow enable "BaT Live Refresh" --repo monza-lab/monza-Cars-marketplace
```

That reactivation succeeded, but the follow-up long poll was interrupted before a final answer was collected.

## Important Current Caveat

The live refresh code works when GitHub Actions executes it manually.

The missing proof is GitHub creating a real `schedule` run for this specific workflow. Until a run with `event: schedule` appears for workflow ID `277025455`, the cron path should be treated as not fully verified.

## Commands To Check Later

List recent runs for this workflow:

```bash
gh api --method GET repos/monza-lab/monza-Cars-marketplace/actions/workflows/277025455/runs \
  -F per_page=20 \
  --jq '.workflow_runs[] | [.id,.event,.status,.conclusion,.created_at,.run_started_at,.head_sha,.head_branch,.html_url] | @tsv'
```

Check whether any scheduled run exists:

```bash
gh api --method GET repos/monza-lab/monza-Cars-marketplace/actions/workflows/277025455/runs \
  -F per_page=50 \
  --jq '.workflow_runs[] | select(.event=="schedule") | [.id,.event,.status,.conclusion,.created_at,.html_url] | @tsv'
```

If a scheduled run appears, watch it:

```bash
gh run watch RUN_ID --repo monza-lab/monza-Cars-marketplace --exit-status
```

Then inspect logs:

```bash
gh run view RUN_ID --repo monza-lab/monza-Cars-marketplace --log |
  Select-String -Pattern 'bat_live_refresh|event|current_bid|priceHistoryRow|done|error'
```

## Pass Criteria

This work can be considered fully verified when all of the following are true:

- A `BaT Live Refresh` run appears with `event: schedule`.
- That scheduled run completes successfully.
- Logs include `bat_live_refresh.done`.
- Logs show either:
  - clean `no_change` checks, or
  - real listing mutations with matching persisted Supabase rows.

## If Cron Still Does Not Fire

Recommended next steps:

1. Wait longer after the latest explicit-minute schedule commit because newly added scheduled workflows can lag.
2. Confirm Actions settings for the repository allow scheduled workflows.
3. Check whether GitHub suppressed the new high-frequency schedule.
4. Reduce cadence temporarily to a simple once-hourly offset schedule to prove scheduler registration:

```yaml
- cron: '17 * * * *'
```

5. If hourly schedule fires but five-minute schedule does not, keep the hourly schedule or move five-minute execution to a dedicated external scheduler.

## Current Worktree Notes

The main worktree still contains unrelated pre-existing dirty/untracked files. They were intentionally left untouched.

Known unrelated tracked dirty file:

```text
supabase/.temp/cli-latest
```

