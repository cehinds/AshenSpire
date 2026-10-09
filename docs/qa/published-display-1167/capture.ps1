param(
    [string]$BaseUrl = 'https://cehinds.github.io/AshenSpire/test/1167/',
    [string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
if (-not $repoRoot.StartsWith('D:\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Use a checkout under D: for this owner workspace.'
}
if (-not $BaseUrl.EndsWith('/')) { $BaseUrl += '/' }
$targetUri = [Uri]$BaseUrl
if (-not $targetUri.IsAbsoluteUri -or $targetUri.Scheme -ne 'https') {
    throw 'BaseUrl must be an absolute HTTPS game directory.'
}
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $repoRoot '.codex/published-display-qa' }
$outputPath = [IO.Path]::GetFullPath($OutputDirectory, $repoRoot)
if (-not $outputPath.StartsWith('D:\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Capture output must stay on D:.'
}
$recipePath = Join-Path $repoRoot 'docs/preview/display-appearance-0.7.1.1163/capture.mjs'
$recipe = [IO.File]::ReadAllText($recipePath)
$localHost = "const host=await serve({root:resolve('dist'),port:4497,open:false,lan:false,quiet:true});"
if (-not $recipe.Contains($localHost)) { throw 'The capture recipe changed; review the host adapter.' }
$remoteHost = 'const host={url:' + ($targetUri.AbsoluteUri | ConvertTo-Json -Compress) + ',server:{close:callback=>callback()}};'
$recipe = $recipe.Replace('../../../tools/', '../tools/').Replace($localHost, $remoteHost)
$recipe = $recipe.Replace("host.url+'AshenSpire.html?", "host.url+'?")
$recipe = $recipe.Replace('^\/assets\/sfx\/', '(?:^|\/)assets\/sfx\/')
$scriptDirectory = Join-Path $repoRoot '.codex'
New-Item -ItemType Directory -Path $scriptDirectory -Force | Out-Null
$scriptPath = Join-Path $scriptDirectory 'published-display-qa.mjs'
[IO.File]::WriteAllText($scriptPath, $recipe, [Text.UTF8Encoding]::new($false))
$priorLocation = Get-Location
$priorQaOutput = $env:QA_OUT
$priorTemp = $env:TEMP
$priorTmp = $env:TMP
try {
    Set-Location $repoRoot
    $env:QA_OUT = $outputPath
    $env:TEMP = 'D:/repos/.codex/tmp'
    $env:TMP = $env:TEMP
    node $scriptPath
    if ($LASTEXITCODE -ne 0) { throw "Published appearance capture failed: exit $LASTEXITCODE" }
} finally {
    Set-Location $priorLocation
    $env:QA_OUT = $priorQaOutput
    $env:TEMP = $priorTemp
    $env:TMP = $priorTmp
}
