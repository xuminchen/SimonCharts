# Chart Engine v1.0 Release Gate Orchestrator Writing Plan

**Problem:** The v1.0 RC release gate is documented as a manual command list. That makes it easy to skip a command, run commands out of order, or forget that tarball/host-smoke checks need fresh build output.

**Goal:** Add a single machine-executable release gate command for SimonCharts Engine that runs the full RC validation sequence with deterministic command ordering and fails on the first failing command.

**Boundary:** This is release tooling only. It does not change Engine runtime APIs, chart behavior, drawing behavior, extension behavior, package publication, npm automation, host product workflows, or TradingReviewSystem integration.

## Contract

`npm run check:release-gate` should:

- run the Engine RC validation commands in one deterministic sequence
- run `npm run build` before dist/tarball-dependent checks such as host smoke, package artifact, package type checks, package consumer checks, and npm pack dry-run
- run Playwright e2e with `PLAYWRIGHT_CHANNEL=chrome`
- print progress for each command
- stop on the first failure and exit with that command status
- remain host-independent and not import TradingReviewSystem or host business modules

## Execution Slices

1. Release gate script
   - Verify: `node scripts/check-release-gate.mjs` runs the documented gate sequence.
2. Root script and release readiness integration
   - Verify: `npm run check:release-gate` exists and `npm run check:release-readiness` requires it.
3. Documentation and release evidence
   - Verify: README files and Engine docs use `npm run check:release-gate` as the primary RC command and list the expanded sequence for transparency.

## Success Criteria

- A single `npm run check:release-gate` command executes the full local RC validation sequence.
- The expanded release gate remains visible in docs.
- Existing public API/type snapshots do not change.
- Engine boundary remains clean.
- The script does not publish packages or perform remote release automation.
