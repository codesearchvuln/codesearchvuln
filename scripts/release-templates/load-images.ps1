#Requires -Version 5.1

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$ServicesMetadataFile = if ($env:SERVICES_IMAGES_MANIFEST_PATH) {
    $env:SERVICES_IMAGES_MANIFEST_PATH
} else {
    Join-Path $RootDir "images-manifest-services.json"
}
$ScannerMetadataFile = if ($env:SCANNER_IMAGES_MANIFEST_PATH) {
    $env:SCANNER_IMAGES_MANIFEST_PATH
} else {
    Join-Path $RootDir "images-manifest-scanner.json"
}

function Fail {
    param([string]$Message)
    [Console]::Error.WriteLine("[offline-images] $Message")
    exit 1
}

function Log-Info {
    param([string]$Message)
    [Console]::WriteLine("[offline-images] $Message")
}

function Test-DockerImage {
    param([string]$Reference)

    & docker image inspect $Reference *> $null
    return ($LASTEXITCODE -eq 0)
}

function Get-ReleaseArchitecture {
    if ($env:PROCESSOR_ARCHITECTURE) {
        switch ($env:PROCESSOR_ARCHITECTURE.ToUpperInvariant()) {
            "AMD64" { return "amd64" }
            "ARM64" { return "arm64" }
        }
    }

    $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLowerInvariant()
    switch ($arch) {
        "x64" { return "amd64" }
        "arm64" { return "arm64" }
        default { Fail "unsupported architecture: $arch" }
    }
}

function Find-Bundle {
    param(
        [string]$Bundle,
        [string]$Arch
    )

    # Expected bundle names:
    # - vulhunter-services-images-$Arch.tar.zst
    # - vulhunter-scanner-images-$Arch.tar.zst
    $candidates = @(
        (Join-Path $RootDir "images/vulhunter-$Bundle-images-$Arch.tar.zst"),
        (Join-Path $RootDir "vulhunter-$Bundle-images-$Arch.tar.zst"),
        (Join-Path $RootDir "images/vulhunter-$Bundle-images-$Arch.tar"),
        (Join-Path $RootDir "vulhunter-$Bundle-images-$Arch.tar")
    )

    foreach ($path in $candidates) {
        if (Test-Path -LiteralPath $path) {
            return $path
        }
    }

    return $null
}

function Load-Bundle {
    param([string]$BundlePath)

    Log-Info "loading bundle: $BundlePath"

    if ($BundlePath.EndsWith(".tar.zst")) {
        $zstdCommand = Get-Command zstd -ErrorAction SilentlyContinue
        if (-not $zstdCommand) {
            Fail "zstd is required to load $BundlePath"
        }

        $dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
        if (-not $dockerCommand) {
            Fail "docker is required to load $BundlePath"
        }

        $streamCommand = ('"{0}" -dc -- "{1}" | "{2}" load' -f $zstdCommand.Source, $BundlePath, $dockerCommand.Source)
        $process = Start-Process -FilePath "cmd.exe" -ArgumentList @("/d", "/c", $streamCommand) -NoNewWindow -Wait -PassThru
        if ($process.ExitCode -ne 0) {
            Fail "failed to stream-load bundle: $BundlePath"
        }
        return
    }

    if ($BundlePath.EndsWith(".tar")) {
        & docker load -i $BundlePath
        if ($LASTEXITCODE -ne 0) {
            Fail "docker load failed for $BundlePath"
        }
        return
    }

    Fail "unsupported bundle format: $BundlePath"
}

if (-not (Test-Path -LiteralPath $ServicesMetadataFile)) {
    Fail "images manifest not found: $ServicesMetadataFile"
}
if (-not (Test-Path -LiteralPath $ScannerMetadataFile)) {
    Fail "images manifest not found: $ScannerMetadataFile"
}

$Arch = Get-ReleaseArchitecture
$ServicesBundlePath = Find-Bundle -Bundle "services" -Arch $Arch
$ScannerBundlePath = Find-Bundle -Bundle "scanner" -Arch $Arch

if (-not $ServicesBundlePath) {
    Fail "offline image bundle not found for $Arch. Download vulhunter-services-images-$Arch.tar.zst into ./images or the release root."
}
if (-not $ScannerBundlePath) {
    Fail "offline image bundle not found for $Arch. Download vulhunter-scanner-images-$Arch.tar.zst into ./images or the release root."
}

Load-Bundle -BundlePath $ServicesBundlePath
Load-Bundle -BundlePath $ScannerBundlePath

$metadataFiles = @($ServicesMetadataFile, $ScannerMetadataFile)
foreach ($metadataPath in $metadataFiles) {
    $metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
    foreach ($property in $metadata.images.PSObject.Properties) {
        $logicalName = $property.Name
        $sourceRef = [string]$property.Value.source_ref
        $localTag = [string]$property.Value.local_tag

        if (Test-DockerImage -Reference $localTag) {
            Log-Info "ready: $logicalName -> $localTag"
            continue
        }

        if (Test-DockerImage -Reference $sourceRef) {
            & docker tag $sourceRef $localTag
            if ($LASTEXITCODE -ne 0) {
                Fail "docker tag failed for $logicalName ($sourceRef -> $localTag)"
            }
            Log-Info "retagged: $logicalName -> $localTag"
            continue
        }

        Fail "image missing after load: $logicalName ($localTag). Re-download the bundle and retry."
    }
}

Log-Info "all offline images are ready for $Arch"
