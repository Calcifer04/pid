# πD vault conventions

This folder is the **clean knowledge layer** for πD.

The old Obsidian vault (`Documents/obsidian-247`) is **untouched** — archive / reference only.
Do not merge or auto-import it. Copy a note by hand if you still need it.

---

## Roles

| Layer | Where | Job |
|-------|--------|-----|
| **Execution** | `data/board.json` (πD UI) | Today, focus, due dates, SOP checkoffs, phases |
| **Knowledge** | `vault/` (this tree) | Why, design, worklogs, daily narrative |
| **Code** | git repos | Implementation |

πD tasks/SOPs are the queue. Notes here are depth. Link them; don’t duplicate status in two places.

---

## Folder map

```text
vault/
  CONVENTIONS.md          ← you are here
  README.md
  inbox/                  ← capture; triage quickly; keep empty
  projects/               ← long-lived workstreams (one folder each)
  sops/                   ← optional long-form bodies for standing duties
  journal/
    worklogs/             ← session notes (agents + you)
    daily/                ← finished end-of-day reports only
  _templates/             ← copy from these; don’t edit in place as notes
```

---

## Status vocabulary (notes only)

Use **one** of:

```yaml
status: active      # in flight
status: blocked     # waiting on someone/something
status: done        # finished
status: parked      # not now
status: idea        # maybe later
```

Board `done` / phase / SOP log remain the **live** execution state.
Note `status` is for browsing projects in the vault, not a second kanban.

---

## Naming

| Kind | Pattern | Example |
|------|---------|---------|
| Project note | `projects/<area>/<slug>.md` | `projects/discord-bot/multi-server.md` |
| SOP body | `sops/<slug>.md` | `sops/daily-report.md` |
| Worklog | `journal/worklogs/YYYY-MM-DD — <slug>.md` | `2026-07-24 — of-webhooks.md` |
| Daily report | `journal/daily/YYYY-MM-DD.md` | one file per calendar day |

Slugs: lowercase, hyphens, no dates in project slugs (date belongs in worklog/daily).

---

## Frontmatter

### Project / task depth note

```yaml
---
type: project
status: active
area: discord-bot          # folder name under projects/
boardTaskId:               # optional πD task uuid when linked
repo:                      # optional code repo path or name
updated: YYYY-MM-DD
---
```

### SOP body

```yaml
---
type: sop
status: active
boardSopId:                # optional πD sop uuid
cadence: daily             # human label; real cadence lives on the board
updated: YYYY-MM-DD
---
```

### Worklog

```yaml
---
type: worklog
date: YYYY-MM-DD
project:                   # area or note path
boardTaskId:
---
```

### Daily report

```yaml
---
type: daily
date: YYYY-MM-DD
---
```

---

## How this maps to the app

| πD (`board.json`) | Vault |
|-------------------|--------|
| `tasks[]` | optional `projects/...` note via `boardTaskId` / future `notePath` |
| `sops[]` | optional `sops/<slug>.md` |
| `phases[]` | execution only — not mirrored as folders |
| `focusId` | execution only |
| `sopLog` | execution only |
| completions today | feed `journal/daily/YYYY-MM-DD.md` at wrap |
| session work | `journal/worklogs/` |

**Rule:** if it’s “do I need to do this today?” → board.  
**Rule:** if it’s “what’s the design / what happened?” → vault.

---

## Agent contract (short)

1. Read `vault/CONVENTIONS.md` + open board tasks before planning.
2. Log sessions under `journal/worklogs/`.
3. Don’t rewrite history in old dailies; append or add a new worklog.
4. EOD: draft `journal/daily/YYYY-MM-DD.md` from board completions + today’s worklogs.
5. Never touch `Documents/obsidian-247` unless the human says so.

---

## Sync (PC ↔ laptop)

| Path | How |
|------|-----|
| `data/board.json` | Syncthing / iCloud (live) |
| `vault/` | same share **or** git (this repo) |
| App code | git |

Set on both machines if paths differ:

```bash
ROUTINE_DATA=/path/to/data/board.json
ROUTINE_VAULT=/path/to/vault
```

Default vault path = `<repo>/vault`.
