$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

Copy-Item (Join-Path $root "public\icon.ico") (Join-Path $root "public\piD.ico") -Force

$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) {
  $csc = Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe"
}

$ico = Join-Path $root "public\piD.ico"
$exe = Join-Path $root "piD.exe"
$cs = Join-Path $root "scripts\pid-run.cs"

& $csc /nologo /target:winexe /reference:System.Windows.Forms.dll `
  "/win32icon:$ico" "/out:$exe" "$cs"
if ($LASTEXITCODE -ne 0) { throw "csc failed" }

$w = New-Object -ComObject WScript.Shell
$paths = @(
  (Join-Path ([Environment]::GetFolderPath("Desktop")) "piD.lnk"),
  (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\piD.lnk")
)
foreach ($path in $paths) {
  $s = $w.CreateShortcut($path)
  $s.TargetPath = "$exe"
  $s.WorkingDirectory = "$root"
  $s.WindowStyle = 1
  $s.Description = "piD - personal board"
  $s.IconLocation = "$exe,0"
  $s.Save()
  Write-Host "updated $path"
}

Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 900
Start-Process explorer
Write-Host "explorer restarted"
