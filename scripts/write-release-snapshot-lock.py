#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def _load_json(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SystemExit(f"required file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SystemExit(f"invalid JSON file: {path}: {exc}") from exc


def _require_dict(value: object, label: str) -> dict[str, object]:
    if not isinstance(value, dict):
        raise SystemExit(f"{label} must be an object")
    return value


def _require_str(value: object, label: str) -> str:
    if not isinstance(value, str):
        raise SystemExit(f"{label} must be a string")
    value = value.strip()
    if not value:
        raise SystemExit(f"{label} must not be empty")
    return value


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _load_bundle_contract(contract_path: Path) -> tuple[dict[str, object], dict[str, object]]:
    contract = _require_dict(_load_json(contract_path), "bundle contract")
    if contract.get("schema_version") != 1:
        raise SystemExit("unsupported bundle contract schema version")
    return (
        _require_dict(contract.get("bundles"), "bundle contract bundles"),
        _require_dict(contract.get("images"), "bundle contract images"),
    )


def _load_release_manifest(manifest_path: Path) -> tuple[dict[str, object], str]:
    manifest = _require_dict(_load_json(manifest_path), "release manifest")
    revision = _require_str(manifest.get("revision"), "release manifest revision")
    _require_dict(manifest.get("images"), "release manifest images")
    return manifest, revision


def _project_tree_images(
    *,
    bundle_name: str,
    logical_names: list[str],
    tree_metadata_images: dict[str, object],
) -> dict[str, dict[str, str]]:
    projected: dict[str, dict[str, str]] = {}
    for logical_name in logical_names:
        image_payload = _require_dict(
            tree_metadata_images.get(logical_name),
            f"{bundle_name} tree metadata image {logical_name}",
        )
        projected[logical_name] = {
            "source_ref": _require_str(
                image_payload.get("source_ref"),
                f"{bundle_name} tree metadata source_ref for {logical_name}",
            ),
            "local_tag": _require_str(
                image_payload.get("local_tag"),
                f"{bundle_name} tree metadata local_tag for {logical_name}",
            ),
        }
    return projected


def _build_bundle_entry(
    *,
    bundle_name: str,
    arch: str,
    bundle_contract: dict[str, object],
    tree_metadata: dict[str, object],
    asset_dir: Path,
    revision: str,
) -> dict[str, str]:
    logical_names = bundle_contract.get("images")
    if not isinstance(logical_names, list) or not logical_names:
        raise SystemExit(f"{bundle_name} bundle image list is required")

    asset_name = _require_str(
        bundle_contract.get("asset_name_template"),
        f"{bundle_name} asset name template",
    ).format(arch=arch)
    metadata_asset_name = _require_str(
        bundle_contract.get("metadata_asset_name_template"),
        f"{bundle_name} metadata asset name template",
    ).format(arch=arch)
    bundle_path = asset_dir / asset_name
    metadata_path = asset_dir / metadata_asset_name
    metadata = _require_dict(_load_json(metadata_path), f"{bundle_name}/{arch} metadata")

    metadata_revision = _require_str(
        metadata.get("revision"),
        f"{bundle_name}/{arch} metadata revision",
    )
    if metadata_revision != revision:
        raise SystemExit(
            f"revision mismatch for {bundle_name}/{arch}: expected {revision}, got {metadata_revision}"
        )

    bundle_file = _require_str(
        metadata.get("bundle_file"),
        f"{bundle_name}/{arch} metadata bundle_file",
    )
    if bundle_file != asset_name:
        raise SystemExit(
            f"non-canonical bundle filename for {bundle_name}/{arch}: expected {asset_name}, got {bundle_file}"
        )

    tree_images = _require_dict(
        tree_metadata.get("images"),
        f"{bundle_name} tree metadata images",
    )
    comparable_tree_images = _project_tree_images(
        bundle_name=bundle_name,
        logical_names=logical_names,
        tree_metadata_images=tree_images,
    )
    metadata_images = _require_dict(metadata.get("images"), f"{bundle_name}/{arch} metadata images")
    if metadata_images != comparable_tree_images:
        raise SystemExit(f"bundle membership mismatch for {bundle_name}/{arch}")

    tree_revision = _require_str(
        tree_metadata.get("revision"),
        f"{bundle_name} tree metadata revision",
    )
    if tree_revision != revision:
        raise SystemExit(f"revision mismatch for {bundle_name}: expected {revision}, got {tree_revision}")

    actual_bundle_sha256 = _sha256_file(bundle_path)
    metadata_bundle_sha256 = _require_str(
        metadata.get("bundle_sha256"),
        f"{bundle_name}/{arch} metadata bundle_sha256",
    ).lower()
    if metadata_bundle_sha256 != actual_bundle_sha256:
        raise SystemExit(
            f"bundle checksum mismatch for {bundle_name}/{arch}: expected {metadata_bundle_sha256}, got {actual_bundle_sha256}"
        )

    return {
        "asset_name": asset_name,
        "bundle_sha256": actual_bundle_sha256,
        "revision": revision,
        "metadata_asset_name": metadata_asset_name,
    }


def write_release_snapshot_lock(
    *,
    release_tree: Path,
    release_manifest: Path,
    asset_dir: Path,
    snapshot_tag: str,
) -> Path:
    root_dir = Path(__file__).resolve().parents[1]
    bundles, _images = _load_bundle_contract(root_dir / "scripts" / "release-bundle-contract.json")
    manifest, revision = _load_release_manifest(release_manifest)
    manifest_sha256 = _sha256_file(release_manifest)

    output_payload: dict[str, object] = {
        "schema_version": 1,
        "source_sha": revision,
        "snapshot_tag": snapshot_tag,
        "release_manifest_sha256": manifest_sha256,
        "bundles": {},
    }

    for bundle_name, bundle_contract_raw in bundles.items():
        bundle_contract = _require_dict(bundle_contract_raw, f"{bundle_name} bundle contract")
        tree_metadata_filename = _require_str(
            bundle_contract.get("tree_metadata_filename"),
            f"{bundle_name} tree metadata filename",
        )
        tree_metadata = _require_dict(
            _load_json(release_tree / tree_metadata_filename),
            f"{bundle_name} tree metadata",
        )
        output_payload["bundles"][bundle_name] = {}
        for arch in ("amd64", "arm64"):
            output_payload["bundles"][bundle_name][arch] = _build_bundle_entry(
                bundle_name=bundle_name,
                arch=arch,
                bundle_contract=bundle_contract,
                tree_metadata=tree_metadata,
                asset_dir=asset_dir,
                revision=revision,
            )

    output_path = release_tree / "release-snapshot-lock.json"
    output_path.write_text(json.dumps(output_payload, indent=2) + "\n", encoding="utf-8")
    return output_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate snapshot assets and write release-snapshot-lock.json")
    parser.add_argument("--release-tree", required=True, type=Path)
    parser.add_argument("--release-manifest", required=True, type=Path)
    parser.add_argument("--asset-dir", required=True, type=Path)
    parser.add_argument("--snapshot-tag", required=True)
    args = parser.parse_args()

    write_release_snapshot_lock(
        release_tree=args.release_tree,
        release_manifest=args.release_manifest,
        asset_dir=args.asset_dir,
        snapshot_tag=args.snapshot_tag,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
