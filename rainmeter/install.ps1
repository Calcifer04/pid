# Install πD Rainmeter skins (UTF-16 LE for π).
$ErrorActionPreference = "Stop"
$rm = "C:\Program Files\Rainmeter\Rainmeter.exe"
$skinsRoot = Join-Path $env:USERPROFILE "Documents\Rainmeter\Skins"
$utf16 = New-Object System.Text.UnicodeEncoding $false, $true

function Install-SkinFolder($name) {
  $srcDir = Join-Path $PSScriptRoot $name
  $dstDir = Join-Path $skinsRoot $name
  if (-not (Test-Path $srcDir)) { Write-Host "skip missing $srcDir"; return }
  New-Item -ItemType Directory -Force -Path $dstDir | Out-Null

  Get-ChildItem $srcDir -Filter "*.ini" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw -Encoding UTF8
    [System.IO.File]::WriteAllText((Join-Path $dstDir $_.Name), $content, $utf16)
    Write-Host "  ini $name\$($_.Name)"
  }
  Get-ChildItem $srcDir -File | Where-Object { $_.Extension -in ".lua", ".ps1" } | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $dstDir $_.Name) -Force
    Write-Host "  bin $name\$($_.Name)"
  }
}

Write-Host "Installing πD skins…"
Install-SkinFolder "piD"
Install-SkinFolder "piDBar"
Install-SkinFolder "piDSpotlight"

if (-not (Test-Path $rm)) {
  Write-Host "Rainmeter not found"
  exit 0
}
if (-not (Get-Process Rainmeter -ErrorAction SilentlyContinue)) {
  Start-Process $rm
  Start-Sleep 2
}

& $rm "!RefreshApp"
Start-Sleep -Milliseconds 600
& $rm "!ActivateConfig" "piD" "piD.ini"
& $rm "!ActivateConfig" "piDBar" "Bar.ini"
& $rm "!ActivateConfig" "piDSpotlight" "Spotlight.ini"
& $rm "!Hide" "piDSpotlight"
& $rm "!Refresh" "piD" "piD.ini"
& $rm "!Refresh" "piDBar" "Bar.ini"
Write-Host "Active: piD + Bar + Spotlight (hidden)"
Write-Host "Spotlight hotkeys: .\rainmeter\install-spotlight.ps1"
