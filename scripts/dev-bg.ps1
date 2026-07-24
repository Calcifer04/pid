# Start piD vite detached on LAN (survives the shell that launched it).
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

$out = Join-Path $env:TEMP "pid-vite.out.log"
$err = Join-Path $env:TEMP "pid-vite.err.log"
$proc = Start-Process -FilePath "cmd.exe" `
  -ArgumentList "/c", "npm run dev" `
  -WorkingDirectory $root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $out `
  -RedirectStandardError $err `
  -PassThru

Start-Sleep -Seconds 2
$ip = Get-LanIp
try {
  $null = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$port/" -TimeoutSec 3
  Write-Host "piD up (pid $($proc.Id))"
  Write-Host "  local  http://127.0.0.1:$port/"
  if ($ip) { Write-Host "  phone  http://${ip}:$port/" }
} catch {
  Write-Host "started launcher=$($proc.Id) but not responding yet - check $err"
  exit 1
}
