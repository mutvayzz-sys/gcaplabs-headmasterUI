---
name: verify
description: Run the full check suite (type-check + lint + tests) and report results. Use after completing any non-trivial change to confirm nothing is broken before handing off.
---

Run these commands in order and report the results of each step:

1. **Type check**: `bunx tsc --noEmit`
2. **Lint**: `bun run lint`
3. **Unit tests**: `bun run test`

If any step fails, report the exact errors and stop — do not proceed to the next step.

If all steps pass, say so concisely. Do not summarize what you did; just confirm pass/fail per step.

If the change touched E2E-relevant code (Electron IPC, preload, main process startup), note that `bun run test:e2e` should also be run manually (it requires a real Electron instance and is not run here automatically).
