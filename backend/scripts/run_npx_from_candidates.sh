#!/bin/sh
set -eu

PACKAGE_NAME="${1:?package name required}"
shift

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
CANDIDATES="${NPM_REGISTRY_CANDIDATES:-https://registry.npmmirror.com,https://mirrors.cloud.tencent.com/npm,https://registry.npmjs.org}"
TIMEOUT_SECONDS="${NPM_REGISTRY_PROBE_TIMEOUT_SECONDS:-2}"

ORDERED_CANDIDATES="$({ python3 "${SCRIPT_DIR}/package_source_selector.py" --candidates "${CANDIDATES}" --kind npm --timeout-seconds "${TIMEOUT_SECONDS}"; } 2>/dev/null || printf '%s\n' "${CANDIDATES}" | tr ',' '\n')"

for registry in ${ORDERED_CANDIDATES}; do
    [ -n "${registry}" ] || continue
    echo "npx fallback ${PACKAGE_NAME} via ${registry}" >&2
    if npx --yes --registry "${registry}" "${PACKAGE_NAME}" "$@"; then
        exit 0
    fi
done

echo "npx fallback failed for ${PACKAGE_NAME}" >&2
exit 1
