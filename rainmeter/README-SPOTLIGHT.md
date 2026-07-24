# πD Spotlight

Centered desktop command palette — **no browser**.

| Key | Action |
|-----|--------|
| **Alt+G** | Open spotlight + focus input |
| **Enter** | Send to local πD (`/api/desk`) |
| **Esc** / click dim | Dismiss |

## Requirements

- Rainmeter
- AutoHotkey v2 (`winget install AutoHotkey.AutoHotkey`)
- πD server: `npm run dev:bg`

## Install

```powershell
cd C:\Users\basco\Projects\routine
powershell -ExecutionPolicy Bypass -File .\rainmeter\install-spotlight.ps1
```

The script will ask before adding a **Startup** shortcut. Decline if you only want it this session.

## What runs at startup (only if you said yes)

- Shortcut: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\piD Hotkeys.lnk`
- Target: AutoHotkey + `Documents\piD\pid-hotkeys.ahk`
- **Not** hidden malware-style: normal Startup folder, plain-text script, no admin

## Uninstall / stop

1. Delete Startup `.lnk` if present  
2. Tray: green **H** (AutoHotkey) → Exit  
3. Rainmeter: unload `piDSpotlight`

## Safety

- Hotkeys script only reacts to **Alt+G** and **Esc**
- Only launches local Rainmeter bangs
- Assist traffic only to `http://127.0.0.1:4000/api/desk`
- No admin elevation, no registry autorun keys
