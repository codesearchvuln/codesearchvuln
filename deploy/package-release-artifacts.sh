#!/usr/bin/env bash

set -euo pipefail

cat >&2 <<'MSG'
[package-release] Deprecated: source/build-oriented release packaging has been removed.
[package-release]
[package-release] This legacy entrypoint no longer produces backend/frontend source tarballs,
[package-release] docker build overlays, or source-first release bundles.
[package-release]
[package-release] Use the image-only release contract instead:
[package-release]   1. Generate the release tree
[package-release]      ./scripts/generate-release-branch.sh --output <dir> --image-manifest <manifest> --validate
[package-release]   2. Optional offline image bundles
[package-release]      ./scripts/package-release-images.sh --image-manifest <manifest> --output-dir <dir>/images
[package-release]
[package-release] Ship the generated release tree and, if needed, vulhunter-images-<arch>.tar.zst bundles.
MSG

exit 1
