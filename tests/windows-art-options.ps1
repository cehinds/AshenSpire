# Offline behavior tests, run by the Windows installer workflow in PowerShell 5.1.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../desktop/windows/art-releases.ps1')
function Assert($Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
$script:responseStatus = 'ahead'
function Get-ArtJson([string]$Path) {
  if ($Path.StartsWith('branches?')) { return @([pscustomobject]@{ name = 'main' }, [pscustomobject]@{ name = 'feature/new-art' }) }
  if ($Path.StartsWith('releases?')) {
    return @(
      [pscustomobject]@{ tag_name = 'hd-assets-v7'; draft = $false; prerelease = $false; published_at = '2026-10-03'; assets = @(
        [pscustomobject]@{ name = 'hd-assets-v7.zip'; browser_download_url = 'https://github.com/cehinds/AshenSpire-art/releases/download/hd-assets-v7/hd-assets-v7.zip'; size = 42 },
        [pscustomobject]@{ name = 'hd-assets-v7.zip.sha256'; browser_download_url = 'https://github.com/cehinds/AshenSpire-art/releases/download/hd-assets-v7/hd-assets-v7.zip.sha256' }
      ) },
      [pscustomobject]@{ tag_name = 'hd-assets-v8'; draft = $true; prerelease = $false },
      [pscustomobject]@{ tag_name = 'hd-assets-v9'; draft = $false; prerelease = $true },
      [pscustomobject]@{ tag_name = 'hd-assets-v10'; draft = $false; prerelease = $false; assets = @() }
    )
  }
  Assert ($Path -eq 'compare/hd-assets-v7...feature%2Fnew-art') 'Branch and tag must be URL-encoded separately.'
  return [pscustomobject]@{ status = $script:responseStatus }
}
$catalog = Get-ArtCatalog
Assert ($catalog.Branches.Count -eq 2) 'Both branches must be offered.'
Assert ($catalog.Releases.Count -eq 1 -and $catalog.Releases[0].Tag -eq 'hd-assets-v7') 'Draft, prerelease, and incomplete releases must be excluded.'
foreach ($status in 'ahead', 'identical', 'behind', 'diverged') {
  $script:responseStatus = $status
  Assert ((Test-ArtBranch 'feature/new-art' 'hd-assets-v7') -eq ($status -in @('ahead', 'identical'))) "Wrong ancestry interpretation: $status"
}
# Validate repository restriction before replacing the network transport with fixtures.
foreach ($url in 'http://github.com/cehinds/AshenSpire-art/releases/download/x/y', 'https://example.com/art.zip', 'https://github.com/other/repo/releases/download/x/y') {
  $rejected = $false
  try { Save-ArtFile $url 'unused' } catch { $rejected = $true }
  Assert $rejected 'Non-repository downloads must be rejected.'
}
$testDir = Join-Path ([IO.Path]::GetTempPath()) ('AshenSpire-art-test-' + [Guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($testDir)
$script:zipBytes = [Text.Encoding]::UTF8.GetBytes('test art archive')
$hasher = [Security.Cryptography.SHA256]::Create()
try { $script:expected = ([BitConverter]::ToString($hasher.ComputeHash($script:zipBytes)) -replace '-', '').ToLowerInvariant() } finally { $hasher.Dispose() }
$script:badChecksum = $false; $script:cancel = $false
function Save-ArtFile([string]$Url, [string]$Path, [scriptblock]$Progress) {
  if ($Url.EndsWith('.sha256')) {
    $sum = if ($script:badChecksum) { '0' * 64 } else { $script:expected }
    [IO.File]::WriteAllText($Path, "$sum  hd-assets-v7.zip")
  } else {
    [IO.File]::WriteAllBytes($Path, $script:zipBytes)
    if ($Progress) { & $Progress $script:zipBytes.Length $script:zipBytes.Length }
    if ($script:cancel) { throw 'cancelled' }
  }
}
try {
  $dest = Join-Path $testDir 'art.zip'; [IO.File]::WriteAllText($dest, 'original download')
  $script:badChecksum = $true; $failed = $false
  try { $null = Save-ArtRelease $catalog.Releases[0] $dest } catch { $failed = $true }
  Assert $failed 'A bad checksum must fail.'
  Assert ([IO.File]::ReadAllText($dest) -eq 'original download') 'Failure must preserve the existing download.'
  Assert (@(Get-ChildItem $testDir -Filter '*.part*').Count -eq 0) 'Failure must remove partial files.'
  $script:badChecksum = $false
  $null = Save-ArtRelease $catalog.Releases[0] $dest
  Assert ([IO.File]::ReadAllText($dest) -eq 'test art archive') 'A verified download must replace the old file.'
  $script:cancel = $true; $failed = $false
  try { $null = Save-ArtRelease $catalog.Releases[0] $dest $script:expected } catch { $failed = $true }
  Assert $failed 'Cancellation must fail without promoting the partial archive.'
  Assert ([IO.File]::ReadAllText($dest) -eq 'test art archive') 'Cancellation must keep the previous archive.'
  Assert (@(Get-ChildItem $testDir -Filter '*.part*').Count -eq 0) 'Cancellation must remove partial files.'
  Write-Output 'Windows art catalog, ancestry, checksum, replacement, and cancellation tests passed.'
} finally {
  # Only explicit files created in this unique test directory are removed.
  foreach ($file in Get-ChildItem -LiteralPath $testDir -File) { [IO.File]::Delete($file.FullName) }
  [IO.Directory]::Delete($testDir)
}
