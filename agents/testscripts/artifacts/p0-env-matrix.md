# TS-P0-BASELINE Environment Matrix

- Timestamp (local): 2026-03-03
- OS: win32
- Node.js: v24.5.0
- npm: 11.5.2
- Next.js: 16.1.6
- Legacy ORM CLI: 7.4.0
- ORM client package: 7.4.0
- @supabase/supabase-js: 2.95.3
- @supabase/ssr: 0.8.0
- Git commit: 34494fa1594dd93fa9c2ad43109ea0f1579eed34

## Migration Flags Baseline (.env.local)

- MIGRATION_SUPABASE_ONLY: <missing>
- MIGRATION_READ_PARITY: <missing>
- MIGRATION_WRITE_SHADOW: <missing>

## NFR Baseline Targets (from canon/plan)

- p95 latency <= 500ms on critical routes
- availability >= 99.9%
- security boundary: no public write access
