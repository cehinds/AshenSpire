param([int]$Port = 4318, [switch]$NoOpen)
$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path $PSScriptRoot -Parent
$studioUrl = "http://127.0.0.1:$Port/pose-studio/index.html"
$studioReady = $false
try { $response = Invoke-WebRequest $studioUrl -TimeoutSec 2; $studioReady = $response.Content.Contains('Pose &amp; Effects') -or $response.Content.Contains('Pose & Effects') } catch { }
if (-not $studioReady) {
  $studioNode = (Get-Command node -ErrorAction Stop).Source
  $env:POSE_STUDIO_PORT = "$Port"
  $studioServer = Join-Path $PSScriptRoot 'server.mjs'
  Start-Process -FilePath $studioNode -ArgumentList ('"{0}"' -f $studioServer) -WorkingDirectory $studioRoot -WindowStyle Hidden | Out-Null
  for ($i=0; $i -lt 40; $i++) { Start-Sleep -Milliseconds 250; try { Invoke-WebRequest $studioUrl -TimeoutSec 1 | Out-Null; $studioReady=$true; break } catch { } }
  if (-not $studioReady) { throw 'Pose Studio could not start. Run node pose-studio/server.mjs for details.' }
}
if ($NoOpen) { Write-Output $studioUrl; return }
$studioEdge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if ($studioEdge) { Start-Process -FilePath $studioEdge -ArgumentList "--app=$studioUrl" } else { Start-Process $studioUrl }
