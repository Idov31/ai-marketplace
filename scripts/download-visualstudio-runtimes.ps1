$ErrorActionPreference = "Stop"
$version = "22.23.2"
$root = Join-Path $PSScriptRoot "..\.project\runtime-cache"
$archives = @(
    @{ Architecture = "x64"; Hash = "1177b4137ba5adaa56354ae40f1080c7450e8ae09cecb47da459d1c52ac99f97" },
    @{ Architecture = "arm64"; Hash = "fec025a6da31757e3b6af84c5a1628e9d38442ca99a2161091d78f2fcfa35ef3" }
)
New-Item -ItemType Directory -Force -Path $root | Out-Null
foreach ($item in $archives) {
    $name = "node-v$version-win-$($item.Architecture)"
    $zip = Join-Path $root "$name.zip"
    $destination = Join-Path $root $name
    Invoke-WebRequest "https://nodejs.org/download/release/v$version/$name.zip" -OutFile $zip
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash.ToLowerInvariant()
    if ($actual -ne $item.Hash) { throw "Node $version $($item.Architecture) checksum mismatch." }
    if (Test-Path -LiteralPath $destination) { Remove-Item -Recurse -Force -LiteralPath $destination }
    Expand-Archive -LiteralPath $zip -DestinationPath $root -Force
}
Write-Host "Downloaded and verified Node.js $version runtimes."
