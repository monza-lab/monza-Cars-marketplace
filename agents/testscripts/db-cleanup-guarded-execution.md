## Testscript: Guarded DB cleanup execution

Objective: Execute legacy-table cleanup with hard protection for `public.listings`, `public.photos_media`, `public.price_history`.

Prerequisites:
- `.env.local` contains `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Node dependencies already installed.

Run:

```bash
set -a && source .env.local && set +a && node scripts/db_cleanup_guarded.mjs
```

Expected observations:
- A new artifact folder is created under `var/db-cleanup/<run_id>/`.
- `01_preflight.json` and `05_post_verification.json` show identical row counts and digests for protected tables.
- `03_archive_report.json` shows parity checks for non-empty archive-first tables.
- `04_cleanup_actions.json` shows only quarantine moves for safe empty candidates (or skips with reason).
- No drop operations are executed.

Artifact capture points:
- `var/db-cleanup/<run_id>/01_preflight.json`
- `var/db-cleanup/<run_id>/02_dependency_report.json`
- `var/db-cleanup/<run_id>/03_archive_report.json`
- `var/db-cleanup/<run_id>/04_cleanup_actions.json`
- `var/db-cleanup/<run_id>/05_post_verification.json`
- `var/db-cleanup/<run_id>/06_final_summary.json`

Cleanup:
- None required for safety run.
- Optional rollback of quarantined table:

```sql
ALTER TABLE ops_quarantine.<table_name> SET SCHEMA public;
ALTER TABLE public.<table_name> RENAME TO <original_table_name>;
```

Known limitations:
- Activity signals use cumulative `pg_stat_user_tables`; non-zero values cause conservative skips.
- Function reference checks are pattern-based and may produce false positives, resulting in skip behavior.
