# Closed-Loop Scraper Assurance and Production Promotion Design

**Date:** 2026-08-31

**Status:** Approved direction; awaiting written specification review

**Supersedes:** The repair-loop and delivery restrictions in `2026-07-13-weekly-scraper-assurance-design.md`

## Goal

Make weekly scraper assurance consume every unresolved listing-field gap, run every applicable safe repair, diagnose and repair scraper code when deterministic enrichment cannot close a gap, require 100% contract resolution, and automatically promote validated code fixes to production.

The system must spend agent time only when deterministic repair cannot resolve the queue. A successful run ends with zero unresolved required fields and, when code changed, the validated fix merged into the production branch and the resulting production deployment verified.

## Meaning of 100% Coverage

Success means 100% **contract resolution** across every active listing for every declared source. Each required field must be either:

- populated from source data;
- populated from an authoritative enrichment mechanism; or
- backed by fresh, URL-bound evidence that the source does not publish the field.

Raw completeness remains a separate metric and may be below 100% when a source genuinely omits information. `temporarily_blocked`, `invalid_source_value`, expired evidence, and unverified absence remain unresolved and prevent success.

## Selected Architecture

Use three connected layers.

### 1. Deterministic assurance planner

The assurance scanner remains the authority for inventory, source contracts, live canaries, and listing-field evaluation. It converts the listing-level repair queue into a deduplicated repair plan grouped by source, field, reason, and registered repair job.

The planner must validate that every unresolved field has at least one registered repair path. Missing mappings are manifest failures, not warnings.

### 2. Queue-driven repair executor

Replace the generic legacy enrichment invocation with an executor that consumes the assurance plan. The executor:

- resolves manifest repair IDs to actual CLI or cron jobs through the authoritative runner registry;
- starts the local application server when selected cron jobs require it;
- runs only non-destructive enrichment and evidence jobs;
- re-scans contract resolution after each repair wave;
- records per-job progress, affected sources and fields, timeouts, circuit breakers, and zero-progress outcomes;
- stops early only at 100% contract resolution or when every remaining gap has a precise blocker;
- fails nonzero whenever unresolved fields remain.

The arbitrary legacy fill-rate thresholds do not determine assurance success. The final assurance contract does.

### 3. Agent repair and release loop

When deterministic jobs leave blockers, the scheduled Codex task reads the structured blocker report. For each affected source it reproduces the smallest failure, captures a sanitized fixture where legally and technically possible, writes a failing regression test, applies the smallest parser or writer correction, and reruns the affected repair path.

The agent may make at most three evidence-driven code-repair attempts per source per scheduled run. It must not invent data, bypass marketplace controls, weaken the completeness contract, or mark blocked fields unavailable without successful source evidence.

## Repair Planning and Execution

The repair plan contains:

- initial unresolved count and contract-resolution percentage;
- source, listing, field, and unresolved reason;
- ordered executable repair jobs;
- whether each job requires the application server;
- safe runtime and retry limits;
- progress from each repair wave;
- remaining blocker classification.

Jobs are deduplicated while retaining the gaps they are expected to repair. A job result is failed when it times out, exits nonzero, reports a circuit breaker, cannot start because its runtime is unavailable, or makes zero progress while eligible mapped gaps remain.

After every wave, the executor fetches a fresh database snapshot and rebuilds the queue. It must not infer success from command exit codes.

## Source-Unavailable Evidence

Repair jobs may record `unavailable_at_source` only after fetching the canonical source URL successfully and confirming that a contract-permitted field is absent. Evidence must retain the checked time, canonical URL, extraction method, and content hash. It expires under the existing evidence TTL and is invalidated when the source URL changes.

Bulk assumptions, source-wide defaults, failed requests, block pages, and parser exceptions cannot create unavailable evidence.

## Blocker Contract

Every unresolved field at the end of a repair run must be classified as one of:

- missing repair mapping;
- source access blocked;
- parser or normalization defect;
- writer or database defect;
- repair job timeout;
- circuit breaker;
- repair job made no progress;
- source evidence inconclusive;
- credential or runtime unavailable.

The artifact includes affected sources, fields, listing counts, representative redacted listing identifiers, attempted jobs, and recommended next action. A run with any blocker is `blocked` and exits nonzero.

## Automatic Production Promotion

Validated scraper code repairs are automatically delivered rather than left in draft pull requests.

The scheduled Codex task must:

