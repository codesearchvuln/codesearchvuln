import io
import sys
import tarfile
import zipfile
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.services.upload.compression_handlers import RarCompressionStrategy
from app.services.upload.compression_factory import CompressionStrategyFactory
from app.services.upload.upload_manager import UploadManager


@pytest.mark.asyncio
async def test_upload_manager_with_generated_zip(tmp_path: Path):
    test_file = tmp_path / "fastjson.zip"
    with zipfile.ZipFile(test_file, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("fastjson/src/main/java/com/example/App.java", "class App {}\n")

    is_valid, error = UploadManager.validate_file(test_file)
    assert is_valid is True
    assert error is None

    success, files, error = UploadManager.get_file_list_preview(test_file)
    assert success is True
    assert error is None
    assert any(item["path"].endswith("App.java") for item in files)

    extract_dir = tmp_path / "extracted"
    success, file_list, error = await UploadManager.extract_file(test_file, str(extract_dir))
    assert success is True
    assert error is None
    assert any(path.endswith("App.java") for path in file_list)
    assert (extract_dir / "fastjson/src/main/java/com/example/App.java").exists()

    formats = CompressionStrategyFactory.get_supported_formats()
    assert ".zip" in formats


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("archive_name", "mode"),
    [
        ("sample.tar", "w"),
        ("sample.tar.gz", "w:gz"),
        ("sample.tar.bz2", "w:bz2"),
    ],
)
async def test_upload_manager_extracts_tar_variants(
    tmp_path: Path,
    archive_name: str,
    mode: str,
):
    archive_path = tmp_path / archive_name
    with tarfile.open(archive_path, mode) as tar_ref:
        payload = b"print('ok')\n"
        info = tarfile.TarInfo(name="sample/src/app.py")
        info.size = len(payload)
        tar_ref.addfile(info, io.BytesIO(payload))

    is_valid, error = UploadManager.validate_file(str(archive_path))
    assert is_valid is True
    assert error is None

    extract_dir = tmp_path / "extract"
    success, file_list, error = await UploadManager.extract_file(
        str(archive_path),
        str(extract_dir),
    )
    assert success is True
    assert error is None
    assert any(path.endswith("sample/src/app.py") for path in file_list)
    assert (extract_dir / "sample/src/app.py").exists()


def test_upload_manager_preview_reports_remaining_count(tmp_path: Path):
    test_file = tmp_path / "many.zip"
    with zipfile.ZipFile(test_file, "w", zipfile.ZIP_DEFLATED) as zf:
        for idx in range(5):
            zf.writestr(f"src/file_{idx}.txt", "x\n")

    success, file_list, error = UploadManager.get_file_list_preview(test_file, limit=2)
    assert success is True
    assert error is None
    assert file_list[-1]["path"] == "... 还有 3 个文件"


def test_upload_manager_validate_file_uses_detailed_strategy_error(tmp_path: Path, monkeypatch):
    archive_path = tmp_path / "sample.rar"
    archive_path.write_bytes(b"rar")

    monkeypatch.setattr(
        CompressionStrategyFactory,
        "get_strategy",
        lambda _path: SimpleNamespace(
            validate_with_error=lambda _file_path: (
                False,
                "RAR 验证失败：缺少系统解压工具，请在运行环境安装以下任一工具：unrar, unar, 7z, 7zz, bsdtar",
            )
        ),
    )
    monkeypatch.setattr(
        CompressionStrategyFactory,
        "is_supported",
        lambda _path: True,
    )

    is_valid, error = UploadManager.validate_file(str(archive_path))

    assert is_valid is False
    assert error == (
        "RAR 验证失败：缺少系统解压工具，请在运行环境安装以下任一工具："
        "unrar, unar, 7z, 7zz, bsdtar"
    )


def test_rar_strategy_validate_reports_missing_backend_tool(tmp_path: Path, monkeypatch):
    archive_path = tmp_path / "sample.rar"
    archive_path.write_bytes(b"not-a-real-rar")

    strategy = RarCompressionStrategy()

    class DummyRarCannotExec(Exception):
        pass

    class DummyRarFile:
        def __init__(self, *_args, **_kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def testrar(self):
            raise DummyRarCannotExec("Cannot find working tool")

    fake_rarfile = SimpleNamespace(
        RarFile=DummyRarFile,
        RarCannotExec=DummyRarCannotExec,
        PasswordRequired=type("PasswordRequired", (Exception,), {}),
        RarWrongPassword=type("RarWrongPassword", (Exception,), {}),
        NeedFirstVolume=type("NeedFirstVolume", (Exception,), {}),
        RarCRCError=type("RarCRCError", (Exception,), {}),
        BadRarFile=type("BadRarFile", (Exception,), {}),
        NotRarFile=type("NotRarFile", (Exception,), {}),
    )
    monkeypatch.setitem(sys.modules, "rarfile", fake_rarfile)

    is_valid, error = strategy.validate_with_error(str(archive_path))

    assert is_valid is False
    assert error == (
        "RAR 验证失败：缺少系统解压工具，请在运行环境安装以下任一工具："
        "unrar, unar, 7z, 7zz, bsdtar"
    )
