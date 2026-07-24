# πD desk assist — args joined as message
$ErrorActionPreference = "Stop"
$Message = ($args -join " ").Trim()
if (-not $Message) {
  Write-Output "empty"
  exit 1
}

$url = "http://127.0.0.1:4000/api/desk"
$body = (@{ message = $Message } | ConvertTo-Json -Compress)

try {
  $res = Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json; charset=utf-8" -TimeoutSec 120
  if ($res.reply) { Write-Output $res.reply; exit 0 }
  if ($res.error) { Write-Output $res.error; exit 1 }
  Write-Output "ok"
  exit 0
} catch {
  $msg = $_.Exception.Message
  try {
    if ($_.ErrorDetails.Message) {
      $j = $_.ErrorDetails.Message | ConvertFrom-Json
      if ($j.error) { $msg = $j.error }
    }
  } catch {}
  Write-Output "err: $msg"
  exit 1
}
