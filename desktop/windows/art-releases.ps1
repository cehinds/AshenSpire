# Public art release discovery and verified standalone downloads (PowerShell 5.1).
# Dot-sourced by art-options.ps1 and its offline tests. Never executes downloaded code.
$script:ArtRepo = 'cehinds/AI-Art'
function Get-ArtArchiveName([string]$Tag) {
  if ($Tag -cnotmatch '^(?:ashenspire-)?hd-assets-v([1-9][0-9]*)$') { throw 'Invalid art release.' }
  return "hd-assets-v$($Matches[1]).zip"
}
function Test-InstallerArtPin($Pin) {
  $known = ($Pin.repo -ceq 'cehinds/AI-Art' -and $Pin.tag -cmatch '^ashenspire-hd-assets-v[1-9][0-9]*$') -or
           ($Pin.repo -ceq 'cehinds/AshenSpire-art' -and $Pin.tag -cmatch '^hd-assets-v[1-9][0-9]*$')
  if (-not $known) { return $false }
  return $Pin.packs.high.zip -ceq (Get-ArtArchiveName $Pin.tag) -and $Pin.packs.high.sha256 -match '^[a-fA-F0-9]{64}$'
}
function Get-ArtJson([string]$Path) {
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  $req = [Net.HttpWebRequest]::Create("https://api.github.com/repos/$script:ArtRepo/$Path")
  $req.UserAgent = 'AshenSpire-Installer'; $req.Accept = 'application/vnd.github+json'
  $req.Timeout = 15000; $req.ReadWriteTimeout = 15000
  $res = $req.GetResponse()
  try {
    $reader = New-Object IO.StreamReader($res.GetResponseStream())
    try { return ($reader.ReadToEnd() | ConvertFrom-Json) } finally { $reader.Dispose() }
  } finally { $res.Dispose() }
}
function Get-ArtPages([string]$Path) {
  $items = @()
  for ($page = 1; $page -le 10; $page++) {
    $batch = @(Get-ArtJson "${Path}?per_page=100&page=$page")
    $items += $batch
    if ($batch.Count -lt 100) { return $items }
  }
  throw 'The art catalog is too large. Visit the art repository for more versions.'
}
function Get-ArtCatalog {
  $branches = @(Get-ArtPages 'branches' | Where-Object { $_.name -ceq 'ashenspire' } | ForEach-Object { $_.name })
  $releases = @(Get-ArtPages 'releases' | Where-Object {
    -not $_.draft -and -not $_.prerelease -and $_.tag_name -cmatch '^ashenspire-hd-assets-v[1-9][0-9]*$'
  } | ForEach-Object {
    $tag = $_.tag_name
    $archive = Get-ArtArchiveName $tag
    $zip = @($_.assets | Where-Object { $_.name -ceq $archive })
    $sum = @($_.assets | Where-Object { $_.name -ceq "$archive.sha256" })
    if ($zip.Count -eq 1 -and $sum.Count -eq 1) {
      [pscustomobject]@{ Tag = $tag; Url = $zip[0].browser_download_url; ChecksumUrl = $sum[0].browser_download_url; Bytes = $zip[0].size; Published = $_.published_at }
    }
  })
  return [pscustomobject]@{ Branches = $branches; Releases = $releases }
}
function Test-ArtBranch([string]$Branch, [string]$Tag) {
  if ($Tag -cnotmatch '^ashenspire-hd-assets-v[1-9][0-9]*$' -or $Branch -cne 'ashenspire') { throw 'Invalid branch or release.' }
  $comparison = Get-ArtJson ('compare/' + [Uri]::EscapeDataString($Tag) + '...' + [Uri]::EscapeDataString($Branch))
  # A release can be selected on a branch only if that branch contains its commit.
  return $comparison.status -in @('ahead', 'identical')
}
function Save-ArtFile([string]$Url, [string]$Path, [scriptblock]$Progress, [string]$Repository = $script:ArtRepo) {
  $uri = [Uri]$Url
  if ($Repository -cnotin @('cehinds/AI-Art', 'cehinds/AshenSpire-art') -or $uri.Scheme -ne 'https' -or $uri.Host -ne 'github.com' -or -not $uri.AbsolutePath.StartsWith("/$Repository/releases/download/", [StringComparison]::Ordinal)) {
    throw 'The download must come from the AshenSpire art repository.'
  }
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  $req = [Net.HttpWebRequest]::Create($uri)
  $req.UserAgent = 'AshenSpire-Installer'; $req.Timeout = 60000; $req.ReadWriteTimeout = 60000
  $res = $req.GetResponse()
  try {
    $inputStream = $res.GetResponseStream(); $outputStream = [IO.File]::Create($Path)
    try {
      $buffer = New-Object byte[] (1MB); $done = [long]0
      while (($read = $inputStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
        $outputStream.Write($buffer, 0, $read); $done += $read
        if ($Progress) { & $Progress $done $res.ContentLength }
      }
    } finally { $outputStream.Dispose(); $inputStream.Dispose() }
  } finally { $res.Dispose() }
}
function Save-ArtRelease($Release, [string]$Destination, [string]$ExpectedSha = '', [scriptblock]$Progress) {
  $archive = Get-ArtArchiveName $Release.Tag
  $repository = $script:ArtRepo
  # Existing installers retain their exact legacy pin and hash; discovery never
  # falls back to the old repository or offers its branches as new choices.
  if ($Release.PinnedRepository) {
    if ($Release.PinnedRepository -cne 'cehinds/AshenSpire-art' -or $Release.Tag -cnotmatch '^hd-assets-v[1-9][0-9]*$' -or -not $ExpectedSha) { throw 'Invalid legacy installer art pin.' }
    $repository = $Release.PinnedRepository
  } elseif ($Release.Tag -cnotmatch '^ashenspire-hd-assets-v[1-9][0-9]*$') { throw 'Invalid art release.' }
  $url = "https://github.com/$repository/releases/download/$($Release.Tag)/$archive"
  if ($Release.Url -cne $url -or (-not $ExpectedSha -and $Release.ChecksumUrl -cne "$url.sha256")) { throw 'The art release names an unexpected archive URL.' }
  $dest = [IO.Path]::GetFullPath($Destination)
  $part = "$dest.$([Guid]::NewGuid().ToString('N')).part"
  $sumFile = "$part.sha256"
  $backup = "$part.previous"
  try {
    if (-not $ExpectedSha) {
      Save-ArtFile $Release.ChecksumUrl $sumFile $Progress $repository
      $line = [IO.File]::ReadAllText($sumFile).Trim()
      if ($line -notmatch '^([a-fA-F0-9]{64})(?:\s+\*?([^\r\n]+))?$') { throw 'The art checksum file is invalid.' }
      $ExpectedSha = $Matches[1].ToLowerInvariant()
      if ($Matches[2] -and $Matches[2] -cne $archive) { throw 'The checksum names a different art archive.' }
    }
    if ($ExpectedSha -notmatch '^[a-fA-F0-9]{64}$') { throw 'Invalid art checksum.' }
    Save-ArtFile $Release.Url $part $Progress $repository
    $sha = [Security.Cryptography.SHA256]::Create(); $stream = [IO.File]::OpenRead($part)
    try { $actual = ([BitConverter]::ToString($sha.ComputeHash($stream)) -replace '-', '').ToLowerInvariant() } finally { $stream.Dispose(); $sha.Dispose() }
    if ($actual -ne $ExpectedSha.ToLowerInvariant()) { throw 'The downloaded art failed its SHA-256 check. Your existing file has been kept.' }
    # Replacement happens only after verification. Save As asks before overwrite.
    if ([IO.File]::Exists($dest)) { [IO.File]::Replace($part, $dest, $backup) }
    else { [IO.File]::Move($part, $dest) }
    return $actual
  } finally {
    foreach ($file in @($part, $sumFile, $backup)) { if ([IO.File]::Exists($file)) { [IO.File]::Delete($file) } }
  }
}
