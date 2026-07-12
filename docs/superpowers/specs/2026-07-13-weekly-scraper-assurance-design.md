# Weekly Scraper Assurance and Repair Design

**Date:** 2026-07-13

**Status:** Approved design, pending implementation plan

**Schedule:** Sundays at 18:00 Europe/Berlin

**Execution environment:** Codex scheduled automation in an isolated worktree

## Goal

Create a deterministic repository assurance harness and a weekly LLM-driven Codex automation that checks every scraper and related job, evaluates every active retrieved listing against a source-specific completeness contract, repairs missing data and scraper defects within safe boundaries, reruns verification, and opens a draft pull request for validated code changes.

The system must make the claim of 100% coverage measurable. A successful weekly run means every registered scraper and job was checked, every active listing was evaluated, every required field was populated or verified as unavailable at the source, every source passed a bounded live canary, and no unresolved completeness failures remain.

## Existing Repository Context

The repository already contains source collectors, enrichment jobs, maintenance jobs, per-source tests, live monitoring, coverage snapshots, liveness checks, quality gates, and scheduled GitHub Actions workflows. These capabilities are not yet governed by one authoritative inventory or one complete data contract.

Known gaps include:

- `sourceRegistry.ts`, the scraper health audit's private job list, workflow files, scraper directories, and live database sources can disagree.
- The current coverage snapshot primarily detects zero active coverage and a small number of source-specific thresholds.
- The current scraper quality gate only fails on a failed run, zero output, or an image gap.
- Field-completeness reporting does not enforce source-specific requirements or retain consistent field-level resolution evidence.
- Live coverage data can contain sources that are not represented in the canonical source registry.

Implementation should extend and consolidate the existing monitoring and testing mechanisms rather than introduce a parallel scraper platform.

## Selected Architecture

Use a deterministic assurance harness plus a Codex repair loop.

Repository code owns inventory discovery, contracts, measurements, safe commands, machine-readable results, and pass/fail gates. The scheduled Codex task owns diagnosis, source inspection, code repair, regression-test creation, bounded production enrichment, final verification, and draft-PR delivery.

This division keeps the 100% guarantee repeatable while preserving LLM-driven repair for source-layout changes and other failures that deterministic code cannot anticipate.

## Authoritative Assurance Manifest

Create one repository-owned manifest as the source of truth for scraper assurance. It must represent every canonical source and every collector, enrichment, backfill, validation, cleanup, and liveness job.

Each source definition must declare:

- canonical source identifier and display name;
- collector, enrichment, backfill, validation, and liveness job identifiers;
- deterministic unit, fixture, contract, and live-canary commands;
- expected execution cadence and maximum bounded runtime;
- universal required listing fields;
- source-specific required fields;
- permitted `unavailable_at_source` exceptions;
- safe repair and enrichment commands;
- batch sizes, concurrency limits, and request-rate limits;
- production-write permissions;
- explicitly prohibited destructive operations.

Inventory validation must compare the manifest with:

- scraper feature directories;
- scraper and enrichment scripts;
- GitHub Actions workflow definitions;
- recent scraper job names;
- canonical and observed database sources;
- monitoring and maintenance job definitions.

The assurance run must fail when an executable scraper, workflow, observed source, or monitored job is not represented in the manifest.

## Listing Completeness Contract

Every active retrieved listing must be evaluated against four contract layers.

### Identity and display

The following fields are universal hard requirements and cannot be satisfied by `unavailable_at_source`:

- source;
- source-specific identifier;
- canonical source URL;
- title;
- make;
- model;
- year;
- listing mode;
- listing status;
- created and updated timestamps.

### Commercial and media information

Each listing must contain the representation appropriate for its source and listing mode:

- a valid listing price, current bid, hammer price, or final price;
- original currency;
- at least one valid image;
- the most precise location published by the source;
- auction start/end timing and reserve state when applicable.

### Vehicle specifications

The source contracts must cover at least:

- VIN;
- trim or variant;
- engine;
- transmission;
- mileage and mileage unit;
- exterior color;
- interior color;
- body style;
- description and seller-provided details.

A source may require additional fields when those fields materially improve the website and are consistently published by that source.

### Field-resolution evidence

Each required field must resolve to one of these states:

- `populated_from_source`;
- `populated_from_authoritative_enrichment`;
- `unavailable_at_source`;
- `temporarily_blocked`;
- `invalid_source_value`.

The listing's enrichment metadata must retain the field name, resolution state, checked timestamp, source URL, evidence method, and retry policy. `temporarily_blocked` and `invalid_source_value` remain unresolved and do not count toward contract completion.

`unavailable_at_source` is valid only when the source was fetched successfully and the captured evidence confirms the field is absent. A sudden increase in unavailable fields must be treated as a likely scraper regression.

Report two separate metrics:

- **Raw completeness:** required fields containing useful values.
- **Contract resolution:** required fields populated or verified unavailable.

Contract resolution must reach 100% for a successful run. Raw completeness must not regress without a documented source-level reason.

## Repair Hierarchy

For every unresolved field, execute the following hierarchy:

1. Re-fetch and parse the canonical detail page.
2. Read source-specific structured or alternate page data.
3. Run the existing deterministic enrichment route.
4. Use authoritative enrichment, such as VIN decoding, when applicable.
5. Use LLM extraction from captured source text when deterministic parsing cannot reliably represent the page.
6. Mark the field `unavailable_at_source` only when fetched source evidence confirms absence.

The LLM may repair selectors, pagination, normalization, extraction, and writer logic. It may structure facts present in source content. It must not infer or invent vehicle facts without source evidence.

