# Build (if needed) + run piD preview detached on all interfaces.
# Phone on same Wi-Fi: http://<lan-ip>:4000/
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$port = 4000

function Get-LanIp {
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*" -and
      $_.PrefixOrigin -ne "WellKnown"
    } |
    Sort-Object -Property InterfaceMetric |
    Select-Object -First 1 -ExpandProperty IPAddress
}

$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
  $ip = Get-LanIp
  Write-Host "piD already up"
  Write-Host "  local  http://127.0.0.1:$port/"
  if ($ip) { Write-Host "  phone  http://${ip}:$port/" }
  exit 0
}

Push-Location $root
try {
  if (-not (Test-Path "dist/index.html")) {
    Write-Host "building..."
    npm run build
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
} finally {
  Pop-Location
}

$out = Join-Path $env:TEMP "pid-serve.out.log"
$err = Join-Path $env:TEMP "pid-serve.err.log"
$proc = Start-Process -FilePath "cmd.exe" `
  -ArgumentList "/c", "npx vite preview --host 0.0.0.0 --port $port --strictPort" `
  -WorkingDirectory $root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $out `
  -RedirectStandardError $err `
  -PassThru

Start-Sleep -Seconds 2
$ip = Get-LanIp
try {
  $null = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$port/" -TimeoutSec 4
  Write-Host "piD live (pid $($proc.Id))"
  Write-Host "  local  http://127.0.0.1:$port/"
  if ($ip) {
    Write-Host "  phone  http://${ip}:$port/"
    Write-Host "  tip    same Wi-Fi - Add to Home Screen for app-like use"
  } else {
    Write-Host "  phone  (no LAN ip found - check Wi-Fi)"
  }
} catch {
  Write-Host "started but not responding - check $err"
  exit 1
}
