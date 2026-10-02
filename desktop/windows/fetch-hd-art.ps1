# desktop/windows/fetch-hd-art.ps1 — the Windows installer's high-resolution art step.
#
#   -Mode Install -InstallDir <dir> -Url <zip url> -Sha256 <zip sha256>
#       make the high art tier complete in <dir>\game: every object the high pack
#       index lists is put under game\objects\ (downloading the pinned release zip
#       only when one is missing), then the high index is copied into game\packs\.
#   -Mode Prune -InstallDir <dir>
#       delete every file under game\objects\ that no installed pack lists (the
#       high objects after the player unticked the art, an older version's objects).
#   -Mode Drop -InstallDir <dir> -OldFiles <list> -NewFiles <list>
#       before an upgrade copies its files: delete each file the previous version's
#       install-data\files.txt lists and the new one does not, and the folders that
#       leaves empty, so a path that changes between file and folder can be written.
#
# WHY THIS SHAPE (desktop/windows/README.md). The game is the web edition: its
# HTML pins the light, common and high pack indexes and loads the high tier when
# packs\high-<digest>.json is beside it, the light tier when it is not
# (src/ui/assetPacks.js). The installer carries light and common; the high
# objects come from the public art release (art-release.json packs.high), the
# zip tools/fetch-art.mjs fetches, whose entries sit at their asset id.
#
# NOTHING UNCHECKED IS KEPT. The zip must match the pinned sha256, and every
# object must match the sha256 the index names, before it is written; each is
# written beside its final name and renamed into place. The index goes in LAST,
# so the game never sees a high tier with a file missing: until this script
# exits 0 the game plays on the light art.
#
# Exit codes: 0 done · 2 download failed · 3 zip sha256 mismatch · 4 an object is
# missing from the zip or does not match · 5 anything else.
# Runs on Windows PowerShell 5.1 (every Windows 10/11) and PowerShell 7.

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidateSet('Install', 'Prune', 'Drop')][string]$Mode,
  [Parameter(Mandatory = $true)][string]$InstallDir,
  [string]$Url,
  [string]$Sha256,
  [string]$OldFiles,
  [string]$NewFiles
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Game = Join-Path $InstallDir 'game'
$Data = Join-Path $InstallDir 'install-data'
$Packs = Join-Path $Game 'packs'

# Every line also goes to install-data\hd-art.log: a silent install shows none of
# them, and a player who reports a failed download can send the file.
$Log = Join-Path $Data 'hd-art.log'
function Say([string]$Message) {
  [Console]::Out.WriteLine($Message); [Console]::Out.Flush()
  try { [IO.File]::AppendAllText($Log, ("{0:u} {1}`r`n" -f (Get-Date), $Message)) } catch { }
}
function Fail([int]$Code, [string]$Message) { Say "ERROR: $Message"; exit $Code }

function Get-Hex([byte[]]$Hash) { ([BitConverter]::ToString($Hash) -replace '-', '').ToLowerInvariant() }

# The sha256 of a file, through .NET. Not Get-FileHash: in Windows PowerShell 5.1
# that is a script function in a module, and an installer started from a shell
# whose PSModulePath points elsewhere (PowerShell 7, as CI does) cannot load it.
function Get-FileSha256([string]$Path) {
  $sha = [Security.Cryptography.SHA256]::Create()
  $stream = [IO.File]::OpenRead($Path)
  try { return Get-Hex ($sha.ComputeHash($stream)) } finally { $stream.Dispose(); $sha.Dispose() }
}

# Lines of <sha256> TAB <bytes> TAB <object path> TAB <asset id>, written by
# build-installer.mjs from the pack indexes.
function Read-ObjectList([string]$File) {
  $list = New-Object System.Collections.Generic.List[object]
  foreach ($line in [IO.File]::ReadAllLines($File)) {
    if (-not $line) { continue }
    $f = $line.Split("`t")
    $list.Add([pscustomobject]@{ Sha = $f[0]; Bytes = [long]$f[1]; Path = $f[2]; Id = $f[3] })
  }
  return , $list
}

function Get-ObjectFile([string]$RelPath) { Join-Path $Game ($RelPath.Replace('/', [IO.Path]::DirectorySeparatorChar)) }

# An object already on disk counts only when its bytes hash to the index's sha256:
# a damaged file is fetched again rather than shown.
function Test-Object($Entry) {
  $file = Get-ObjectFile $Entry.Path
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { return $false }
  if ((Get-Item -LiteralPath $file).Length -ne $Entry.Bytes) { return $false }
  return (Get-FileSha256 $file) -eq $Entry.Sha
}

