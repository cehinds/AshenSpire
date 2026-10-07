# Offline exact-build catalog tests in Windows PowerShell 5.1.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../desktop/windows/game-releases.ps1')
function Assert($Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
$script:sha = 'a' * 40
$script:badSha = 'b' * 40
$script:expired = $false
function Get-GameJson([string]$Path) {
  if ($Path.StartsWith('actions/workflows/')) {
    Assert ($Path.Contains('branch=test&')) 'Discovery must request the selected branch.'
    return [pscustomobject]@{ workflow_runs = @(
      [pscustomobject]@{ id = 1; head_branch = 'test'; head_sha = $script:sha; event = 'push'; conclusion = 'success' },
      [pscustomobject]@{ id = 2; head_branch = 'release'; head_sha = $script:badSha; event = 'push'; conclusion = 'success' },
      [pscustomobject]@{ id = 3; head_branch = 'test'; head_sha = $script:badSha; event = 'pull_request'; conclusion = 'success' },
      [pscustomobject]@{ id = 4; head_branch = 'test'; head_sha = $script:badSha; event = 'push'; conclusion = 'failure' }
    ) }
  }
  if ($Path -eq 'actions/runs/1/artifacts?per_page=100') {
    return [pscustomobject]@{ artifacts = @(
      [pscustomobject]@{ name = "windows-installer-$script:sha"; id = 10; expired = $script:expired },
      [pscustomobject]@{ name = "windows-installer-$script:badSha"; id = 11; expired = $false }
    ) }
  }
  Assert ($Path -eq "contents/buildordinal.json?ref=$script:sha") 'Game version must come from the exact artifact commit.'
  return [pscustomobject]@{ encoding = 'base64'; content = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('{"release":"0.7.1","ordinal":843}')) }
}
$builds = @(Get-GameBuilds 'test')
Assert ($builds.Count -eq 1) 'Only a completed exact-branch non-PR installer may be offered.'
Assert ($builds[0].Version -eq '0.7.1.843' -and $builds[0].Sha -eq $script:sha) 'The exact game version and commit must be retained.'
Assert ($builds[0].Url -eq 'https://github.com/cehinds/AshenSpire/actions/runs/1/artifacts/10') 'The download must identify the exact artifact.'
$script:expired = $true
Assert (@(Get-GameBuilds 'test').Count -eq 0) 'Expired installers must not be offered.'
$failed = $false
try { $null = Get-GameBuilds 'unknown' } catch { $failed = $true }
Assert $failed 'Unknown branches must be rejected.'
foreach ($url in 'https://example.com/file.exe', 'https://github.com/other/repo/actions/runs/1/artifacts/10', 'https://github.com/cehinds/AshenSpire/actions/runs/1/artifacts/10?redirect=other') {
  $failed = $false
  try { Open-GameBuild ([pscustomobject]@{ Url = $url }) } catch { $failed = $true }
  Assert $failed 'Foreign or changed download links must be rejected before opening a browser.'
}
Write-Output 'Windows game branch, exact version, artifact, expiry, and link tests passed.'
