from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = REPO_ROOT / "scripts" / "download-release-assets.py"
CONTRACT_PATH = REPO_ROOT / "scripts" / "release-bundle-contract.json"


def _load_module():
    spec = importlib.util.spec_from_file_location("download_release_assets_script", SCRIPT_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _release_payload(tag: str, asset_names: list[str], *, draft: bool = True) -> dict[str, object]:
    assets = [{"id": index + 1000, "name": name} for index, name in enumerate(asset_names)]
    return {
        "id": 4242,
        "tag_name": tag,
        "draft": draft,
        "html_url": f"https://github.com/example/repo/releases/tag/{tag}",
        "assets": assets,
    }


def test_required_asset_names_are_derived_from_contract_templates(tmp_path: Path) -> None:
    module = _load_module()
    contract_path = tmp_path / "contract.json"
    contract_path.write_text(
        """
        {
          "schema_version": 1,
          "bundles": {
            "services": {
              "asset_name_template": "svc-{arch}.bin",
              "metadata_asset_name_template": "svc-{arch}.meta.json"
            },
            "scanner": {
              "asset_name_template": "scan-{arch}.blob",
              "metadata_asset_name_template": "scan-{arch}.meta.json"
            }
          },
          "images": {}
        }
        """,
        encoding="utf-8",
    )

    names = module.required_asset_names(contract_path)

    assert names == [
        "svc-amd64.bin",
        "svc-amd64.meta.json",
        "svc-arm64.bin",
        "svc-arm64.meta.json",
        "scan-amd64.blob",
        "scan-amd64.meta.json",
        "scan-arm64.blob",
        "scan-arm64.meta.json",
    ]


def test_inspect_release_accepts_draft_release_with_expected_assets_and_extra_assets(monkeypatch) -> None:
    module = _load_module()
    expected_names = module.required_asset_names(CONTRACT_PATH)
    release = _release_payload("release-assets-demo", expected_names + ["extra.txt"], draft=True)
    monkeypatch.setattr(module, "_run_gh_json", lambda endpoint: release)

    payload, names, assets = module.inspect_release(
        repo="owner/repo",
        release_id=4242,
        tag="release-assets-demo",
        contract_path=CONTRACT_PATH,
    )

    assert payload["draft"] is True
    assert names == expected_names
    assert list(assets.keys()) == expected_names
    assert assets[expected_names[0]]["name"] == expected_names[0]


def test_inspect_release_rejects_tag_mismatch(monkeypatch) -> None:
    module = _load_module()
    expected_names = module.required_asset_names(CONTRACT_PATH)
    monkeypatch.setattr(module, "_run_gh_json", lambda endpoint: _release_payload("wrong-tag", expected_names))

    with pytest.raises(module.DownloadReleaseAssetsError) as exc_info:
        module.inspect_release(
            repo="owner/repo",
            release_id=4242,
            tag="release-assets-demo",
            contract_path=CONTRACT_PATH,
        )

    message = str(exc_info.value)
    assert "snapshot release tag mismatch" in message
    assert "expected_tag=release-assets-demo" in message
    assert "actual_tag=wrong-tag" in message


def test_inspect_release_rejects_non_draft_release(monkeypatch) -> None:
    module = _load_module()
    expected_names = module.required_asset_names(CONTRACT_PATH)
    monkeypatch.setattr(
        module,
        "_run_gh_json",
        lambda endpoint: _release_payload("release-assets-demo", expected_names, draft=False),
    )

    with pytest.raises(module.DownloadReleaseAssetsError) as exc_info:
        module.inspect_release(
            repo="owner/repo",
            release_id=4242,
            tag="release-assets-demo",
            contract_path=CONTRACT_PATH,
        )

    message = str(exc_info.value)
    assert "snapshot release is not draft" in message
    assert "draft=False" in message


def test_inspect_release_reports_missing_assets(monkeypatch) -> None:
    module = _load_module()
    expected_names = module.required_asset_names(CONTRACT_PATH)
    missing_name = expected_names[-1]
    monkeypatch.setattr(
        module,
        "_run_gh_json",
        lambda endpoint: _release_payload("release-assets-demo", expected_names[:-1]),
    )

    with pytest.raises(module.DownloadReleaseAssetsError) as exc_info:
        module.inspect_release(
            repo="owner/repo",
            release_id=4242,
            tag="release-assets-demo",
            contract_path=CONTRACT_PATH,
        )

    message = str(exc_info.value)
    assert "snapshot release assets are incomplete" in message
    assert f"missing={missing_name}" in message


def test_inspect_release_reports_duplicate_assets(monkeypatch) -> None:
    module = _load_module()
    expected_names = module.required_asset_names(CONTRACT_PATH)
    duplicate_name = expected_names[0]
    release = _release_payload("release-assets-demo", expected_names)
    release["assets"] = release["assets"] + [{"id": 9999, "name": duplicate_name}]
    monkeypatch.setattr(module, "_run_gh_json", lambda endpoint: release)

    with pytest.raises(module.DownloadReleaseAssetsError) as exc_info:
        module.inspect_release(
            repo="owner/repo",
            release_id=4242,
            tag="release-assets-demo",
            contract_path=CONTRACT_PATH,
        )

    message = str(exc_info.value)
    assert "snapshot release assets are incomplete" in message
    assert f"duplicates={duplicate_name}" in message


def test_download_release_assets_downloads_each_expected_asset(monkeypatch, tmp_path: Path) -> None:
    module = _load_module()
    expected_names = ["asset-a.bin", "asset-b.bin"]

    monkeypatch.setattr(
        module,
        "inspect_release",
        lambda **kwargs: (
            {"id": 4242, "tag_name": "release-assets-demo", "draft": True},
            expected_names,
            {
                "asset-a.bin": {"id": 11, "name": "asset-a.bin"},
                "asset-b.bin": {"id": 12, "name": "asset-b.bin"},
            },
        ),
    )

    downloaded_ids: list[int] = []

    def _fake_download(repo: str, asset_id: int, output_path: Path) -> None:
        downloaded_ids.append(asset_id)
        output_path.write_text(f"{repo}:{asset_id}", encoding="utf-8")

    monkeypatch.setattr(module, "_download_asset", _fake_download)

    output_dir = tmp_path / "assets"
    downloaded = module.download_release_assets(
        repo="owner/repo",
        release_id=4242,
        tag="release-assets-demo",
        output_dir=output_dir,
        contract_path=CONTRACT_PATH,
    )

    assert [path.name for path in downloaded] == expected_names
    assert downloaded_ids == [11, 12]
    assert (output_dir / "asset-a.bin").read_text(encoding="utf-8") == "owner/repo:11"
    assert (output_dir / "asset-b.bin").read_text(encoding="utf-8") == "owner/repo:12"