function Save-Download([string]$From, [string]$To) {
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  $request = [Net.HttpWebRequest]::Create($From)
  $request.UserAgent = 'AshenSpire-Installer'
  $request.AllowAutoRedirect = $true
  $request.Timeout = 60000
  $request.ReadWriteTimeout = 60000
  $response = $request.GetResponse()
  try {
    $total = $response.ContentLength
    $in = $response.GetResponseStream()
    $out = [IO.File]::Create("$To.part")
    try {
      $buffer = New-Object byte[] (1MB)
      $done = [long]0
      $nextReport = 0
      while (($read = $in.Read($buffer, 0, $buffer.Length)) -gt 0) {
        $out.Write($buffer, 0, $read)
        $done += $read
        if ($total -gt 0) {
          $pct = [int][Math]::Floor(100 * $done / $total)
          if ($pct -ge $nextReport) {
            Say ("Downloading high-resolution art: {0,3}%  ({1:N0} of {2:N0} MB)" -f $pct, ($done / 1MB), ($total / 1MB))
            $nextReport = $pct + 5
          }
        }
      }
    } finally { $out.Dispose(); $in.Dispose() }
  } finally { $response.Dispose() }
  if (Test-Path -LiteralPath $To) { Remove-Item -LiteralPath $To -Force }
  Move-Item -LiteralPath "$To.part" -Destination $To
}

function Install-HighArt {
  if (-not $Url -or -not $Sha256) { Fail 5 'Install needs -Url and -Sha256.' }
  $high = Read-ObjectList (Join-Path $Data 'high-objects.tsv')
  $missing = New-Object System.Collections.Generic.List[object]
  foreach ($e in $high) { if (-not (Test-Object $e)) { $missing.Add($e) } }

  if ($missing.Count -eq 0) {
    Say "High-resolution art: all $($high.Count) files already installed."
  } else {
    Say "High-resolution art: $($missing.Count) of $($high.Count) files to install."
    $zip = Join-Path ([IO.Path]::GetTempPath()) ("AshenSpire-hd-{0}.zip" -f $Sha256.Substring(0, 12))
    $sha = $Sha256.ToLowerInvariant()
    # A zip left by an interrupted install is reused only when it is the pinned one.
    if ((Test-Path -LiteralPath $zip) -and ((Get-FileSha256 $zip) -ne $sha)) {
      Remove-Item -LiteralPath $zip -Force
    }
    if (-not (Test-Path -LiteralPath $zip)) {
      Say "Downloading $Url"
      try { Save-Download $Url $zip } catch {
        Remove-Item -LiteralPath "$zip.part" -Force -ErrorAction SilentlyContinue
        Fail 2 "Download failed: $($_.Exception.Message)"
      }
      Say 'Checking the download...'
      $got = (Get-FileSha256 $zip)
      if ($got -ne $sha) {
        Remove-Item -LiteralPath $zip -Force
        Fail 3 "The download does not match the pinned release (sha256 $got, expected $sha)."
      }
    }

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $hasher = [Security.Cryptography.SHA256]::Create()
    $archive = [IO.Compression.ZipFile]::OpenRead($zip)
    try {
      $i = 0
      foreach ($e in $missing) {
        $entry = $archive.GetEntry($e.Id)
        if (-not $entry) { Fail 4 "The release has no file for $($e.Id)." }
        $stream = $entry.Open()
        $memory = New-Object IO.MemoryStream
        try { $stream.CopyTo($memory) } finally { $stream.Dispose() }
        $bytes = $memory.ToArray()
        $memory.Dispose()
        $got = Get-Hex ($hasher.ComputeHash($bytes))
        if ($got -ne $e.Sha) { Fail 4 "$($e.Id) does not match the game's index (sha256 $got, expected $($e.Sha))." }
        $file = Get-ObjectFile $e.Path
        $dir = Split-Path -Parent $file
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        # A failed write (a full disk, a locked file) leaves no .part behind: the
        # uninstaller only knows final object names.
        try {
          [IO.File]::WriteAllBytes("$file.part", $bytes)
          if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force }
          Move-Item -LiteralPath "$file.part" -Destination $file
        } catch {
          Remove-Item -LiteralPath "$file.part" -Force -ErrorAction SilentlyContinue
          throw
        }
        $i++
        if ($i % 500 -eq 0 -or $i -eq $missing.Count) { Say "Installing high-resolution art: $i of $($missing.Count) files" }
      }
    } finally { $archive.Dispose(); $hasher.Dispose() }
    Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
  }

  # Last: the index, which is what turns the high tier on.
  foreach ($f in Get-ChildItem -LiteralPath (Join-Path $Data 'hd-index') -File) {
    Copy-Item -LiteralPath $f.FullName -Destination (Join-Path $Packs $f.Name) -Force
  }
  Say 'High-resolution art installed.'
}

