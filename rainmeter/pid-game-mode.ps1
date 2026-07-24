# Stop πD hotkeys before games with anti-cheat (THE FINALS, etc.)
# Usage:
#   powershell -ExecutionPolicy Bypass -File pid-game-mode.ps1 off   # before game
#   powershell -ExecutionPolicy Bypass -File pid-game-mode.ps1 on    # after game

param(
  [Parameter(Position = 0)]
  [ValidateSet("off", "on", "status")]
  [string]$Mode = "status"
)

$ahk = Join-Path $env:LOCALAPPDATA "Programs\AutoHotkey\v2\AutoHotkey64.exe"
$script = Join-Path $env:USERPROFILE "Documents\piD\pid-hotkeys.ahk"

function Stop-PidHotkeys {
  Get-CimInstance Win32_Process -Filter "Name='AutoHotkey64.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*pid-hotkeys*" } |
    ForEach-Object {
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
      Write-Host "stopped pid=$($_.ProcessId)"
    }
  # if any AHK left from us only - don't kill unrelated AHK unless only pid-hotkeys
  $left = Get-Process AutoHotkey64 -ErrorAction SilentlyContinue
  if (-not $left) { Write-Host "AutoHotkey clear — safe for anti-cheat." }
  else { Write-Host "Note: other AutoHotkey processes still running:" ($left.Id -join ", ") }
}

function Start-PidHotkeys {
  if (-not (Test-Path $ahk)) { throw "AutoHotkey not found: $ahk" }
  if (-not (Test-Path $script)) { throw "Missing $script — run install-spotlight.ps1" }
  Stop-PidHotkeys | Out-Null
  Start-Process $ahk -ArgumentList "`"$script`""
  Start-Sleep -Milliseconds 400
  Write-Host "piD hotkeys ON (Alt+G)"
}

switch ($Mode) {
  "off" { Stop-PidHotkeys }
  "on" { Start-PidHotkeys }
  "status" {
    $p = Get-CimInstance Win32_Process -Filter "Name='AutoHotkey64.exe'" -EA SilentlyContinue |
      Where-Object { $_.CommandLine -like "*pid-hotkeys*" }
    if ($p) { "ON pid=$($p.ProcessId)" } else { "OFF" }
  }
}
