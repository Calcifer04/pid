# Syncthing setup — piD

Free, private, P2P. No account. Board + vault + app code stay in lockstep.

| | |
|--|--|
| **Folder label** | `piD` |
| **Folder ID** | `pid-routine` (use the same ID on every machine) |
| **GUI** | http://127.0.0.1:8384 |

`.stignore` skips `node_modules`, `dist`, `.git` (rebuild those per machine).

Personal board data (`data/*`) stays **out of git** — Syncthing carries the live files.

---

## Windows

```powershell
winget install Syncthing.Syncthing
winget install Martchus.syncthingtray
# start Syncthing, then open http://127.0.0.1:8384
```

1. **Add Folder** → path = this repo (or your clone)
2. Folder ID: `pid-routine` · label: `piD`
3. Optional: enable simple versioning (keep 10)
4. Actions → **Show ID** — copy your device ID for the Mac

Recommended: add Syncthing (+ tray) to Startup so it always runs.

---

## Mac

```bash
brew install syncthing
brew services start syncthing
open http://127.0.0.1:8384
# or: ./scripts/syncthing-mac.sh
```

### Pair devices

1. **Mac** → Add Remote Device → paste Windows device ID → Save  
2. **Windows** → accept the Mac device  
3. **Windows** → folder **piD** → Edit → Sharing → enable Mac → Save  
4. **Mac** → accept folder share  
   - Folder ID: `pid-routine`  
   - Path suggestion: `~/Sync/pid`

### Run piD on Mac

```bash
cd ~/Sync/pid          # or wherever you pointed the folder
npm install && npm run build
chmod +x scripts/*.sh πD.command
npm run install:app
open ~/Applications/πD.app
# Dock → Keep in Dock
```

---

## Phone (optional)

- **Android:** [Syncthing-Fork](https://github.com/Catfriend1/syncthing-android)  
- **iPhone:** use the web UI on LAN (`http://<pc-ip>:4000/`) instead

---

## Tips

- Prefer editing the board on **one** machine at a time (last write wins).
- Secrets in `.env.local` can sync via Syncthing (handy on your own devices). Don’t share the folder with untrusted peers.
- Folder ID `pid-routine` is what links machines — local paths can differ.