function Remove-DroppedFiles {
  if (-not $OldFiles -or -not (Test-Path -LiteralPath $OldFiles)) { return }
  if (-not $NewFiles -or -not (Test-Path -LiteralPath $NewFiles)) { Fail 5 'Drop needs -NewFiles.' }
  $now = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($l in [IO.File]::ReadAllLines($NewFiles)) { if ($l) { [void]$now.Add($l) } }
  $root = [IO.Path]::GetFullPath($InstallDir).TrimEnd('\', '/')
  $removed = 0
  $drop = New-Object System.Collections.Generic.List[string]
  foreach ($l in [IO.File]::ReadAllLines($OldFiles)) {
    if (-not $l) { continue }
    # The old high index, if its download put a copy in game/packs: that copy
    # goes too (the art section copies the new one in when it is ticked).
    if ($l -match '^install-data/hd-index/([^/]+)$' -and -not $now.Contains("game/packs/$($Matches[1])")) { $drop.Add("game/packs/$($Matches[1])") }
    if (-not $now.Contains($l)) { $drop.Add($l) }
  }
  foreach ($l in $drop) {
    # Only plain relative paths the old installer wrote; never outside the folder.
    if (-not $l -or $l.StartsWith('game/objects/') -or $l -match '(^|/)\.\.(/|$)' -or $l -match '^[\\/]|:') { continue }
    $file = Join-Path $InstallDir ($l.Replace('/', [IO.Path]::DirectorySeparatorChar))
    if (Test-Path -LiteralPath $file -PathType Leaf) {
      Remove-Item -LiteralPath $file -Force; $removed++
      # The folders this leaves empty go too, up to (never including) the install folder.
      $dir = Split-Path -Parent $file
      while ($dir -and [IO.Path]::GetFullPath($dir).TrimEnd('\', '/') -ne $root -and (Test-Path -LiteralPath $dir) -and -not (Get-ChildItem -LiteralPath $dir -Force)) {
        Remove-Item -LiteralPath $dir -Force
        $dir = Split-Path -Parent $dir
      }
    }
  }
  if ($removed) { Say "Removed $removed files the previous version installed and this one does not." }
}

function Invoke-Prune {
  $keep = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($e in (Read-ObjectList (Join-Path $Data 'base-objects.tsv'))) { [void]$keep.Add($e.Path) }
  $highOn = @(Get-ChildItem -LiteralPath $Packs -Filter 'high-*.json' -File -ErrorAction SilentlyContinue).Count -gt 0
  if ($highOn) { foreach ($e in (Read-ObjectList (Join-Path $Data 'high-objects.tsv'))) { [void]$keep.Add($e.Path) } }
  $objects = Join-Path $Game 'objects'
  if (-not (Test-Path -LiteralPath $objects)) { return }
  $root = (Resolve-Path -LiteralPath $Game).Path.TrimEnd('\', '/')
  $removed = 0
  foreach ($f in Get-ChildItem -LiteralPath $objects -Recurse -File) {
    $rel = $f.FullName.Substring($root.Length + 1) -replace '\\', '/'
    if (-not $keep.Contains($rel)) { Remove-Item -LiteralPath $f.FullName -Force; $removed++ }
  }
  foreach ($d in Get-ChildItem -LiteralPath $objects -Directory) {
    if (-not (Get-ChildItem -LiteralPath $d.FullName -Force)) { Remove-Item -LiteralPath $d.FullName -Force }
  }
  if ($removed) { Say "Removed $removed art files no installed pack uses." }
}

try {
  Say "fetch-hd-art $Mode (PowerShell $($PSVersionTable.PSVersion))"
  switch ($Mode) {
    'Install' { Install-HighArt }
    'Prune' { Invoke-Prune }
    'Drop' { Remove-DroppedFiles }
  }
  exit 0
} catch {
  Fail 5 $_.Exception.Message
}
