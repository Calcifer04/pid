# Start piD (if needed) and open it as a dedicated app window (own taskbar icon).
# Windows - double-click piD.vbs, Desktop shortcut, or: npm run open
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Port = if ($env:PID_PORT) { [int]$env:PID_PORT } else { 4000 }
$Url = "http://127.0.0.1:$Port/"
$OutLog = Join-Path $env:TEMP "pid-serve.out.log"
$ErrLog = Join-Path $env:TEMP "pid-serve.err.log"
$ProfileDir = Join-Path $env:LOCALAPPDATA "piD\chromium-profile"
$IconIco = Join-Path $Root "public\icon.ico"

function Test-ServerUp {
  try {
    $null = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 2
    return $true
  } catch {
    return $false
  }
}

function Test-DistStale {
  if (-not (Test-Path (Join-Path $Root "dist\index.html"))) { return $true }
  $distTime = (Get-Item (Join-Path $Root "dist\index.html")).LastWriteTimeUtc
  $watch = @("src", "index.html", "package.json", "vite.config.ts", "public")
  foreach ($rel in $watch) {
    $p = Join-Path $Root $rel
    if (-not (Test-Path $p)) { continue }
    $item = Get-Item $p
    if ($item.PSIsContainer) {
      $newer = Get-ChildItem -Path $p -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTimeUtc -gt $distTime } |
        Select-Object -First 1
      if ($newer) { return $true }
    } elseif ($item.LastWriteTimeUtc -gt $distTime) {
      return $true
    }
  }
  return $false
}

function Ensure-Built {
  Push-Location $Root
  try {
    if (-not (Test-Path "node_modules")) {
      Write-Host "piD: installing deps..."
      npm install
      if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    }
    if (Test-DistStale) {
      Write-Host "piD: building..."
      npm run build
      if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
    }
  } finally {
    Pop-Location
  }
}

function Start-PidServer {
  $existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($existing -or (Test-ServerUp)) { return }

  $proc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npx vite preview --host 0.0.0.0 --port $Port --strictPort" `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog `
    -PassThru

  for ($i = 0; $i -lt 40; $i++) {
    if (Test-ServerUp) { return }
    Start-Sleep -Milliseconds 250
  }
  throw "piD server failed to start (pid $($proc.Id)) - see $ErrLog"
}

function Find-Chromium {
  $candidates = @(
    (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
    (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe"),
    (Join-Path $env:ProgramFiles "BraveSoftware\Brave-Browser\Application\brave.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "BraveSoftware\Brave-Browser\Application\brave.exe"),
    (Join-Path $env:LOCALAPPDATA "BraveSoftware\Brave-Browser\Application\brave.exe"),
    (Join-Path $env:LOCALAPPDATA "Chromium\Application\chrome.exe")
  )
  foreach ($exe in $candidates) {
    if ($exe -and (Test-Path $exe)) { return $exe }
  }
  return $null
}

function Open-AppWindow {
  $exe = Find-Chromium
  if (-not $exe) {
    Start-Process $Url
    return
  }

  New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null

  # Dedicated profile + app mode = separate taskbar group (not mixed with normal Edge tabs).
  # Chromium picks the site favicon/manifest icon for the window when PNGs are present.
  $args = @(
    "--user-data-dir=$ProfileDir",
    "--no-first-run",
    "--no-default-browser-check",
    "--class=piD",
    "--app=$Url"
  )

  Start-Process -FilePath $exe -ArgumentList $args
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node 20+ required - https://nodejs.org"
}

Ensure-Built

if (Test-ServerUp) {
  Write-Host "piD already up -> $Url"
} else {
  Write-Host "piD starting -> $Url"
  Start-PidServer
}

Open-AppWindow
Write-Host "opened $Url"