1. Work in an isolated `codex/` branch and preserve unrelated user changes.
2. Run focused regression tests, the full scraper-assurance suite, relevant live canaries, the final 100% production contract scan, lint/type checks, and the production build.
3. Commit and push only the repair-related changes and evidence-safe fixtures.
4. Open a ready-for-review pull request with before/after metrics and repair evidence.
5. Wait for the repository's required GitHub and Vercel preview checks.
6. Enable squash auto-merge only when every required check succeeds and contract resolution is exactly 100%.
7. Verify that the merged commit reaches the production branch and that the linked Vercel production deployment becomes ready.
8. Run post-deployment scraper-health and application smoke checks.

If preview, merge, production deployment, or post-deployment verification fails, the automation must not claim production success. It must retain or restore the last verified production deployment when platform credentials permit rollback and report the exact blocker.

Production data enrichment happens directly through the bounded repair jobs and therefore does not wait for a code deployment. Code fixes are promoted only after those same fixes prove the complete contract against production data.

## CI and Credential Requirements

The release workflow uses pinned tool versions and repository secrets. It requires:

- GitHub permission to push `codex/` branches, create pull requests, read checks, and enable auto-merge;
- Supabase production credentials for bounded repair and final contract verification;
- scraper network and browser dependencies required by source canaries;
- Vercel project linkage and a token capable of reading deployments and promoting or rolling back when Git integration does not complete automatically;
- the production base URL for smoke verification.

Secrets must remain in the host, GitHub Actions, or Vercel secret stores and must never appear in artifacts, fixtures, commits, command output, or pull-request text.

## Safety Boundaries

The closed loop may:

- add or correct listing enrichment fields;
- persist verified field-resolution evidence;
- repair scraper discovery, parsing, normalization, and writer code;
- add sanitized regression fixtures and tests;
- merge and deploy validated scraper repairs automatically.

It may not:

- delete listings or bulk-change lifecycle status;
- run schema migrations automatically;
- change authentication, access policies, or secrets;
- weaken required-field contracts or quality gates to obtain a pass;
- bypass CAPTCHAs, authentication, robots controls, or marketplace access restrictions;
- deploy with unresolved fields, failing tests, failed canaries, missing checks, or an unverified build.

## Verification Strategy

Regression tests must prove:

- repair plans are derived from the actual assurance queue;
- all mapped jobs are selected and deduplicated;
- cron jobs remain selectable when the application server is started;
- unknown repair IDs fail manifest validation;
- timeouts, circuit breakers, and eligible zero-progress jobs fail the wave;
- the queue is rebuilt after each wave;
- 100% contract resolution is the only successful terminal state;
- source-unavailable evidence remains evidence-bound;
- remaining blockers produce a nonzero exit and structured artifact;
- deployment eligibility is false for any incomplete gate;
- auto-merge and production verification occur only for fully eligible repairs.

Fresh verification before release consists of the focused tests, full scraper-assurance suite, relevant scraper suites, lint/type checking, production build, bounded live canaries, production completeness scan, GitHub checks, Vercel deployment readiness, and post-deployment smoke checks.

## Scheduled Automation Correction

Update `Weekly scraper assurance` so it no longer stops at a draft pull request. Its operating contract must invoke the queue-driven repair command, use the blocker artifact for TDD parser repair, and automatically merge and verify production only after all release gates pass.

The schedule remains weekly. The automation may also be invoked manually after an urgent scraper regression.

## Definition of Done

Implementation is complete when:

- the assurance repair queue drives execution rather than merely appearing in a report;
- every unresolved field maps to an executable repair path or explicit manifest failure;
- every declared source participates in planning and live assurance;
- the repair command exits zero only at 100% contract resolution;
- unavailable-at-source evidence is safely recordable through repair jobs;
- blocked runs identify exact remaining gaps and do not deploy;
- code defects follow a demonstrated red-green regression cycle;
- eligible fixes are pushed, checked, auto-merged, deployed, and verified in production;
- the scheduled automation contains the corrected production-promotion contract;
- a live end-to-end run demonstrates either verified production success or a precise blocked result without false success.

## Non-Goals

- Inventing facts that marketplaces do not publish.
- Circumventing source access controls.
- Automatically applying database schema or authentication changes.
- Treating raw completeness below 100% as failure when every absence has valid source evidence.
- Deploying unrelated changes from a dirty checkout.
