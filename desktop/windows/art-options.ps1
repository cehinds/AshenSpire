# The installer's art chooser. UI only; installing the compatible pack remains
# fetch-hd-art.ps1's verified transaction. Other releases can be saved separately.
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Config,
  [Parameter(Mandatory = $true)][string]$SelectionFile,
  [string]$InstalledVersion = 'Standard art only',
  [string]$PreviewFile
)
$ErrorActionPreference = 'Stop'
$pin = Get-Content -LiteralPath $Config -Raw | ConvertFrom-Json
if ($pin.repo -ne 'cehinds/AshenSpire-art' -or $pin.tag -notmatch '^hd-assets-v[0-9]+$') { throw 'Invalid installer art configuration.' }
. (Join-Path $PSScriptRoot 'art-releases.ps1')
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
$form = New-Object Windows.Forms.Form
$form.Text = 'Ashen Spire - High-quality artwork'
$form.ClientSize = New-Object Drawing.Size(640, 440)
$form.FormBorderStyle = 'FixedDialog'; $form.MaximizeBox = $false; $form.MinimizeBox = $false
$form.StartPosition = 'CenterScreen'; $form.AutoScaleMode = 'Dpi'
function Label([string]$Text, [int]$X, [int]$Y, [int]$W, [int]$H) {
  $control = New-Object Windows.Forms.Label
  $control.Text = $Text; $control.SetBounds($X, $Y, $W, $H); $form.Controls.Add($control)
  return $control
}
function Button([string]$Text, [int]$Y) {
  $control = New-Object Windows.Forms.Button
  $control.Text = $Text; $control.SetBounds(24, $Y, 592, 34); $form.Controls.Add($control)
  return $control
}
$heading = Label 'High-quality artwork' 24 18 592 28
$heading.Font = New-Object Drawing.Font('Segoe UI', 15, [Drawing.FontStyle]::Bold)
$null = Label "Current installed art: $InstalledVersion`r`nArt required by this game: $($pin.tag)" 24 54 592 38
$latest = Label 'Latest published art: not checked yet' 24 98 592 22
$null = Label 'Art repository branch' 24 130 290 20
$null = Label 'Published art version' 326 130 290 20
$branch = New-Object Windows.Forms.ComboBox; $branch.DropDownStyle = 'DropDownList'; $branch.SetBounds(24, 154, 290, 28)
$version = New-Object Windows.Forms.ComboBox; $version.DropDownStyle = 'DropDownList'; $version.SetBounds(326, 154, 290, 28)
$form.Controls.AddRange(@($branch, $version))
$null = $branch.Items.Add('main'); $branch.SelectedIndex = 0
$null = $version.Items.Add($pin.tag); $version.SelectedIndex = 0
$status = Label 'The matching game art is available even when the online catalog is offline.' 24 191 592 39
$install = Button 'Use this high-quality art for installation' 236
$download = Button 'Download this art separately...' 278
$refresh = Button 'Refresh branches and art versions' 320
$null = Label 'The artwork is completely AI-generated with OpenAI ChatGPT under human direction. Fonts and other third-party assets retain their credited licenses.' 24 366 592 42
$script:catalog = $null; $script:updating = $false
$script:downloading = $false; $script:cancelDownload = $false
$form.add_FormClosing({
  if ($script:downloading) { $script:cancelDownload = $true; $_.Cancel = $true }
})
$script:pinnedRelease = [pscustomobject]@{ Tag = $pin.tag; Url = "https://github.com/$($pin.repo)/releases/download/$($pin.tag)/$($pin.packs.high.zip)"; ChecksumUrl = ''; Bytes = 0 }
function SelectedRelease {
  $tag = [string]$version.SelectedItem
  if ($tag -eq $pin.tag) { return $script:pinnedRelease }
  return $script:catalog.Releases | Where-Object { $_.Tag -eq $tag } | Select-Object -First 1
}
function Busy([bool]$Value, [string]$Message) {
  $form.UseWaitCursor = $Value; $branch.Enabled = -not $Value; $version.Enabled = -not $Value
  $refresh.Enabled = -not $Value; $install.Enabled = -not $Value; $download.Enabled = -not $Value
  $status.Text = $Message; $form.Refresh()
}
function UpdateSelection {
  if ($script:updating) { return }
  $release = SelectedRelease
  $valid = $false
  try {
    if ($release) {
      Busy $true 'Checking that this art release is included in the selected branch...'
      # The pinned offline fallback is main, where the public art releases originate.
      $valid = if (-not $script:catalog) { [string]$branch.SelectedItem -eq 'main' -and $release.Tag -eq $pin.tag }
               else { Test-ArtBranch ([string]$branch.SelectedItem) $release.Tag }
    }
    Busy $false ''
    $install.Enabled = $valid -and $release.Tag -eq $pin.tag
    $download.Enabled = $valid
    if (-not $valid) { $status.Text = 'This branch does not contain the selected release. Choose another branch or version.' }
    elseif ($release.Tag -ne $pin.tag) { $status.Text = "Available as a separate download. This game requires $($pin.tag) for installation." }
    else { $status.Text = 'Compatible with this game. Install it, or save the verified art zip separately.' }
  } catch {
    Busy $false ("Could not check the branch: " + $_.Exception.Message)
    $install.Enabled = $false; $download.Enabled = $false
  }
}
$branch.add_SelectedIndexChanged({ UpdateSelection })
$version.add_SelectedIndexChanged({ UpdateSelection })
$refresh.add_Click({
  try {
    Busy $true 'Loading the public art catalog from GitHub...'
    $next = Get-ArtCatalog
    if (-not $next.Branches.Count -or -not $next.Releases.Count) { throw 'The repository has no published art versions.' }
    $script:updating = $true; $script:catalog = $next
    $oldBranch = [string]$branch.SelectedItem; $oldVersion = [string]$version.SelectedItem
    $branch.Items.Clear(); foreach ($item in $next.Branches) { $null = $branch.Items.Add($item) }
    $version.Items.Clear(); foreach ($item in $next.Releases) { $null = $version.Items.Add($item.Tag) }
    if (-not $version.Items.Contains($pin.tag)) { $null = $version.Items.Add($pin.tag) }
    $branch.SelectedItem = if ($branch.Items.Contains($oldBranch)) { $oldBranch } else { 'main' }
    $version.SelectedItem = $oldVersion
    $latest.Text = "Latest published art: $($next.Releases[0].Tag) ($($next.Releases[0].Published))"
  } catch {
    Busy $false ("Catalog unavailable; matching art remains available. " + $_.Exception.Message)
    $install.Enabled = ([string]$version.SelectedItem -eq $pin.tag -and [string]$branch.SelectedItem -eq 'main')
    $download.Enabled = $install.Enabled
    return
  } finally { $script:updating = $false }
  UpdateSelection
})
$install.add_Click({
  if (-not $install.Enabled -or [string]$version.SelectedItem -ne $pin.tag) { return }
  # Only known catalog values are written, not commands or URLs from UI input.
  [IO.File]::WriteAllText($SelectionFile, "[art]`r`nInstall=1`r`nVersion=$($pin.tag)`r`n", [Text.Encoding]::ASCII)
  $form.DialogResult = 'OK'; $form.Close()
})
$download.add_Click({
  $release = SelectedRelease
  if (-not $download.Enabled -or -not $release) { return }
  $dialog = New-Object Windows.Forms.SaveFileDialog
  $dialog.Filter = 'Art archive (*.zip)|*.zip'; $dialog.FileName = "$($release.Tag).zip"; $dialog.OverwritePrompt = $true
  try {
    if ($dialog.ShowDialog($form) -ne 'OK') { return }
    Busy $true 'Downloading and checking the art archive. This can take a few minutes...'
    $script:downloading = $true; $script:cancelDownload = $false
    $expected = if ($release.Tag -eq $pin.tag) { $pin.packs.high.sha256 } else { '' }
    $null = Save-ArtRelease $release $dialog.FileName $expected {
      param($Done, $Total)
      $status.Text = "Downloading art: $([Math]::Round($Done / 1MB, 1)) MB. Close this window to cancel."
      if ($Total -gt 0) { $status.Text += " ($([Math]::Floor(100 * $Done / $Total))%)" }
      [Windows.Forms.Application]::DoEvents()
      if ($script:cancelDownload) { throw 'Download cancelled; your existing file has been kept.' }
    }
    Busy $false ("Verified art saved to " + $dialog.FileName)
  } catch {
    Busy $false ("Art download failed: " + $_.Exception.Message)
  } finally { $script:downloading = $false; $dialog.Dispose(); $install.Enabled = ([string]$version.SelectedItem -eq $pin.tag) }
})
if ($PreviewFile) {
  # Deterministic render for CI review, with no network or interactive window.
  $latest.Text = 'Latest published art: check with Refresh branches and art versions'
  $form.ShowInTaskbar = $false; $form.Opacity = 0
  $form.Show(); [Windows.Forms.Application]::DoEvents()
  $bitmap = New-Object Drawing.Bitmap($form.Width, $form.Height)
  try { $form.DrawToBitmap($bitmap, (New-Object Drawing.Rectangle(0, 0, $form.Width, $form.Height))); $bitmap.Save($PreviewFile, [Drawing.Imaging.ImageFormat]::Png) }
  finally { $bitmap.Dispose(); $form.Close(); $form.Dispose() }
} else {
  $form.add_Shown({ $refresh.PerformClick() })
  $null = $form.ShowDialog(); $form.Dispose()
}
