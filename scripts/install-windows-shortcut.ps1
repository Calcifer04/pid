# Create Desktop + Start Menu shortcuts that open piD (no console).
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Vbs = Join-Path $Root "piD.vbs"
if (-not (Test-Path $Vbs)) {
  # fallback if filesystem normalized the name
  $Vbs = Join-Path $Root "pid.vbs"
}
$Desktop = [Environment]::GetFolderPath("Desktop")
$StartMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"

if (-not (Test-Path $Vbs)) { throw "missing piD.vbs in project root" }

function New-PidShortcut([string]$Path) {
  $w = New-Object -ComObject WScript.Shell
  $s = $w.CreateShortcut($Path)
  $s.TargetPath = "wscript.exe"
  $s.Arguments = "`"$Vbs`""
  $s.WorkingDirectory = "$Root"
  $s.WindowStyle = 7
  $s.Description = "piD - personal board"
  $ico = Join-Path $Root "public\icon.ico"
  if (Test-Path $ico) { $s.IconLocation = $ico }
  $s.Save()
}

New-Item -ItemType Directory -Force -Path $StartMenu | Out-Null
$deskLnk = Join-Path $Desktop "piD.lnk"
$startLnk = Join-Path $StartMenu "piD.lnk"
New-PidShortcut $deskLnk
New-PidShortcut $startLnk

Write-Host "shortcuts:"
Write-Host "  $deskLnk"
Write-Host "  $startLnk"
Write-Host "double-click either (or piD.vbs in the project) to open."
