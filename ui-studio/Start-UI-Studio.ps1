param([int]$Port = 4319, [string]$Project = '', [switch]$NoOpen)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$studioUrl = "http://127.0.0.1:$Port/"
$ready = $false
try { $response = Invoke-WebRequest $studioUrl -TimeoutSec 2; $ready = $response.Content.Contains('AshenSpire UI Studio') } catch { }
if (-not $ready) {
  $node = (Get-Command node -ErrorAction Stop).Source
  $server = Join-Path $PSScriptRoot 'server.mjs'
  $args = @(('"{0}"' -f $server), '--port', "$Port")
  if ($Project) { $args += @('--project', ('"{0}"' -f $Project)) }
  Start-Process -FilePath $node -ArgumentList $args -WorkingDirectory $repoRoot -WindowStyle Hidden | Out-Null
  for ($i = 0; $i -lt 40; $i++) { Start-Sleep -Milliseconds 250; try { Invoke-WebRequest $studioUrl -TimeoutSec 1 | Out-Null; $ready = $true; break } catch { } }
  if (-not $ready) { throw 'UI Studio could not start. Run node ui-studio/server.mjs for details.' }
}
if ($NoOpen) { Write-Output $studioUrl; return }
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if ($edge) { Start-Process -FilePath $edge -ArgumentList "--app=$studioUrl" } else { Start-Process $studioUrl }
