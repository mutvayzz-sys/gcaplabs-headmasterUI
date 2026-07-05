# Vendored hermeshq removal audit

**Scope:** `gcaplabs-headmasterUI/hermeshq/` — the former vendored copy of the HermesHQ backend with `.git` removed. The separate workspace-root `gcaplabs-hermeshq/` legacy repo is out of scope unless explicitly requested.

## Findings

1. **Vendored tree location and size before deletion**
   - Path: `gcaplabs-headmasterUI/hermeshq/`
   - Size: ~64 MB
   - Tracked by git: 504 files (`git ls-files hermeshq | wc -l`)
   - Nested `.git`: none

2. **Runtime/code references from Headmaster UI to `hermeshq/`**
   - No imports, build steps, or code references from `packages/`, `scripts/`, or `tests/` into `hermeshq/`.
   - The only active source-adjacent reference was a stale `packages/desktop/.env.example` sample:
     ```
     # Example: https://hermeshq.gcaplabs.com
     VITE_HERMESHQ_URL=
     ```
   - That sample has been replaced with:
     ```
     # Example: https://www.console.gcaplabs.com
     VITE_CONSOLE_URL=
     ```
   - `VITE_HERMESHQ_URL` is not consumed anywhere in current TypeScript source under `packages/desktop/src/`.
   - Active desktop source has zero `__hermeshq`, `hermeshq:`, or `getHermeshq*` references.

3. **Build / workspace / package references**
   - `package.json` workspaces entry is `packages/*`; `hermeshq/` is not included.
   - No `.gitmodules` file exists, so it is not a git submodule.
   - No lockfile (`bun.lock`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`) references `hermeshq`.
   - `packages/desktop/electron-builder.yml`, `packages/desktop/electron.vite.config.ts`, `scripts/build-with-builder.js`, and `scripts/afterPack.js` have no `hermeshq` hits.

4. **Other references outside active code**
   - Remaining mentions in `AGENTS.md`, `ARCHITECTURE.md`, `assetgen.md`, `mastertodo.md`, and `masterlog.md` are historical documentation or cleanup records.
   - Stale `.gitignore` entries for `hermeshq/backend/.venv/`, `hermeshq/frontend/node_modules/`, `hermeshq/**/__pycache__`, and `hermeshq/**/*.pyc` were removed.

5. **Legacy `gcaplabs-hermeshq/`**
   - This is a separate directory at the workspace root, not the vendored copy removed here.
   - It remains untouched. HermesHQ VPS teardown is owner-owned/manual and is not tracked by this cleanup.

## Conclusion

Deletion of the vendored `gcaplabs-headmasterUI/hermeshq/` tree was safe from a build/runtime perspective and has been performed. The Headmaster desktop app no longer depends on it; the current paths are Agent37 Cloud and the retained local Headmaster runtime.

## Removal checklist

- [x] Confirmed no active build/runtime dependency on the vendored copy.
- [x] Replaced stale `packages/desktop/.env.example` HermesHQ URL sample with `VITE_CONSOLE_URL`.
- [x] Removed stale `hermeshq/` artifact ignores from `.gitignore`.
- [x] Deleted `gcaplabs-headmasterUI/hermeshq/`.
- [x] Verify the build still passes:
  - `bunx tsc --noEmit`
  - `bunx electron-vite build --config packages/desktop/electron.vite.config.ts`
- [ ] Stage and commit the deletion.
