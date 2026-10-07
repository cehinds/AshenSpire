# Public game-build discovery. The download opens GitHub's artifact page;
# Actions requires sign-in to download a binary, so no token is requested here.
function Get-GameJson([string]$Path) {
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  $req = [Net.HttpWebRequest]::Create("https://api.github.com/repos/cehinds/AshenSpire/$Path")
  $req.UserAgent = 'AshenSpire-Installer'; $req.Accept = 'application/vnd.github+json'
  $req.Timeout = 15000; $req.ReadWriteTimeout = 15000
  $res = $req.GetResponse()
  try {
    $reader = New-Object IO.StreamReader($res.GetResponseStream())
    try { return ($reader.ReadToEnd() | ConvertFrom-Json) } finally { $reader.Dispose() }
  } finally { $res.Dispose() }
}
function Get-GameBuilds([string]$Branch) {
  if ($Branch -notin @('test', 'release', 'main', 'dev')) { throw 'Unknown game branch.' }
  $response = Get-GameJson ("actions/workflows/windows-installer.yml/runs?branch=$Branch&status=success&per_page=30")
  $builds = @()
  foreach ($run in $response.workflow_runs) {
    if ($run.head_branch -cne $Branch -or $run.event -notin @('push', 'workflow_dispatch') -or $run.conclusion -ne 'success') { continue }
    if ([string]$run.head_sha -notmatch '^[0-9a-f]{40}$' -or [string]$run.id -notmatch '^[0-9]+$') { continue }
    $artifacts = Get-GameJson "actions/runs/$($run.id)/artifacts?per_page=100"
    $artifact = @($artifacts.artifacts | Where-Object { -not $_.expired -and $_.name -ceq "windows-installer-$($run.head_sha)" })
    if ($artifact.Count -ne 1 -or [string]$artifact[0].id -notmatch '^[0-9]+$') { continue }
    # Resolve the version from this immutable build commit, never the branch tip.
    $file = Get-GameJson "contents/buildordinal.json?ref=$($run.head_sha)"
    if ($file.encoding -ne 'base64') { throw 'Invalid game version metadata.' }
    $box = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($file.content)) | ConvertFrom-Json
    $version = "$($box.release).$($box.ordinal)"
    if ($version -notmatch '^\d+\.\d+\.\d+\.\d+$') { throw 'Invalid game version.' }
    $builds += [pscustomobject]@{
      Label = "$version - $($run.head_sha.Substring(0, 8))"; Version = $version; Branch = $Branch; Sha = $run.head_sha
      Url = "https://github.com/cehinds/AshenSpire/actions/runs/$($run.id)/artifacts/$($artifact[0].id)"
    }
    if ($builds.Count -ge 5) { break }
  }
  return $builds
}
function Open-GameBuild($Build) {
  if ($Build.Url -notmatch '^https://github\.com/cehinds/AshenSpire/actions/runs/[0-9]+/artifacts/[0-9]+$') { throw 'Invalid game download link.' }
  Start-Process -FilePath $Build.Url
}
