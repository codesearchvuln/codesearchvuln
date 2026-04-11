import logging
from pathlib import Path

from app.core.logging_setup import configure_backend_file_logging


def _matching_handlers(logger: logging.Logger, log_file: Path) -> list[logging.FileHandler]:
    target = str(log_file.resolve())
    matches: list[logging.FileHandler] = []
    for handler in logger.handlers:
        if not isinstance(handler, logging.FileHandler):
            continue
        if str(Path(getattr(handler, "baseFilename", "")).resolve()) == target:
            matches.append(handler)
    return matches


def _remove_matching_handlers(logger: logging.Logger, log_file: Path) -> None:
    for handler in _matching_handlers(logger, log_file):
        logger.removeHandler(handler)
        handler.close()


def test_configure_backend_file_logging_writes_root_and_uvicorn_logs(tmp_path):
    log_dir = tmp_path / "log"
    log_file = log_dir / "backend.log"
    root_logger = logging.getLogger()
    uvicorn_logger = logging.getLogger("uvicorn")

    try:
        resolved = configure_backend_file_logging(log_dir=log_dir)
        assert resolved == log_file

        root_logger.info("root log entry for file sink")
        uvicorn_logger.info("uvicorn log entry for file sink")

        for handler in _matching_handlers(root_logger, log_file):
            handler.flush()
        for handler in _matching_handlers(uvicorn_logger, log_file):
            handler.flush()

        content = log_file.read_text(encoding="utf-8")
        assert "root log entry for file sink" in content
        assert "uvicorn log entry for file sink" in content
    finally:
        _remove_matching_handlers(root_logger, log_file)
        _remove_matching_handlers(uvicorn_logger, log_file)


def test_configure_backend_file_logging_is_idempotent(tmp_path):
    log_dir = tmp_path / "log"
    log_file = log_dir / "backend.log"
    root_logger = logging.getLogger()
    uvicorn_logger = logging.getLogger("uvicorn")

    try:
        configure_backend_file_logging(log_dir=log_dir)
        configure_backend_file_logging(log_dir=log_dir)

        assert len(_matching_handlers(root_logger, log_file)) == 1
        assert len(_matching_handlers(uvicorn_logger, log_file)) == 1
    finally:
        _remove_matching_handlers(root_logger, log_file)
        _remove_matching_handlers(uvicorn_logger, log_file)
