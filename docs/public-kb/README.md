# Public Knowledge Base

> Public-facing documentation. Lives at `gcaplabs.com/docs` once the marketing site is wired.
> This is the **non-engineering** view of Headmaster — what it is, how to use it, how to hire the team.

This directory is the canonical place for the user-facing, customer-visible, or publicly linkable docs. It does **not** contain anything from the upstream `aionui` / `@office-ai/aioncli-core` / `iOfficeAI/AionCore` lineage — those references live in `docs/archive/upstream/` for the engineering team.

---

## What's in here

| File                 | Audience      | Purpose                                                   |
| -------------------- | ------------- | --------------------------------------------------------- |
| `getting-started.md` | End user      | Install Headmaster, first-run, log in, send first message |
| `the-council.md`     | End user      | What "The Council" (multi-agent) is and when to use it    |
| `hiring-the-team.md` | End user      | Browse the Agency, hire a Specialist, set up Open Casting |
| `scheduled-tasks.md` | End user      | Set up cron-style recurring work (The Schedule)           |
| `integrations.md`    | End user      | Channels, MCP servers, models                             |
| `tributes.md`        | Curious buyer | Lina tribute, Sorting Hat tribute, Adonis heritage, 5462  |

---

## What's NOT in here (engineering internals live elsewhere)

- `docs/portmap/` — engineering rename map and audit (HEADMASTER-PORTMAP.md)
- `docs/contributing/` — dev setup, code conventions
- `docs/guides/` — deployment, CDP, webui setup
- `docs/prds/` — product requirement docs (internal)
- `docs/theming/` — design tokens, theme customization
- `docs/readme/` — translated product README drafts (when product copy is ready)
- `docs/archive/upstream/` — engineering-only lineage notes (do not link publicly)

---

## How docs get added

1. User owns the contents.
2. Agent executes the write.
3. Both link here from `docs/README.md` (the public docs landing).
4. `docs/portmap/HEADMASTER-PORTMAP.md` is updated if a new rename-related doc is created.

---

## One open decision

**`docs/README.md` still needs a full rewrite to match the new branding + tribute map.** Currently it's still mostly the upstream AionUi readme structure. Want me to do that next?
