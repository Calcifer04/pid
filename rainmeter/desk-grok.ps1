# πD desktop assist — all args joined as the message
$ErrorActionPreference = "Stop"
$Message = ($args -join " ").Trim()
if (-not $Message) {
  Write-Output "empty"
  exit 1
}

$url = "http://127.0.0.1:4000/api/desk"
$bodyObj = @{ message = $Message }
$body = $bodyObj | ConvertTo-Json -Compress

try {
  $res = Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json; charset=utf-8" -TimeoutSec 120
  if ($res.reply) { Write-Output $res.reply }
  elseif ($res.error) { Write-Output $res.error }
  else { Write-Output "ok" }
  exit 0
} catch {
  $msg = $_.Exception.Message
  try {
    $resp = $_.ErrorDetails.Message
    if ($resp) {
      $j = $resp | ConvertFrom-Json
      if ($j.error) { $msg = $j.error }
    }
  } catch {}
  Write-Output "err: $msg"
  exit 1
}
