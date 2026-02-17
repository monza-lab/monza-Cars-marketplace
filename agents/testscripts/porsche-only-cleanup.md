## Testscript: Porsche-only DB cleanup and verification

Identifier: `TS-PORSCHE-ONLY-CLEANUP`

Objective:
- Archive and remove non-Porsche rows from listing-serving and Prisma auction-serving tables.
- Prove only Porsche remains visible at DB layer.

Prerequisites:
- `.env.local` contains `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
- Dependencies installed (`npm ci` or `npm install`).

Setup:
1. Ensure local branch is clean enough to run scripts.
2. Confirm DB credentials exist.

Run commands:

```bash
node scripts/porsche_db_cleanup.mjs
```

Expected observations:
- Script prints a summary with `nonPorscheListingsRemaining: 0`.
- Script prints a summary with `nonPorscheAuctionsRemaining: 0`.
- Artifact folder is created at `var/porsche-cleanup/<run_id>/`.

Artifact capture points:
- `var/porsche-cleanup/<run_id>/01_env.json`
- `var/porsche-cleanup/<run_id>/02_preflight_counts.json`
- `var/porsche-cleanup/<run_id>/03_backup_manifest.json`
- `var/porsche-cleanup/<run_id>/04_post_checks.json`
- `var/porsche-cleanup/<run_id>/05_summary.json`

Cleanup:
- None.

Rollback:
- Restore deleted rows from `ops_archive.<table>_non_porsche_<run_id>` into source tables.
- Apply reverse order for parent/child dependencies (`listings` and `Auction` last).

Known limitations:
- If other app surfaces rely on static curated data, this script does not alter those static files.
