#!/usr/bin/env python3

from __future__ import annotations

import argparse
import concurrent.futures
import json
import subprocess
import sys
from pathlib import Path


class DownloadReleaseAssetsError(RuntimeError):
    pass


def _load_json(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise DownloadReleaseAssetsError(f"required file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise DownloadReleaseAssetsError(f"invalid JSON file: {path}: {exc}") from exc


def _require_dict(value: object, label: str) -> dict[str, object]:
    if not isinstance(value, dict):
        raise DownloadReleaseAssetsError(f"{label} must be an object")
    return value


def _require_str(value: object, label: str) -> str:
    if not isinstance(value, str):
        raise DownloadReleaseAssetsError(f"{label} must be a string")
    value = value.strip()
    if not value:
        raise DownloadReleaseAssetsError(f"{label} must not be empty")
    return value


def required_asset_names(contract_path: Path) -> list[str]:
    contract = _require_dict(_load_json(contract_path), "bundle contract")
    bundles = _require_dict(contract.get("bundles"), "bundle contract bundles")

    asset_names: list[str] = []
    seen_names: set[str] = set()

    for bundle_name, bundle_raw in bundles.items():
        bundle = _require_dict(bundle_raw, f"{bundle_name} bundle contract")
        asset_template = _require_str(
            bundle.get("asset_name_template"),
            f"{bundle_name} bundle asset_name_template",
        )
        metadata_template = _require_str(
            bundle.get("metadata_asset_name_template"),
            f"{bundle_name} bundle metadata_asset_name_template",
        )
        for arch in ("amd64", "arm64"):
            for template in (asset_template, metadata_template):
                name = template.format(arch=arch)
                if name in seen_names:
                    raise DownloadReleaseAssetsError(f"duplicate asset name in bundle contract: {name}")
                seen_names.add(name)
                asset_names.append(name)

    return asset_names


def _run_gh_json(endpoint: str) -> object:
    result = subprocess.run(
        ["gh", "api", endpoint],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        stderr = result.stderr.strip() or result.stdout.strip() or "gh api request failed"
        raise DownloadReleaseAssetsError(f"gh api {endpoint}: {stderr}")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise DownloadReleaseAssetsError(f"gh api {endpoint} returned invalid JSON: {exc}") from exc


def _coerce_asset_id(value: object, label: str) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    raise DownloadReleaseAssetsError(f"{label} must be an integer")


def _release_diagnostics(
    *,
    repo: str,
    release_id: int,
    expected_tag: str,
    actual_tag: str,
    draft: bool | None,
    available_names: list[str],
    missing_names: list[str],
    duplicate_names: list[str],
    unexpected_names: list[str],
) -> str:
    def _render(values: list[str]) -> str:
        return ", ".join(values) if values else "(none)"

    return "\n".join(
        [
            f"[release-assets] repo={repo}",
            f"[release-assets] release_id={release_id}",
            f"[release-assets] expected_tag={expected_tag}",
            f"[release-assets] actual_tag={actual_tag or '(none)'}",
            f"[release-assets] draft={draft if draft is not None else '(unknown)'}",
            f"[release-assets] available={_render(available_names)}",
            f"[release-assets] missing={_render(missing_names)}",
            f"[release-assets] duplicates={_render(duplicate_names)}",
            f"[release-assets] unexpected={_render(unexpected_names)}",
        ]
    )


def inspect_release(
    *,
    repo: str,
    release_id: int,
    tag: str,
    contract_path: Path,
) -> tuple[dict[str, object], list[str], dict[str, dict[str, object]]]:
    expected_names = required_asset_names(contract_path)
    release = _require_dict(
        _run_gh_json(f"repos/{repo}/releases/{release_id}"),
        "release response",
    )
    actual_tag = _require_str(release.get("tag_name"), "release tag_name")
    draft = release.get("draft")
    if not isinstance(draft, bool):
        raise DownloadReleaseAssetsError("release draft flag must be boolean")

    assets_raw = release.get("assets")
    if not isinstance(assets_raw, list):
        raise DownloadReleaseAssetsError("release assets must be an array")

    available_names: list[str] = []
    assets_by_name: dict[str, list[dict[str, object]]] = {}
    for index, asset_raw in enumerate(assets_raw):
        asset = _require_dict(asset_raw, f"release asset #{index}")
        asset_name = _require_str(asset.get("name"), f"release asset #{index} name")
        asset_id = _coerce_asset_id(asset.get("id"), f"release asset #{index} id")
        available_names.append(asset_name)
        assets_by_name.setdefault(asset_name, []).append({"id": asset_id, "name": asset_name})

    expected_name_set = set(expected_names)
    missing_names = [name for name in expected_names if name not in assets_by_name]
    duplicate_names = sorted(name for name, entries in assets_by_name.items() if len(entries) > 1)
    unexpected_names = sorted(name for name in available_names if name not in expected_name_set)

    diagnostics = _release_diagnostics(
        repo=repo,
        release_id=release_id,
        expected_tag=tag,
        actual_tag=actual_tag,
        draft=draft,
        available_names=sorted(available_names),
        missing_names=missing_names,
        duplicate_names=duplicate_names,
        unexpected_names=unexpected_names,
    )

    if actual_tag != tag:
        raise DownloadReleaseAssetsError(f"snapshot release tag mismatch\n{diagnostics}")
    if not draft:
        raise DownloadReleaseAssetsError(f"snapshot release is not draft\n{diagnostics}")
    if missing_names or duplicate_names:
        raise DownloadReleaseAssetsError(f"snapshot release assets are incomplete\n{diagnostics}")

    resolved_assets = {name: assets_by_name[name][0] for name in expected_names}
    return release, expected_names, resolved_assets


def _download_asset(repo: str, asset_id: int, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("wb") as handle:
        result = subprocess.run(
            [
                "gh",
                "api",
                "-H",
                "Accept: application/octet-stream",
                f"repos/{repo}/releases/assets/{asset_id}",
            ],
            stdout=handle,
            stderr=subprocess.PIPE,
        )
    if result.returncode != 0:
        output_path.unlink(missing_ok=True)
        stderr = result.stderr.decode("utf-8", errors="replace").strip() or "asset download failed"
        raise DownloadReleaseAssetsError(f"failed to download release asset {asset_id}: {stderr}")


def download_release_assets(
    *,
    repo: str,
    release_id: int,
    tag: str,
    output_dir: Path,
    contract_path: Path,
    max_workers: int = 4,
) -> list[Path]:
    _release, expected_names, assets = inspect_release(
        repo=repo,
        release_id=release_id,
        tag=tag,
        contract_path=contract_path,
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    if max_workers < 1:
        raise DownloadReleaseAssetsError("--max-workers must be >= 1")
    effective_workers = min(max_workers, len(expected_names)) or 1

    downloaded_paths: list[Path] = []
    if effective_workers == 1:
        for name in expected_names:
            asset_id = _coerce_asset_id(assets[name]["id"], f"{name} asset id")
            output_path = output_dir / name
            _download_asset(repo, asset_id, output_path)
            downloaded_paths.append(output_path)
        return downloaded_paths

    def _worker(name: str) -> Path:
        asset_id = _coerce_asset_id(assets[name]["id"], f"{name} asset id")
        output_path = output_dir / name
        _download_asset(repo, asset_id, output_path)
        return output_path

    with concurrent.futures.ThreadPoolExecutor(max_workers=effective_workers) as executor:
        future_to_name = {executor.submit(_worker, name): name for name in expected_names}
        results: dict[str, Path] = {}
        try:
            for future in concurrent.futures.as_completed(future_to_name):
                name = future_to_name[future]
                results[name] = future.result()
        except BaseException:
            for pending in future_to_name:
                pending.cancel()
            raise

    downloaded_paths = [results[name] for name in expected_names]
    return downloaded_paths


def main() -> int:
    parser = argparse.ArgumentParser(description="Download draft release assets by release id")
    parser.add_argument("--repo", required=True, help="owner/repo")
    parser.add_argument("--release-id", required=True, type=int)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument(
        "--contract",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "scripts" / "release-bundle-contract.json",
    )
    parser.add_argument(
        "--max-workers",
        type=int,
        default=4,
        help="Parallel download workers (1-16, default 4).",
    )
    args = parser.parse_args()

    if not 1 <= args.max_workers <= 16:
        print("--max-workers must be between 1 and 16", file=sys.stderr)
        return 2

    try:
        downloaded = download_release_assets(
            repo=args.repo.strip(),
            release_id=args.release_id,
            tag=args.tag.strip(),
            output_dir=args.output_dir,
            contract_path=args.contract,
            max_workers=args.max_workers,
        )
    except DownloadReleaseAssetsError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(f"[release-assets] downloaded {len(downloaded)} assets into {args.output_dir}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
