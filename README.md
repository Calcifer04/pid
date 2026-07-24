# πD

Personal board: **today / week / calendar / SOPs / kanban** + optional Grok assist.

Core app is a local web UI. Board lives in one JSON file so machines stay in sync.

**Not included in the portable package:** Rainmeter desk skins, Alt+G spotlight (Windows-only extras under `rainmeter/`).

---

## Quick start

```bash
npm install
npm run build
npm start          # http://127.0.0.1:4000/
```

| OS | Dev | Production-ish |
|----|-----|----------------|
| Mac / Linux | `./scripts/dev.sh` | `./scripts/start.sh` |
| Windows | `npm run dev` | `npm start` or `npm run start:bg` |

Node **20+** required.

---

## Knowledge vault (clean)

Markdown tree owned by this app — **not** the old Obsidian vault.

```text
vault/
  CONVENTIONS.md     rules + status vocabulary
  inbox/             capture
  projects/          workstream depth notes
  sops/              standing-duty writeups
  journal/daily/     EOD reports (YYYY-MM-DD.md)
  journal/worklogs/  session logs
  _templates/        starters
```

- **Board** (`data/board.json`) = what to do now  
- **Vault** (`vault/`) = why / design / narrative  
- **Legacy** `Documents/obsidian-247` = leave alone (safe archive)

Optional path overrides: `ROUTINE_DATA`, `ROUTINE_VAULT` (see `.env.example`).

## Free sync (Mac ↔ Windows ↔ phone)

| What | Sync |
|------|------|
| `data/board.json` | Syncthing / iCloud (live queue) |
| `vault/` | same share or git |
| app code | git |

### Option A — Syncthing (recommended, fully free)

1. Install [Syncthing](https://syncthing.net/) on each machine.
2. Share the whole `routine` project folder **or** `data/` + `vault/`.
3. Run πD from that shared folder (or set `ROUTINE_DATA` / `ROUTINE_VAULT`).

```bash
export ROUTINE_DATA="$HOME/Sync/pid/board.json"
export ROUTINE_VAULT="$HOME/Sync/pid/vault"
./scripts/start.sh
```

Windows (PowerShell):

```powershell
$env:ROUTINE_DATA = "$env:USERPROFILE\Sync\pid\board.json"
$env:ROUTINE_VAULT = "$env:USERPROFILE\Sync\pid\vault"
npm start
```

### Option B — iCloud / Drive / Dropbox free tier

Put the project (or `data/` + `vault/`) inside the cloud folder.

Avoid editing the board heavily on two devices at the **same second** (last write wins).

### Option C — Git only

Fine for code + vault prose. Awkward for live `board.json` churn — prefer Syncthing for the board file.

---

## Mac setup (copy-paste)

```bash
# 1) get the project into a synced place (Syncthing or iCloud)
cd ~/Sync/pid-routine   # or wherever

# 2) once
npm install
npm run build
chmod +x scripts/*.sh

# 3) run
./scripts/start.sh
# open http://127.0.0.1:4000/
```

**Dock-like use:** open in Chrome/Safari → *Add to Dock* / *Add to Home Screen*.

**Login start (optional):** create a LaunchAgent that runs `scripts/start.sh`, or add the script to Login Items.

---

## Assist (Grok)

```bash
cp .env.example .env.local
# set XAI_API_KEY=...
```

Without a key, the board still works; assist stays offline.

---

## API (core)

| Endpoint | Use |
|----------|-----|
| `GET/PUT /api/board` | Shared board JSON |
| `GET/POST /api/assist` | Grok tools |
| `POST /api/desk` | Text assist (no UI) |

Windows-only desk skins hit extra routes under `/api/rainmeter` — ignore on Mac.

---

## Layout

```text
src/           app + assist API
data/          board.json (execution — sync live)
vault/         clean markdown knowledge (app-owned)
public/        icons / PWA bits
scripts/       start.sh · dev.sh · Windows bg helpers
rainmeter/     optional Windows extras — not required
```

---

## Phone

Same Wi‑Fi as the machine running πD:

```text
http://<lan-ip>:4000/
```

Board stays consistent via `/api/board` + disk file.
