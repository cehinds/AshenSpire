# Offline behavior tests, run by the Windows installer workflow in PowerShell 5.1.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../desktop/windows/art-releases.ps1')
function Assert($Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
$chooserSource = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../desktop/windows/art-options.ps1') -Raw
Assert ($chooserSource.Contains('$dialog.FileName = Get-ArtArchiveName $release.Tag')) 'Save As must suggest the same unprefixed archive basename as the verified download.'
Assert ((Get-ArtArchiveName 'hd-assets-v23') -ceq 'hd-assets-v23.zip') 'Legacy tags keep their archive basename.'
Assert ((Get-ArtArchiveName 'ashenspire-hd-assets-v23') -ceq 'hd-assets-v23.zip') 'Project-scoped tags must not prefix archive basenames.'
foreach ($tag in 'hd-assets-v0', 'ashenspire-hd-assets-v01', 'other-hd-assets-v23', '../hd-assets-v23') {
  $rejected = $false; try { $null = Get-ArtArchiveName $tag } catch { $rejected = $true }
  Assert $rejected 'Malformed and foreign project tags must be refused.'
}
foreach ($pair in @(@('cehinds/AshenSpire-art', 'hd-assets-v23'), @('cehinds/AI-Art', 'ashenspire-hd-assets-v23'))) {
  $pin = [pscustomobject]@{ repo = $pair[0]; tag = $pair[1]; packs = @{ high = @{ zip = 'hd-assets-v23.zip'; sha256 = 'a' * 64 } } }
  Assert (Test-InstallerArtPin $pin) 'Both the exact legacy and current installer pin must be readable.'
  $pin.packs.high.zip = 'ashenspire-hd-assets-v23.zip'
  Assert (-not (Test-InstallerArtPin $pin)) 'A prefixed archive basename must be refused.'
}
foreach ($pair in @(@('cehinds/other-art', 'ashenspire-hd-assets-v23'), @('cehinds/AI-Art', 'other-hd-assets-v23'), @('cehinds/AshenSpire-art', 'ashenspire-hd-assets-v23'))) {
  $pin = [pscustomobject]@{ repo = $pair[0]; tag = $pair[1]; packs = @{ high = @{ zip = 'hd-assets-v23.zip'; sha256 = 'a' * 64 } } }
  Assert (-not (Test-InstallerArtPin $pin)) 'Foreign and mismatched repository/tag pairs must be refused.'
}
$script:responseStatus = 'ahead'
function Get-ArtJson([string]$Path) {
  if ($Path.StartsWith('branches?')) { return @([pscustomobject]@{ name = 'main' }, [pscustomobject]@{ name = 'ashenspire' }, [pscustomobject]@{ name = 'other-project' }) }
  if ($Path.StartsWith('releases?')) {
    return @(
      [pscustomobject]@{ tag_name = 'ashenspire-hd-assets-v7'; draft = $false; prerelease = $false; published_at = '2026-10-03'; assets = @(
        [pscustomobject]@{ name = 'hd-assets-v7.zip'; browser_download_url = 'https://github.com/cehinds/AI-Art/releases/download/ashenspire-hd-assets-v7/hd-assets-v7.zip'; size = 42 },
        [pscustomobject]@{ name = 'hd-assets-v7.zip.sha256'; browser_download_url = 'https://github.com/cehinds/AI-Art/releases/download/ashenspire-hd-assets-v7/hd-assets-v7.zip.sha256' }
      ) },
      [pscustomobject]@{ tag_name = 'hd-assets-v77'; draft = $false; prerelease = $false; assets = @(
        [pscustomobject]@{ name = 'hd-assets-v77.zip'; browser_download_url = 'https://github.com/cehinds/AI-Art/releases/download/hd-assets-v77/hd-assets-v77.zip'; size = 42 },
        [pscustomobject]@{ name = 'hd-assets-v77.zip.sha256'; browser_download_url = 'https://github.com/cehinds/AI-Art/releases/download/hd-assets-v77/hd-assets-v77.zip.sha256' }
      ) },
      [pscustomobject]@{ tag_name = 'other-hd-assets-v77'; draft = $false; prerelease = $false; assets = @() },
      [pscustomobject]@{ tag_name = 'ashenspire-hd-assets-v8'; draft = $true; prerelease = $false },
      [pscustomobject]@{ tag_name = 'ashenspire-hd-assets-v9'; draft = $false; prerelease = $true },
      [pscustomobject]@{ tag_name = 'ashenspire-hd-assets-v10'; draft = $false; prerelease = $false; assets = @() }
    )
  }
  Assert ($Path -eq 'compare/ashenspire-hd-assets-v7...ashenspire') 'Branch and tag must be URL-encoded separately.'
  return [pscustomobject]@{ status = $script:responseStatus }
}
$catalog = Get-ArtCatalog
Assert ($catalog.Branches.Count -eq 1 -and $catalog.Branches[0] -ceq 'ashenspire') 'Other projects and repository main must not be offered.'
Assert ($catalog.Releases.Count -eq 1 -and $catalog.Releases[0].Tag -eq 'ashenspire-hd-assets-v7') 'Draft, prerelease, and incomplete releases must be excluded.'
foreach ($status in 'ahead', 'identical', 'behind', 'diverged') {
  $script:responseStatus = $status
  Assert ((Test-ArtBranch 'ashenspire' 'ashenspire-hd-assets-v7') -eq ($status -in @('ahead', 'identical'))) "Wrong ancestry interpretation: $status"
}
foreach ($branchName in 'main', 'other-project', 'feature/new-art') {
  $rejected = $false; try { $null = Test-ArtBranch $branchName 'ashenspire-hd-assets-v7' } catch { $rejected = $true }
  Assert $rejected 'Only the ashenspire project branch may be selected.'
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
$script:badChecksum = $false; $script:cancel = $false; $script:wrongArchive = $false
function Save-ArtFile([string]$Url, [string]$Path, [scriptblock]$Progress, [string]$Repository) {
  $script:lastRepository = $Repository; $script:lastDownloadUrl = $Url
  if ($Url.EndsWith('.sha256')) {
    $sum = if ($script:badChecksum) { '0' * 64 } else { $script:expected }
    $archive = if ($script:wrongArchive) { 'ashenspire-hd-assets-v7.zip' } else { 'hd-assets-v7.zip' }
    [IO.File]::WriteAllText($Path, "$sum  $archive")
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
  $script:wrongArchive = $true; $failed = $false
  try { $null = Save-ArtRelease $catalog.Releases[0] $dest } catch { $failed = $true }
  Assert $failed 'A scoped tag must still require the unprefixed checksum filename.'
  Assert ([IO.File]::ReadAllText($dest) -eq 'original download') 'A wrong archive name must preserve the existing file.'
  $script:wrongArchive = $false
  $null = Save-ArtRelease $catalog.Releases[0] $dest
  Assert ([IO.File]::ReadAllText($dest) -eq 'test art archive') 'A verified download must replace the old file.'
  $legacy = [pscustomobject]@{ Tag = 'hd-assets-v7'; Url = 'https://github.com/cehinds/AshenSpire-art/releases/download/hd-assets-v7/hd-assets-v7.zip'; ChecksumUrl = ''; PinnedRepository = 'cehinds/AshenSpire-art' }
  $null = Save-ArtRelease $legacy $dest $script:expected
  Assert ($script:lastRepository -ceq 'cehinds/AshenSpire-art' -and $script:lastDownloadUrl -ceq $legacy.Url) 'Legacy installer pins retain their exact source URL and hash.'
  $failed = $false; try { $null = Save-ArtRelease $legacy $dest } catch { $failed = $true }
  Assert $failed 'Legacy downloads require the trusted installer checksum, not discovery.'
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
