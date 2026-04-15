#!/usr/bin/env bash

set -euo pipefail

cat >&2 <<'MSG'
[deploy-release] Deprecated: legacy source-oriented release deployment has been removed.
[deploy-release]
[deploy-release] This script used to unpack source tarballs and local-build compose overlays.
[deploy-release] The formal release contract is now the generated image-only release tree.
[deploy-release]
[deploy-release] Deploy from the generated release tree directly:
[deploy-release]   Online:
[deploy-release]     cp docker/env/backend/env.example docker/env/backend/.env
[deploy-release]     docker compose up -d
[deploy-release]
[deploy-release]   Offline:
[deploy-release]     bash ./scripts/offline-up.sh
[deploy-release]     # Or on Windows PowerShell:
[deploy-release]     powershell -ExecutionPolicy Bypass -File .\scripts\offline-up.ps1
[deploy-release]
[deploy-release] If you still depend on the old source tarball flow, migrate that automation before the next release cut.
MSG

exit 1
