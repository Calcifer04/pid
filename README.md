# πD

Personal board: **today / week / calendar / SOPs / kanban** + optional Grok assist.

Core app is a local web UI. Board lives in one JSON file so machines stay in sync.

---

## Install (once)

Need **Node 20+** ([nodejs.org](https://nodejs.org)).

For a **native desktop app** (Tauri — own window/icon, not Edge/Chrome):
- **Windows:** [Rust](https://rustup.rs) + [VS Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (C++ workload)
- **Mac:** [Rust](https://rustup.rs) + Xcode CLT (`xcode-select --install`)

```bash
git clone https://github.com/Calcifer04/pid.git
cd pid
npm run setup          # install + build (+ Tauri if Rust is present)
npm run open           # native app if built, else browser app-mode
```

Rebuild native only:

```bash
npm run build:app      # → installer under src-tauri/target/release/bundle/
```

| OS | Everyday open |
|----|----------------|
| **Mac** | `~/Applications/πD.app` or Tauri `.app` → Keep in Dock |
| **Windows** | Desktop **piD** (native `pid.exe` when Tauri built) |
| **Either** | `npm run open` |

Native app starts the local API server automatically and opens a real OS window.
Windows installers (after `build:app`): `src-tauri/target/release/bundle/nsis/piD_*-setup.exe`

### Board across Mac ↔ Windows

Code: git. **Live board + Google tokens:** [Syncthing](./SYNCTHING.md) (or copy `data/` + `.env.local`).

```bash
# Mac after Syncthing lands the folder:
cd ~/Sync/pid && npm run setup && npm run open
```

| OS | Dev | Server only |
|----|-----|-------------|
| Mac / Linux | `./scripts/dev.sh` | `./scripts/start.sh` |
| Windows | `npm run dev` | `npm start` |

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

## Google Calendar (notifications)

**All reminders / popups are Google’s job** (phone, watch, desktop). πD does not run a local notification stack — put a due date (± time) on a task or SOP, sync, and Google fires the popup.

- Timed items → popup **15 min** before
- All-day items → popup **~15:00 the day before** (540 min before midnight)

Two sync modes:

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
