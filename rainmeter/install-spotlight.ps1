# Install πD Spotlight + hotkeys (explicit, reversible)
param(
  [switch]$Startup,
  [switch]$NoStartup,
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"
$repoRain = $PSScriptRoot
$skinsRoot = Join-Path $env:USERPROFILE "Documents\Rainmeter\Skins"
$dst = Join-Path $skinsRoot "piDSpotlight"
$src = Join-Path $repoRain "piDSpotlight"
$rm = "C:\Program Files\Rainmeter\Rainmeter.exe"
$ahk = Join-Path $env:LOCALAPPDATA "Programs\AutoHotkey\v2\AutoHotkey64.exe"
$hotkeysSrc = Join-Path $repoRain "pid-hotkeys.ahk"
$hotkeysDst = Join-Path $env:USERPROFILE "Documents\piD\pid-hotkeys.ahk"
$startupDir = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupDir "piD Hotkeys.lnk"

function Write-Info($m) { if (-not $Quiet) { Write-Host $m } }

Write-Info ""
Write-Info "=== piD Spotlight ==="
Write-Info "  Alt+G  open/close centered bar"
Write-Info "  Esc    close (only while open)"
Write-Info "  Enter  send to http://127.0.0.1:4000/api/desk"
Write-Info "  Local only. No admin. No hidden registry autorun."
Write-Info ""

if (-not (Test-Path $src)) { throw "Missing $src" }
if (-not (Test-Path $rm)) { throw "Rainmeter not found: $rm" }
if (-not (Test-Path $ahk)) {
  throw "AutoHotkey v2 missing. Run: winget install AutoHotkey.AutoHotkey"
}

# Skin
New-Item -ItemType Directory -Force -Path $dst | Out-Null
$utf16 = New-Object System.Text.UnicodeEncoding $false, $true
Get-ChildItem $src -Filter "*.ini" | ForEach-Object {
  $c = Get-Content $_.FullName -Raw -Encoding UTF8
  [System.IO.File]::WriteAllText((Join-Path $dst $_.Name), $c, $utf16)
}
Get-ChildItem $src -File | Where-Object { $_.Extension -in ".lua", ".ps1" } | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $dst $_.Name) -Force
}
Write-Info "[ok] Rainmeter skin -> $dst"

# Hotkey script in Documents (readable)
New-Item -ItemType Directory -Force -Path (Split-Path $hotkeysDst) | Out-Null
Copy-Item $hotkeysSrc $hotkeysDst -Force
Write-Info "[ok] Hotkeys script -> $hotkeysDst"

# Rainmeter load hidden
if (-not (Get-Process Rainmeter -ErrorAction SilentlyContinue)) {
  Start-Process $rm
  Start-Sleep 2
}
& $rm "!RefreshApp"
Start-Sleep -Milliseconds 600
& $rm "!ActivateConfig" "piDSpotlight" "Spotlight.ini"
Start-Sleep -Milliseconds 200
& $rm "!Hide" "piDSpotlight"
Write-Info "[ok] Spotlight loaded (hidden until Alt+G)"

# Restart hotkeys process cleanly
Get-CimInstance Win32_Process -Filter "Name='AutoHotkey64.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*pid-hotkeys*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 200
Start-Process $ahk -ArgumentList "`"$hotkeysDst`""
Write-Info "[ok] Hotkeys running"

# Startup (opt-in)
$doStartup = $false
if ($Startup) { $doStartup = $true }
elseif ($NoStartup) { $doStartup = $false }
elseif (-not $Quiet) {
  $ans = Read-Host "Start Alt+G hotkeys with Windows? (y/N)"
  $doStartup = ($ans -match '^[yY]')
}

if ($doStartup) {
  $ws = New-Object -ComObject WScript.Shell
  $sc = $ws.CreateShortcut($shortcutPath)
  $sc.TargetPath = $ahk
  $sc.Arguments = "`"$hotkeysDst`""
  $sc.WorkingDirectory = Split-Path $hotkeysDst
  $sc.Description = "piD Spotlight hotkeys (Alt+G). Delete this shortcut to disable."
  $sc.Save()
  Write-Info "[ok] Startup shortcut: $shortcutPath"
  Write-Info "     Delete the .lnk to undo."
} else {
  Write-Info "[i] No Startup entry (use -Startup to add later)."
}

Write-Info ""
Write-Info "Try Alt+G now. Need piD server: npm run dev:bg"
Write-Info "Stop hotkeys: tray green H -> Exit"
Write-Info "Docs: rainmeter/README-SPOTLIGHT.md"
Write-Info ""
