# Vendored hermeshq removal audit

**Scope:** `gcaplabs-headmasterUI/hermeshq/` (the vendored copy of the HermesHQ backend, `.git` removed), plus `gcaplabs-hermeshq/` (the legacy upstream repo) for comparison.

## Findings

1. **Vendored tree location and size**
   - Path: `gcaplabs-headmasterUI/hermeshq/`
   - Size: ~64 MB
   - Tracked by git: 504 files (`git ls-files hermeshq | wc -l`)

2. **Runtime/code references from Headmaster UI to `hermeshq/`**
   - **No imports, build steps, or code references** from `packages/`, `scripts/`, or `tests/` into `hermeshq/`.
   - The only reference in the source tree is a comment in `packages/desktop/.env.example`:
     ```
     # Example: https://hermeshq.gcaplabs.com
     VITE_HERMESHQ_URL=
     ```
   - `VITE_HERMESHQ_URL` is **not consumed anywhere** in the current TypeScript source under `packages/desktop/src/` (grep returned no matches). The old `__hermeshqProvision` and `window.__hermeshqProvision` paths have been removed from the current source as part of the Agent37 cutover.

3. **Build / workspace / package references**
   - `package.json` workspaces entry is `packages/*`; `hermeshq/` is not included.
   - No `.gitmodules` file exists, so it is not a git submodule.
   - No lockfile (bun.lock, package-lock.json, yarn.lock, pnpm-lock.yaml) references `hermeshq`.

4. **Other references outside the tree (all documentation / historical)**
   - `gcaplabs-headmasterUI/AGENTS.md`, `ARCHITECTURE.md`, `veeplan.md`, `assetgen.md`, `mastertodo.md`, `masterlog.md` describe the tree as historical / legacy.
   - `.gitignore` lists `hermeshq/` and `gcaplabs-hermeshq/` venv/node_modules/compiled artifact exclusions, which is expected.
   - `.hermes/plans/` and `.claude/settings.local.json` contain historical references only.
   - `gcaplabs-home/` (cross-project hub) has NotebookLM manifests and tracker files that reference the legacy HermesHQ repo, but these are not build dependencies.

5. **Legacy `gcaplabs-hermeshq/`**
   - This is a separate directory at the workspace root, not the vendored copy the task asks about. It is only referenced by documentation and cross-project trackers. It is also a candidate for deletion but is out of scope for this audit unless explicitly included.

## Conclusion

**Deletion of the vendored `gcaplabs-headmasterUI/hermeshq/` tree is safe from a build/runtime perspective.** The Headmaster desktop app no longer depends on it; the Agent37 Cloud path and the local Hermes runtime path are the current backends. The only references that remain are historical documentation and a stale `.env.example` comment.

## Minimal removal checklist

- [ ] Confirm with owner that no live HermesHQ instance still needs the vendored copy for reference.
- [ ] Remove or update the stale comment in `packages/desktop/.env.example` (line 3: `# Example: https://hermeshq.gcaplabs.com`).
- [ ] Remove the `hermeshq/backend/.venv/`, `hermeshq/frontend/node_modules/`, and `hermeshq/**/*.pyc` lines from `.gitignore` if they are no longer needed.
- [ ] Delete the `gcaplabs-headmasterUI/hermeshq/` directory (vendored tree).
- [ ] Verify the build still passes:
  - `bunx tsc --noEmit`
  - `bunx electron-vite build --config packages/desktop/electron.vite.config.ts`
- [ ] Stage and commit the deletion with a conventional commit message, e.g. `chore: remove unused vendored hermeshq tree`.
- [ ] (Optional, separate task) Evaluate whether `gcaplabs-hermeshq/` at the workspace root can also be removed; its deletion is independent of the vendored tree.

## Note

HermesHQ VPS teardown is owner-owned/manual and is not tracked in this task. The live runtime is now Agent37 Cloud; the local Headmaster runtime is retained per the owner decision in `ARCHITECTURE.md` and `veeplan.md`.
