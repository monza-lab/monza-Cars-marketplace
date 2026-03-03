# Failure Report

- title: TS-P4-ORM-EXIT blocked by leftover ORM TypeScript config import
- severity: high
- frequency: 2/2 build attempts after ORM exit edits
- phase: Phase 4 - Remove ORM Runtime/Build Connections
- script identifier: TS-P4-PRISMA-EXIT
- environment matrix: win32, Node v24.5.0, npm 11.5.2, Next 16.1.6, git sha 3f5119b
- build commit: 3f5119b
- exact reproduction steps:
  1. Run `npm install`
  2. Run `npm run test`
  3. Run `npm run build`
  4. Apply one-variable fix in `src/features/ferrari_collector/historical_backfill.ts` to remove `dotenv` runtime import
  5. Run `npm run build` again
- observed behavior:
  - Build attempt 1 failed: module resolution error for `dotenv` in `src/features/ferrari_collector/historical_backfill.ts`
  - Build attempt 2 failed: TypeScript compile error in `orm.config.ts` because the ORM config module is no longer installed
- expected behavior:
  - `npm run build` passes with no ORM runtime/build coupling
- artifact references with timestamps:
  - `src/features/ferrari_collector/historical_backfill.ts` (updated during debug turn 1)
  - `orm.config.ts` (failing import boundary)
  - Terminal run at 2026-03-03 local session: `npm run build` attempt 1 and attempt 2
- suspected boundary: build configuration boundary (residual ORM config file after dependency removal)
- initial hypothesis: ORM package removal succeeded in app runtime, but `orm.config.ts` remains in compile scope and imports ORM config module
- workaround if available: temporary workaround is to restore ORM dev dependency or exclude/remove `orm.config.ts`; neither was applied due mandatory stop rule
- regression test status: halted after mandatory two-debug-turn ceiling; no further phase advancement
- ownership: EYE execution agent + repository owner for unblocking decision
