# Real public-release download through the chooser's helper, separate from install.
param([Parameter(Mandatory = $true)][string]$Destination)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../desktop/windows/art-releases.ps1')
$pin = Get-Content (Join-Path $PSScriptRoot '../art-release.json') -Raw | ConvertFrom-Json
$release = [pscustomobject]@{ Tag = $pin.tag; Url = "https://github.com/$($pin.repo)/releases/download/$($pin.tag)/$($pin.packs.high.zip)"; ChecksumUrl = '' }
$sha = Save-ArtRelease $release $Destination $pin.packs.high.sha256
if (-not (Test-Path -LiteralPath $Destination -PathType Leaf) -or $sha -ne $pin.packs.high.sha256) { throw 'Standalone art download was not verified.' }
Write-Output "Standalone art download verified: $($pin.tag), SHA-256 $sha"
