#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CommandArgs
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$OfflineEnvFile = if ($env:OFFLINE_ENV_FILE) {
    $env:OFFLINE_ENV_FILE
} else {
    Join-Path $RootDir "docker/env/backend/offline-images.env"
}

function Fail {
    param([string]$Message)
    [Console]::Error.WriteLine("[offline-env] $Message")
    exit 1
}

function Detect-ComposeCommand {
    try {
        $null = docker compose version 2>&1
        if ($LASTEXITCODE -eq 0) {
            return @("docker", "compose")
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

if (-not (Test-Path -LiteralPath $OfflineEnvFile)) {
    [Console]::Error.WriteLine("[offline-env] missing offline env file: $OfflineEnvFile")
    [Console]::Error.WriteLine("[offline-env] copy docker/env/backend/offline-images.env.example to docker/env/backend/offline-images.env first.")
    exit 1
}

foreach ($line in Get-Content -LiteralPath $OfflineEnvFile) {
    $trimmed = $line.Trim()
    if (-not $trimmed) { continue }
    if ($trimmed.StartsWith("#")) { continue }
    if (-not $trimmed.Contains("=")) { continue }

    $parts = $trimmed -split '=', 2
    $name = $parts[0].Trim()
    $value = if ($parts.Count -gt 1) { $parts[1] } else { "" }
    if (-not $name) { continue }
    Set-Item -Path "Env:$name" -Value $value
}

# Default command when no arguments are provided: docker compose up -d
if (-not $CommandArgs -or $CommandArgs.Count -eq 0) {
    $CommandArgs = Detect-ComposeCommand
    $CommandArgs += @("up", "-d")
}

$command = $CommandArgs[0]
$arguments = @()
if ($CommandArgs.Count -gt 1) {
    $arguments = $CommandArgs[1..($CommandArgs.Count - 1)]
}

$process = Start-Process -FilePath $command -ArgumentList $arguments -WorkingDirectory $RootDir -NoNewWindow -Wait -PassThru
if ($process.ExitCode -ne 0) {
    Fail "command failed with exit code $($process.ExitCode)"
}
