param([ValidateRange(1, 65535)][int]$Port = 8360)
$ErrorActionPreference = 'Stop'
$studioRoot = $PSScriptRoot
$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($listener) { throw "Port $Port is already in use. Choose another port with -Port." }
$pythonExecutable = (Get-Command python -ErrorAction Stop).Source
$logs = Join-Path $studioRoot '.preview'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
$previewProcess = Start-Process -FilePath $pythonExecutable -ArgumentList @('-m', 'http.server', "$Port", '--bind', '127.0.0.1', '--directory', ('"' + $studioRoot + '"')) -WorkingDirectory $studioRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs "server-$Port.stdout.log") -RedirectStandardError (Join-Path $logs "server-$Port.stderr.log") -PassThru
Write-Host "HUD Component Studio: http://localhost:$Port/ (PID $($previewProcess.Id))"
