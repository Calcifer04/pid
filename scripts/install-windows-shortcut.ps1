# Build luxury icons + piD.exe + Desktop shortcut that Windows will actually show.
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Public = Join-Path $Root "public"
$Cs = Join-Path $Root "scripts\pid-run.cs"
$Exe = Join-Path $Root "piD.exe"
$Desktop = [Environment]::GetFolderPath("Desktop")
$StartMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"

# Stable per-user icon location (avoids project-path + cache issues)
$AppDataPiD = Join-Path $env:LOCALAPPDATA "piD"
New-Item -ItemType Directory -Force -Path $AppDataPiD | Out-Null

function Build-Icons {
  $py = Get-Command python -ErrorAction SilentlyContinue
  if (-not $py) { $py = Get-Command py -ErrorAction SilentlyContinue }
  if (-not $py) { throw "python required to build icons" }
  & $py.Source (Join-Path $Root "scripts\build-icons.py")
  if ($LASTEXITCODE -ne 0) { throw "build-icons.py failed" }
}

function Install-IconFiles {
  $srcIco = Join-Path $Public "icon.ico"
  $srcPng = Join-Path $Public "icon-256.png"
  if (-not (Test-Path $srcIco)) { throw "missing $srcIco" }

  $hashFile = Join-Path $Public ".icon-hash"
  $hash = if (Test-Path $hashFile) {
    (Get-Content $hashFile -Raw).Trim()
  } else {
    [Guid]::NewGuid().ToString("N").Substring(0, 10)
  }

  $destIco = Join-Path $AppDataPiD "piD-$hash.ico"
  $destPng = Join-Path $AppDataPiD "piD-$hash.png"
  Copy-Item $srcIco $destIco -Force
  if (Test-Path $srcPng) { Copy-Item $srcPng $destPng -Force }

  Copy-Item $srcIco (Join-Path $AppDataPiD "piD.ico") -Force
  if (Test-Path $srcPng) {
    Copy-Item $srcPng (Join-Path $AppDataPiD "piD.png") -Force
  }

  Get-ChildItem $AppDataPiD -Filter "piD-*.ico" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip 3 |
    Remove-Item -Force -ErrorAction SilentlyContinue

  return $destIco
}

function Build-PidExe([string]$IcoPath) {
  if (-not (Test-Path $Cs)) { throw "missing $Cs" }
  $csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
  if (-not (Test-Path $csc)) {
    $csc = Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe"
  }
  if (-not (Test-Path $csc)) { throw "csc.exe not found" }

  Get-Process -Name "piD" -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue
  if (Test-Path $Exe) { Remove-Item $Exe -Force }

  & $csc /nologo /target:winexe /reference:System.Windows.Forms.dll `
    "/win32icon:$IcoPath" "/out:$Exe" "$Cs"
  if ($LASTEXITCODE -ne 0) { throw "failed to build piD.exe" }

  $len = (Get-Item $Exe).Length
  if ($len -lt 50000) {
    throw "piD.exe too small ($len) - icon may not have embedded"
  }
  Write-Host "built $Exe ($len bytes)"
}

function New-PidShortcut([string]$Path, [string]$IcoPath) {
  if (Test-Path $Path) { Remove-Item $Path -Force }
  $w = New-Object -ComObject WScript.Shell
  $s = $w.CreateShortcut($Path)
  $s.TargetPath = "$Exe"
  $s.WorkingDirectory = "$Root"
  $s.WindowStyle = 1
  $s.Description = "piD"
  $s.IconLocation = "$IcoPath,0"
  $s.Save()
  Write-Host "shortcut $Path"
  Write-Host "  icon -> $IcoPath"
}

function Clear-IconCache {
  Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 800
  $ic = Join-Path $env:LOCALAPPDATA "IconCache.db"
  if (Test-Path $ic) { Remove-Item $ic -Force -ErrorAction SilentlyContinue }
  $ex = Join-Path $env:LOCALAPPDATA "Microsoft\Windows\Explorer"
  if (Test-Path $ex) {
    Get-ChildItem $ex -Force -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like "iconcache*" -or $_.Name -like "thumbcache*" } |
      Remove-Item -Force -ErrorAction SilentlyContinue
  }
  Start-Process explorer
}

Write-Host "building icons..."
Build-Icons
$ico = Install-IconFiles
Write-Host "icon installed: $ico"
Build-PidExe -IcoPath $ico

New-Item -ItemType Directory -Force -Path $StartMenu | Out-Null

Get-ChildItem $Desktop -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match '^(piD|pid|pD)\.lnk$' } |
  Remove-Item -Force -ErrorAction SilentlyContinue

New-PidShortcut (Join-Path $Desktop "piD.lnk") $ico
New-PidShortcut (Join-Path $StartMenu "piD.lnk") $ico

Write-Host "clearing icon cache..."
Clear-IconCache
Write-Host ""
Write-Host "Desktop shortcut: piD"
Write-Host "Icon files: $AppDataPiD"
Write-Host "Master art: $Public\icon-1024.png"
