$ErrorActionPreference = 'Stop'
$researchRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'asset-manifest.json') -Raw | ConvertFrom-Json
$rows = foreach ($screen in $manifest) {
  $pngPath = Join-Path $researchRoot $screen.screenshot
  $pngBytes = [IO.File]::ReadAllBytes($pngPath)
  if ($pngBytes.Length -lt 24 -or $pngBytes[0] -ne 137 -or $pngBytes[1] -ne 80) { throw "Invalid PNG: $pngPath" }
  $pngWidth = [uint32]$pngBytes[16]*16777216 + [uint32]$pngBytes[17]*65536 + [uint32]$pngBytes[18]*256 + [uint32]$pngBytes[19]
  $pngHeight = [uint32]$pngBytes[20]*16777216 + [uint32]$pngBytes[21]*65536 + [uint32]$pngBytes[22]*256 + [uint32]$pngBytes[23]
  $assets = foreach ($asset in $screen.assets) {
    $assetPath = Join-Path $researchRoot $asset.path
    $rootTag = [regex]::Match([IO.File]::ReadAllText($assetPath), '<svg\b[^>]*>').Value
    if (!$rootTag) { throw "Invalid SVG: $assetPath" }
    [ordered]@{ path=$asset.path; bytes=(Get-Item -LiteralPath $assetPath).Length; sha256=(Get-FileHash -LiteralPath $assetPath -Algorithm SHA256).Hash.ToLower(); rootTag=$rootTag }
  }
  [ordered]@{ nodeId=$screen.id; png=$screen.screenshot; pngWidth=$pngWidth; pngHeight=$pngHeight; pngBytes=$pngBytes.Length; assets=@($assets) }
}
$rows | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'download-validation.json') -Encoding utf8
$contextFiles = Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'context-*.txt'
$temporaryMatches = $contextFiles | Select-String -Pattern 'https://www\.figma\.com/api/mcp/asset/'
if ($temporaryMatches) { throw 'Temporary URLs remain in saved contexts' }
[ordered]@{ screens=@($rows).Count; pngs=@($rows).Count; svgs=@($rows | ForEach-Object { $_.assets }).Count; contexts=$contextFiles.Count; temporaryAssetUrls=0 } | ConvertTo-Json
