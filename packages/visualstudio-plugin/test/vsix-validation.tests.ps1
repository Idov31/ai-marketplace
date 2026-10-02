$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$validator = Join-Path $PSScriptRoot '../../../scripts/validate-visualstudio-vsix.ps1'
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('ai-marketplace-vsix-test-' + [guid]::NewGuid().ToString('N') + '.vsix')

function Write-Fixture([bool]$codebase, [bool]$jsonDependency, [bool]$logo = $true) {
    $archive = [IO.Compression.ZipFile]::Open($fixture, [IO.Compression.ZipArchiveMode]::Create)
    try {
        $files = @{
            'extension.vsixmanifest' = '<PackageManifest xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011"><Metadata><Identity Version="1.1.0" /></Metadata><Assets><Asset Type="Microsoft.VisualStudio.VsPackage" Path="AIMarketplace.VisualStudio.pkgdef" /></Assets></PackageManifest>'
            'AIMarketplace.VisualStudio.pkgdef' = ('[$RootKey$\Packages\{1f90619f-0241-45fc-9752-6223816b05e8}]' + "`r`n" + '"Class"="AIMarketplace.VisualStudio.MarketplacePackage"' + "`r`n")
        }
        if ($codebase) { $files['AIMarketplace.VisualStudio.pkgdef'] += '"CodeBase"="$PackageFolder$\AIMarketplace.VisualStudio.dll"' + "`r`n" }
        foreach ($name in @(
            'AIMarketplace.VisualStudio.dll', 'Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.Wpf.dll',
            'runtimes/win-x64/native/WebView2Loader.dll', 'runtimes/win-arm64/native/WebView2Loader.dll',
            'Runtime/win-x64/node.exe', 'Runtime/win-arm64/node.exe', 'Sidecar/ai-marketplace.cjs',
            'Dashboard/index.html', 'Dashboard/app.js', 'Dashboard/styles.css', 'runtime-manifest.json', 'runtime-sbom.json'
        )) { $files[$name] = 'fixture' }
        if ($jsonDependency) { $files['Newtonsoft.Json.dll'] = 'fixture' }
        if ($logo) { $files['Assets/ai-marketplace.png'] = 'fixture' }
        foreach ($name in $files.Keys) {
            $writer = [IO.StreamWriter]::new($archive.CreateEntry($name).Open())
            try { $writer.Write($files[$name]) } finally { $writer.Dispose() }
        }
    } finally { $archive.Dispose() }
}

$cases = @(
    @{ Name = 'accepts installed CodeBase and bundled dependencies'; Codebase = $true; Json = $true; ExpectedError = $null },
    @{ Name = 'rejects the original missing CodeBase registration'; Codebase = $false; Json = $true; ExpectedError = 'Package registration must locate the assembly' },
    @{ Name = 'rejects a missing private dependency'; Codebase = $true; Json = $false; ExpectedError = "VSIX is missing required file 'Newtonsoft.Json.dll'" },
    @{ Name = 'rejects a missing marketplace image'; Codebase = $true; Json = $true; Logo = $false; ExpectedError = "VSIX is missing required file 'Assets/ai-marketplace.png'" }
)
try {
    foreach ($case in $cases) {
        Write-Fixture $case.Codebase $case.Json (-not $case.ContainsKey('Logo') -or $case.Logo)
        $failure = $null
        try { & $validator -Path $fixture -ExpectedVersion '1.1.0' | Out-Null }
        catch { $failure = $_.Exception.Message }
        if ($null -eq $case.ExpectedError) {
            if ($null -ne $failure) { throw $failure }
        } elseif ($null -eq $failure -or -not $failure.StartsWith($case.ExpectedError)) {
            throw "Expected '$($case.ExpectedError)' but received '$failure'."
        }
        Write-Output "PASS $($case.Name)"
        Remove-Item -LiteralPath $fixture
    }
} finally {
    if (Test-Path -LiteralPath $fixture) { Remove-Item -LiteralPath $fixture }
}
