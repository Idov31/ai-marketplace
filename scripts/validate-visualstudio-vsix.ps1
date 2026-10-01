param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$ExpectedVersion
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $Path).Path)
try {
    function Read-PackageEntry([string]$name) {
        $entry = $archive.GetEntry($name)
        if ($null -eq $entry) { throw "VSIX is missing required file '$name'." }
        $reader = [IO.StreamReader]::new($entry.Open())
        try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
    }

    [xml]$manifest = Read-PackageEntry 'extension.vsixmanifest'
    if ($manifest.PackageManifest.Metadata.Identity.Version -ne $ExpectedVersion) {
        throw 'Packaged VSIX identity does not match the requested version.'
    }
    $required = @(
        'AIMarketplace.VisualStudio.dll',
        'Newtonsoft.Json.dll',
        'Microsoft.Web.WebView2.Core.dll',
        'Microsoft.Web.WebView2.Wpf.dll',
        'runtimes/win-x64/native/WebView2Loader.dll',
        'runtimes/win-arm64/native/WebView2Loader.dll',
        'Runtime/win-x64/node.exe',
        'Runtime/win-arm64/node.exe',
        'Sidecar/ai-marketplace.cjs',
        'Dashboard/index.html',
        'Dashboard/app.js',
        'Dashboard/styles.css',
        'Assets/ai-marketplace.png',
        'runtime-manifest.json',
        'runtime-sbom.json'
    )
    foreach ($name in $required) {
        if ($null -eq $archive.GetEntry($name)) { throw "VSIX is missing required file '$name'." }
    }
    $packageAsset = @($manifest.PackageManifest.Assets.Asset | Where-Object { $_.Type -eq 'Microsoft.VisualStudio.VsPackage' })
    if ($packageAsset.Count -ne 1) { throw 'VSIX must declare exactly one package registration asset.' }
    $registration = Read-PackageEntry $packageAsset[0].Path
    $packageKey = [regex]::Escape('[$RootKey$\Packages\{1f90619f-0241-45fc-9752-6223816b05e8}]')
    $section = [regex]::Match($registration, '(?is)' + $packageKey + '(.*?)(?=\r?\n\[|\z)').Groups[1].Value
    if ($section -notmatch '(?im)^"CodeBase"="\$PackageFolder\$\\AIMarketplace\.VisualStudio\.dll"\s*$') {
        throw 'Package registration must locate the assembly through its installed $PackageFolder$ CodeBase.'
    }
    $assemblyVersion = [regex]::Escape($ExpectedVersion + '.0')
    if ($section -match '"Assembly"=' -and $section -notmatch ('"Assembly"="AIMarketplace\.VisualStudio, Version=' + $assemblyVersion + ',')) {
        throw 'Package registration assembly version does not match the VSIX identity.'
    }
    Write-Output "Validated VSIX ${ExpectedVersion}: installed assembly registration and required runtime dependencies."
} finally {
    $archive.Dispose()
}
