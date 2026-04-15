#Requires -Version 5.1

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$ServicesMetadataFile = if ($env:SERVICES_IMAGES_MANIFEST_PATH) { $env:SERVICES_IMAGES_MANIFEST_PATH } else { Join-Path $RootDir "images-manifest-services.json" }
$ScannerMetadataFile = if ($env:SCANNER_IMAGES_MANIFEST_PATH) { $env:SCANNER_IMAGES_MANIFEST_PATH } else { Join-Path $RootDir "images-manifest-scanner.json" }
$BackendEnvFile = if ($env:BACKEND_ENV_FILE) { $env:BACKEND_ENV_FILE } else { Join-Path $RootDir "docker/env/backend/.env" }
$BackendEnvExample = if ($env:BACKEND_ENV_EXAMPLE) { $env:BACKEND_ENV_EXAMPLE } else { Join-Path $RootDir "docker/env/backend/env.example" }
$OfflineEnvFile = if ($env:OFFLINE_ENV_FILE) { $env:OFFLINE_ENV_FILE } else { Join-Path $RootDir "docker/env/backend/offline-images.env" }
$OfflineEnvExample = if ($env:OFFLINE_ENV_EXAMPLE) { $env:OFFLINE_ENV_EXAMPLE } else { Join-Path $RootDir "docker/env/backend/offline-images.env.example" }
$script:DockerBin = if ($env:DOCKER_BIN) { $env:DOCKER_BIN } else { "docker" }
$script:ZstdBin = if ($env:ZSTD_BIN) { $env:ZSTD_BIN } else { "zstd" }

function Fail {
    param([string]$Message)
    [Console]::Error.WriteLine("[offline-up] $Message")
    exit 1
}

function Log-Info {
    param([string]$Message)
    [Console]::WriteLine("[offline-up] $Message")
}

function Log-Warn {
    param([string]$Message)
    [Console]::Error.WriteLine("[offline-up] $Message")
}

function Ensure-TemplateCopy {
    param(
        [string]$Target,
        [string]$Example,
        [string]$Label,
        [string]$Warning
    )

    if (Test-Path -LiteralPath $Target) {
        return
    }
    if (-not (Test-Path -LiteralPath $Example)) {
        Fail "missing $Label example file: $Example"
    }
    $parent = Split-Path -Parent $Target
    if ($parent) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    Copy-Item -LiteralPath $Example -Destination $Target
    Log-Warn "$Label auto-generated from template: $Target"
    Log-Warn $Warning
}

function Detect-ComposeCommand {
    if ($env:DOCKER_BIN) {
        return @($script:DockerBin, "compose")
    }

    try {
        $null = & $script:DockerBin compose version 2>&1
        if ($LASTEXITCODE -eq 0) {
            return @($script:DockerBin, "compose")
        }
    } catch {}

    try {
        $null = docker-compose --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            return @("docker-compose")
        }
    } catch {}

    Fail "docker compose or docker-compose not found"
}

function Normalize-Arch {
    param([string]$Value)

    switch ($Value.Trim().ToLowerInvariant()) {
        "amd64" { return "amd64" }
        "x86_64" { return "amd64" }
        "arm64" { return "arm64" }
        "aarch64" { return "arm64" }
        default { Fail "unsupported docker server architecture: $Value" }
    }
}

function Get-DockerServerArchitecture {
    if ($env:DOCKER_SERVER_ARCH) {
        return Normalize-Arch -Value $env:DOCKER_SERVER_ARCH
    }
    try {
        $arch = (& $script:DockerBin version --format "{{.Server.Arch}}" 2>$null | Select-Object -Last 1)
    } catch {
        $arch = $null
    }
    if (-not $arch) {
        Fail "unable to determine docker server architecture"
    }
    return Normalize-Arch -Value ([string]$arch)
}

