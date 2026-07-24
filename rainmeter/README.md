# πD → Rainmeter (proof of concept)

Desktop skin that pulls **today’s open items** from the local πD API.

## What it shows

- **πD** brand + feed status (`ok` / `offline`)
- **N open** today + done/total
- Accent progress bar
- Top 2 open titles
- **Click** → opens http://127.0.0.1:4000/

## Prerequisites

1. πD running: `npm run dev:bg` (or `start:bg`)
2. [Rainmeter](https://www.rainmeter.net/) installed

## Install skin

```powershell
# from repo root
$src = ".\rainmeter\piD"
$dst = "$env:USERPROFILE\Documents\Rainmeter\Skins\piD"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item "$src\piD.ini" "$dst\piD.ini" -Force
```

Then:

1. Rainmeter tray icon → **Refresh all**
2. Right-click tray → **Skins → piD → piD**
3. Skin appears on desktop

## Feed (for debugging)

```text
GET http://127.0.0.1:4000/api/rainmeter
```

Example:

```text
day=2026-07-23
open=3
done=1
total=4
frac=25
sops=3
tasks=5
item1=Daily Report
kind1=sop
...
status=ok
```

## What’s possible next

| Idea | Notes |
|------|--------|
| More item rows | Already `item1`…`item5` in feed |
| SOP-only / task-only | Extra fields on feed |
| Click line → deep link | Needs URL routes in πD |
| Read `data/board.json` direct | No server; Lua JSON parse |
| RGB bar matching accent | Rainmeter calc / update cycle |

## Uninstall

Delete `%USERPROFILE%\Documents\Rainmeter\Skins\piD` and unload the skin.