## Weekly Execution Flow

### 1. Preflight

- Verify database, source-network, browser, GitHub, and required tool access.
- Confirm the automation is running in an isolated worktree.
- Confirm destructive operations are disabled.
- Confirm required secrets exist without printing them.

### 2. Static assurance

- Reconcile the manifest with repository and database evidence.
- Run unit, fixture, parser, normalization, writer, contract, and repair-policy tests.

### 3. Full data audit

- Scan every active listing in the database.
- Calculate raw completeness and contract resolution by source and field.
- Create a listing-level repair queue for all unresolved fields.

### 4. Live source assurance

- Run bounded discovery and detail-page canaries for every source.
- Detect empty results, pagination truncation, selector drift, blocking pages, malformed data, and write failures.
- Compare current page behavior with representative fixtures and parser output.

The system must scan all active database listings each week. It should not download every already-complete source detail page. Live requests should target every unresolved listing, expired evidence, bounded source canaries, and a rotating sample of complete listings.

### 5. Production data repair

- Run existing enrichment and backfill mechanisms in bounded, rate-limited batches.
- Apply additive or corrective field updates.
- Persist field-level resolution evidence.
- Recalculate completeness after every batch.
- Checkpoint work so interrupted runs can resume safely.

### 6. Code repair

When a parser or integration defect is detected:

- reproduce the smallest failing path;
- capture a sanitized regression fixture;
- add a failing regression test;
- patch the smallest affected boundary;
- rerun focused tests and a bounded live canary;
- allow at most three evidence-driven repair attempts per source in one weekly run.

### 7. Final assurance

- Rerun inventory, static tests, health checks, live canaries, and listing completeness.
- Require 100% contract resolution and zero unresolved required fields.
- Compare results with the preceding weekly run.
- Verify all production writes with follow-up queries.

### 8. Delivery

- If no code changed, publish the healthy or data-repair report without a pull request.
- If code changed and validation passes, commit the isolated changes and open a draft pull request.
- If unresolved failures remain, publish a blocked report with exact evidence and required human action.

## Safety Boundaries

The weekly automation may update missing or incorrect listing fields and enrichment evidence. It may not automatically:

- delete listings;
- mass-change active, sold, unsold, or delisted status;
- run schema migrations;
- modify secrets, access policies, or authentication configuration;
- deploy or merge its own pull request;
- bypass authentication, CAPTCHAs, or marketplace access controls;
- mark a field unavailable without captured source evidence.

All write batches must be bounded, checkpointed, idempotent, and followed by verification. Logs, reports, and fixtures must redact credentials, cookies, personal information, and proxy URLs.

## Verification Strategy

The repository harness must provide these verification layers:

- **Manifest tests:** every scraper, workflow, monitored job, and observed source is registered.
- **Contract tests:** source-specific field requirements and exception rules are consistent.
- **Fixture tests:** representative discovery and detail fixtures exist for every source.
- **Parser and writer tests:** extracted values reach the intended fields without overwriting stronger data.
- **Repair-policy tests:** prohibited destructive mutations are rejected.
- **Completeness tests:** every active listing receives the correct field-resolution classification.
- **Live canaries:** bounded discovery and detail retrieval succeed for every source.
- **Production verification:** unresolved required fields equal zero after repair.

The deterministic harness must emit a machine-readable report that Codex can use as the repair queue and that humans can inspect without reading raw logs.

## Weekly Report Contract

Every scheduled run must report:

- overall outcome: healthy, repaired, or blocked;
- sources, scrapers, and jobs checked;
- active listings evaluated;
- raw completeness before and after repair;
- contract resolution before and after repair;
- per-source and per-field gaps;
- listings enriched and fields updated;
- verified unavailable fields and supporting evidence;
- live-canary results;
- tests executed and results;
- code files changed;
- draft pull-request link when applicable;
- external blockers and exact required human action.

Historical reports should support week-over-week comparison without committing large production-data snapshots to Git.

## Scheduled Codex Automation

Create a Codex automation named **Weekly Scraper Assurance & Repair** with these properties:

- weekly schedule: Sunday at 18:00 Europe/Berlin;
- project scope: this repository;
- execution environment: fresh worktree;
- behavior: run the deterministic harness, repair data and code within this specification, verify the complete result, and report evidence;
- code delivery: draft pull request only;
- data permission: bounded additive and corrective production enrichment;
- destructive permission: none.

The automation must preflight environment credentials in the worktree. Missing credentials, unavailable source access, or an unsafe required change produces a blocked result, never a false success.

## Definition of Done

Implementation is complete when:

- one authoritative assurance manifest governs all scraper-related jobs and source contracts;
- one deterministic command executes the full assurance cycle and emits a structured report;
- inventory drift fails automatically;
- every active listing is evaluated against its source contract;
- field-level resolution evidence is retained;
- bounded live canaries cover every source;
- safe enrichment repairs can run in production;
- code defects enter a tested worktree repair loop;
- destructive mutations are mechanically prohibited;
- draft-PR delivery is validated;
- the weekly Codex automation is enabled for Sunday 18:00 Europe/Berlin;
- a live end-to-end run proves the healthy, repaired, or blocked reporting path without claiming success on unresolved failures.

## Non-Goals

- Guaranteeing that a marketplace exposes information it does not publish.
- Inventing values to improve completeness metrics.
- Replacing all existing daily GitHub Actions workflows.
- Automatically merging or deploying scraper repairs.
- Automatically changing listing lifecycle status in bulk.
- Circumventing marketplace access controls.