function Select-BundlePath {
    param(
        [string]$Bundle,
        [string]$Arch
    )

    $candidates = @(
        (Join-Path $RootDir "vulhunter-$Bundle-images-$Arch.tar.zst"),
        (Join-Path $RootDir "vulhunter-$Bundle-images-$Arch.tar"),
        (Join-Path $RootDir "images/vulhunter-$Bundle-images-$Arch.tar.zst"),
        (Join-Path $RootDir "images/vulhunter-$Bundle-images-$Arch.tar")
    )

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    Fail "offline image bundle not found for $Bundle/$Arch. Expected vulhunter-$Bundle-images-$Arch.tar.zst or .tar in the release root or images/."
}

function Require-ZstdIfNeeded {
    param([string]$BundlePath)
    if ($BundlePath.EndsWith(".tar.zst")) {
        if ($env:ZSTD_BIN) {
            return
        }
        $null = Get-Command zstd -ErrorAction SilentlyContinue
        if (-not $?) {
            Fail "required command not found: zstd"
        }
    }
}

function Load-Bundle {
    param([string]$BundlePath)

    Log-Info "loading bundle: $BundlePath"
    if ($BundlePath.EndsWith(".tar.zst")) {
        $command = "zstd -dc -- `"$BundlePath`" | docker load"
        if ($env:ZSTD_BIN) {
            $command = "`"$script:ZstdBin`" -dc -- `"$BundlePath`" | `"$script:DockerBin`" load"
        }
        $process = Start-Process -FilePath "cmd.exe" -ArgumentList @("/d", "/c", $command) -NoNewWindow -Wait -PassThru
        if ($process.ExitCode -ne 0) {
            Fail "failed to stream-load bundle: $BundlePath"
        }
        return
    }

    if ($BundlePath.EndsWith(".tar")) {
        & $script:DockerBin load -i $BundlePath
        if ($LASTEXITCODE -ne 0) {
            Fail "docker load failed for $BundlePath"
        }
        return
    }

    Fail "unsupported bundle format: $BundlePath"
}

function Test-DockerImage {
    param([string]$Reference)
    & $script:DockerBin image inspect $Reference *> $null
    return ($LASTEXITCODE -eq 0)
}

function Ensure-ImagesReady {
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
                & $script:DockerBin tag $sourceRef $localTag
                if ($LASTEXITCODE -ne 0) {
                    Fail "docker tag failed for $logicalName ($sourceRef -> $localTag)"
                }
                Log-Info "retagged: $logicalName -> $localTag"
                continue
            }

            Fail "image missing after load: $logicalName ($localTag). Re-download the bundle and retry."
        }
    }
}

function Validate-ComposeImagesCoveredByBundles {
    $allowed = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    foreach ($metadataPath in @($ServicesMetadataFile, $ScannerMetadataFile)) {
        $metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
        foreach ($property in $metadata.images.PSObject.Properties) {
            [void]$allowed.Add([string]$property.Value.local_tag)
        }
    }

    $composeArgs = @()
    if ($ComposeCommand.Count -gt 1) {
        $composeArgs += $ComposeCommand[1..($ComposeCommand.Count - 1)]
    }
    $composeArgs += "config"
    $composeOutput = & $ComposeCommand[0] @composeArgs
    if ($LASTEXITCODE -ne 0) {
        Fail "docker compose config failed"
    }

    $violations = [System.Collections.Generic.List[string]]::new()
    foreach ($line in @($composeOutput)) {
        if ($line -match '^\s*image:\s*(\S+)\s*$') {
            $imageRef = $matches[1].Trim()
            if (-not $allowed.Contains($imageRef)) {
                $violations.Add($imageRef)
            }
        }
    }

    if ($violations.Count -gt 0) {
        Fail ("compose images not covered by services/scanner bundles: " + ($violations -join ", "))
    }
}

function Resolve-DockerSocketPath {
    if ($env:DOCKER_SOCKET_PATH) {
        return $env:DOCKER_SOCKET_PATH
    }
    return "/var/run/docker.sock"
}

function Ensure-DockerSocketGid {
    if ($env:DOCKER_SOCKET_GID) {
        return $env:DOCKER_SOCKET_GID
    }

    $socketPath = Resolve-DockerSocketPath
    if (Test-Path -LiteralPath $socketPath) {
        try {
            $gid = (& wsl.exe sh -lc "stat -c %g '$socketPath'" 2>$null | Select-Object -Last 1)
            if ($gid) {
                $env:DOCKER_SOCKET_GID = ([string]$gid).Trim()
                return $env:DOCKER_SOCKET_GID
            }
        } catch {}
    }

    Fail "unable to determine DOCKER_SOCKET_GID automatically. Set DOCKER_SOCKET_GID explicitly before retrying."
}

function Parse-And-ExportOfflineEnv {
    $lineNo = 0
    foreach ($line in [System.IO.File]::ReadAllLines($OfflineEnvFile)) {
        $lineNo += 1
        $trimmed = $line.Trim()
        if (-not $trimmed) { continue }
        if ($trimmed.StartsWith("#")) { continue }
        if ($trimmed.StartsWith("export ")) {
            Fail "unsupported env syntax in ${OfflineEnvFile}:$lineNo"
        }
        if (-not $line.Contains("=")) {
            Fail "unsupported env syntax in ${OfflineEnvFile}:$lineNo"
        }

        $parts = $line -split '=', 2
        $name = $parts[0].Trim()
        $value = if ($parts.Count -gt 1) { $parts[1].TrimEnd("`r") } else { "" }

        if ($value.Contains('$(') -or $value.Contains('`')) {
            Fail "unsupported env syntax in ${OfflineEnvFile}:$lineNo"
        }
        if ($name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
            Fail "unsupported env key in ${OfflineEnvFile}:$lineNo"
        }

        Set-Item -Path "Env:$name" -Value $value
    }
}

