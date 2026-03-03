# TS ORM Removal Verification

## Objective
Verify legacy ORM is fully removed from runtime/build/test paths with auth canary checks.

## Commands
1. `npm run test`
2. `npm run build`
3. `npm run dev` (smoke only, optional in CI)
4. Run a repository content scan for legacy ORM references.

## Expected
- Test suite passes.
- Build completes.
- Auth routes still compile and run.
- No legacy ORM references remain in code/config/scripts.
