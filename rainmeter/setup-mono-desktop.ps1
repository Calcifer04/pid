# Set wave wallpaper + load mono Clock / Media + piD
$ErrorActionPreference = "Stop"

$wpSrc = "C:\Users\basco\Downloads\bd7daa01-f1b3-4ba3-be39-20c1ec2b75c9.jpg"
$wpDir = Join-Path $env:USERPROFILE "Pictures\piD"
$wpDst = Join-Path $wpDir "wave-mono.jpg"
$rm = "C:\Program Files\Rainmeter\Rainmeter.exe"

if (-not (Test-Path $wpSrc)) { throw "Wallpaper not found: $wpSrc" }
if (-not (Test-Path $rm)) { throw "Rainmeter not found" }

New-Item -ItemType Directory -Force -Path $wpDir | Out-Null
Copy-Item $wpSrc $wpDst -Force

# Set wallpaper (fill)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Wallpaper {
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
}
"@
# SPI_SETDESKWALLPAPER = 20, update ini + send change
[Wallpaper]::SystemParametersInfo(20, 0, $wpDst, 3) | Out-Null
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name WallpaperStyle -Value 10  # fill
Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name TileWallpaper -Value 0
[Wallpaper]::SystemParametersInfo(20, 0, $wpDst, 3) | Out-Null
Write-Host "Wallpaper set -> $wpDst"

if (-not (Get-Process Rainmeter -ErrorAction SilentlyContinue)) {
  Start-Process $rm
  Start-Sleep 3
}

# Activate skins
& $rm "!ActivateConfig" "mono\Clock" "Clock.ini"
& $rm "!ActivateConfig" "mono\Media" "Media.ini"
& $rm "!ActivateConfig" "piD" "piD.ini"

# Gentle default positions (primary monitor, roughly)
# Clock — upper left over bright foam
& $rm "!Move" "mono\Clock" "80" "80"
# Media — lower left over dark trough
& $rm "!Move" "mono\Media" "80" "720"
# piD pulse — upper right
& $rm "!Move" "piD" "1500" "80"

& $rm "!Redraw"

Write-Host "Active: mono Clock, mono Media, piD"
Write-Host "Media player default = Spotify (edit mono\Media\Media.ini Player= if needed)"
Write-Host "Drag skins to taste. Right-click Rainmeter tray to toggle."