if (-not (Test-Path -LiteralPath $ServicesMetadataFile)) {
    Fail "images manifest not found: $ServicesMetadataFile"
}
if (-not (Test-Path -LiteralPath $ScannerMetadataFile)) {
    Fail "images manifest not found: $ScannerMetadataFile"
}
if (-not $env:DOCKER_BIN -and -not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail "required command not found: docker"
}

$ComposeCommand = Detect-ComposeCommand
Ensure-TemplateCopy -Target $BackendEnvFile -Example $BackendEnvExample -Label "backend env file" -Warning "Review at least LLM_API_KEY, LLM_PROVIDER, and LLM_MODEL before relying on this deployment."
Ensure-TemplateCopy -Target $OfflineEnvFile -Example $OfflineEnvExample -Label "offline env file" -Warning "The generated offline env usually needs no edits unless you want custom image overrides."

$Arch = Get-DockerServerArchitecture
Log-Info "detected architecture: $Arch"
$ServicesBundlePath = Select-BundlePath -Bundle "services" -Arch $Arch
$ScannerBundlePath = Select-BundlePath -Bundle "scanner" -Arch $Arch
Require-ZstdIfNeeded -BundlePath $ServicesBundlePath
Require-ZstdIfNeeded -BundlePath $ScannerBundlePath

$env:DOCKER_SOCKET_PATH = Resolve-DockerSocketPath
$null = Ensure-DockerSocketGid
Log-Info "detected Docker socket path: $($env:DOCKER_SOCKET_PATH)"
Log-Info "detected Docker socket gid: $($env:DOCKER_SOCKET_GID)"

Load-Bundle -BundlePath $ServicesBundlePath
Load-Bundle -BundlePath $ScannerBundlePath
Ensure-ImagesReady
Parse-And-ExportOfflineEnv
Validate-ComposeImagesCoveredByBundles

Log-Info "starting docker compose up -d"
$command = $ComposeCommand[0]
$arguments = @()
if ($ComposeCommand.Count -gt 1) {
    $arguments += $ComposeCommand[1..($ComposeCommand.Count - 1)]
}
$arguments += @("up", "-d")

if ($command.ToLowerInvariant().EndsWith(".ps1")) {
    Push-Location $RootDir
    try {
        & $command @arguments
        if ($LASTEXITCODE -ne 0) {
            Fail "command failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
} else {
    $process = Start-Process -FilePath $command -ArgumentList $arguments -WorkingDirectory $RootDir -NoNewWindow -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        Fail "command failed with exit code $($process.ExitCode)"
    }
}

Log-Info "offline startup ready"
