# πD

Personal board: **today / week / calendar / SOPs / kanban** + optional Grok assist.

Core app is a local web UI. Board lives in one JSON file so machines stay in sync.

---

## Quick start

Node **20+** once. Then open it like an app:

```bash
npm install
npm run build
npm run open          # starts server + app window (Mac / Windows / Linux)
```

### Double-click

| OS | Do this |
|----|---------|
| **Mac** | Double-click `πD.command` · or `npm run install:app` → `~/Applications/πD.app` → keep in Dock |
| **Windows** | Double-click `πD.vbs` · or `npm run install:app` → Desktop + Start Menu shortcut |

`npm run open` / the shortcuts:
1. start the local server if it isn’t up
2. open Chrome / Edge / Brave in **app mode** (no tabs, no URL bar)

Server keeps running in the background so closing the window doesn’t lose the board. Re-open anytime — same one-click.

| OS | Dev | Server only |
|----|-----|-------------|
| Mac / Linux | `./scripts/dev.sh` | `./scripts/start.sh` |
| Windows | `npm run dev` | `npm start` or `npm run start:bg` |

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

## Free sync (Mac ↔ Windows)

**Syncthing** (no account, no fees). Full guide: [`SYNCTHING.md`](./SYNCTHING.md).

| What | How |
|------|-----|
| Folder ID | `pid-routine` (label **piD**) |
| Syncs | app code · `data/` · `vault/` · `.env.local` |
| Skips | `node_modules` · `dist` · `.git` (see `.stignore`) |

**Windows (this machine):** already set up — tray app + login start + folder shared. UI → http://127.0.0.1:8384

**Mac (once):**

```bash
brew install syncthing && brew services start syncthing
open http://127.0.0.1:8384
# Add Windows device + accept folder pid-routine → ~/Sync/pid
cd ~/Sync/pid && npm install && npm run build
npm run install:app && open ~/Applications/πD.app
```

Device ID and click-path: **`SYNCTHING.md`**.

### Alternatives

iCloud/Drive/Dropbox also work if you drop the project in a cloud folder. Git alone is awkward for live `board.json` churn. Avoid heavy board edits on two devices in the **same second** (last write wins).

---

## Mac setup (copy-paste)

```bash
# 1) put the project in a synced place (Syncthing or iCloud Drive)
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/pid   # or ~/Sync/pid

# 2) once
npm install && npm run build
chmod +x scripts/*.sh πD.command
npm run install:app          # → ~/Applications/πD.app

# 3) open
open ~/Applications/πD.app
# Dock: right-click → Options → Keep in Dock
```

After that it’s just the Dock icon — no terminal, no sync thinking (board file lives in the synced folder).

**Login start (optional):** System Settings → General → Login Items → add `πD.app`.

## Windows setup (copy-paste)

```powershell
# 1) synced folder (Syncthing) or clone
cd $env:USERPROFILE\Sync\pid   # or wherever

# 2) once
npm install; npm run build
npm run install:app            # Desktop + Start Menu

# 3) open — double-click Desktop "πD" or:
npm run open
```

---

## Google Calendar

Reminders ride on Google. Two modes:

### A — Auto-sync (recommended)

Push dated board items into **one** Google calendar you choose. 15‑min popups. Idempotent via stable `iCalUID` (re-sync updates, doesn’t duplicate).

1. [Google Cloud Console](https://console.cloud.google.com/) → create/select project  
2. **APIs & Services → Enable APIs → Google Calendar API**  
3. **Credentials → Create OAuth client ID** (Desktop app, or Web with redirect below)  
4. Authorized redirect URI:
   ```text
   http://127.0.0.1:4000/api/google/callback
   ```
5. Copy into `.env.local`:
   ```bash
   GOOGLE_CLIENT_ID=....apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://127.0.0.1:4000/api/google/callback
   ```
6. Restart `npm run dev`  
7. Footer **gcal** → browser Google login → **gcal** again → pick calendar number  
8. **gcal** = sync now · **ctrl+gcal** = toggle auto-sync on board save · **alt+gcal** = change calendar · **shift+gcal** = ICS file instead

Tokens: `data/google-oauth.json` · prefs: `data/google-cal.json` (both gitignored).

### B — Manual ICS (no Google Cloud)

1. Due date (± time) on tasks  
2. Task detail → **add to Google Calendar**, or footer **shift+gcal** → import ICS  
3. `GET /api/calendar.ics?days=21`

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
| `GET/POST /api/google/*` | Google Calendar OAuth + sync |
| `GET /api/calendar.ics` | ICS export |

---

## Layout

```text
src/           app + assist API
data/          board.json (execution — sync live)
vault/         clean markdown knowledge (app-owned)
public/        icons / PWA bits
scripts/       start.sh · dev.sh · Windows bg helpers
```

---

## Phone

Same Wi‑Fi as the machine running πD:

```text
http://<lan-ip>:4000/
```

Board stays consistent via `/api/board` + disk file.
