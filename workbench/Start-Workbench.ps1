param([string]$Project = (Split-Path $PSScriptRoot -Parent), [int]$Port = 4300, [switch]$NoOpen)
$ErrorActionPreference = 'Stop'
$nodeExecutable = (Get-Command node -ErrorAction Stop).Source
$serverScript = Join-Path $PSScriptRoot 'server.mjs'
$stateDirectory = Join-Path $PSScriptRoot '.state'
New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
$workbenchUrl = "http://127.0.0.1:$Port"
$running = $false
try {
    $session = Invoke-RestMethod "$workbenchUrl/api/session" -TimeoutSec 2
    if ([IO.Path]::GetFullPath($session.root) -ne [IO.Path]::GetFullPath($Project)) { throw 'This port is already running a Workbench for another project. Choose a different -Port.' }
    $running = $true
} catch {
    if ($_.Exception.Message -like '*another project*') { throw }
}
if (-not $running) {
    $codexCommand = Get-Command codex -ErrorAction SilentlyContinue
    if ($codexCommand) { $env:STUDIO_CODEX = $codexCommand.Source }
    $arguments = @(('"{0}"' -f $serverScript), '--project', ('"{0}"' -f [IO.Path]::GetFullPath($Project)), '--port', $Port, '--no-open')
    $process = Start-Process -FilePath $nodeExecutable -ArgumentList $arguments -WorkingDirectory $Project -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $stateDirectory 'server.log') -RedirectStandardError (Join-Path $stateDirectory 'server-error.log')
    $process.Id | Set-Content (Join-Path $stateDirectory 'server.pid')
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        Start-Sleep -Milliseconds 250
        if ($process.HasExited) { throw "The Workbench could not start. See $stateDirectory\server-error.log" }
        try { Invoke-RestMethod "$workbenchUrl/api/session" -TimeoutSec 1 | Out-Null; $running = $true; break } catch { }
    }
    if (-not $running) { throw "The Workbench did not become ready. See $stateDirectory\server-error.log" }
}
if ($NoOpen) { Write-Output "AshenSpire Workbench: $workbenchUrl"; return }
$edgePaths = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe")
$edge = $edgePaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if ($edge) { Start-Process -FilePath $edge -ArgumentList "--app=$workbenchUrl", '--window-size=1600,960' } else { Start-Process $workbenchUrl }
