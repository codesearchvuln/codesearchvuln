import logging
from collections.abc import Iterable
from pathlib import Path

BACKEND_LOG_FILENAME = "backend.log"
BACKEND_LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
EXTRA_FILE_LOGGER_NAMES = ("uvicorn",)


def get_backend_log_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "log"


def _has_file_handler(logger: logging.Logger, log_file: Path) -> bool:
    target = str(log_file.resolve())
    for handler in logger.handlers:
        if not isinstance(handler, logging.FileHandler):
            continue
        if str(Path(getattr(handler, "baseFilename", "")).resolve()) == target:
            return True
    return False


def _attach_file_handler(
    logger: logging.Logger,
    *,
    log_file: Path,
    level: int,
    formatter: logging.Formatter,
) -> None:
    if _has_file_handler(logger, log_file):
        return

    handler = logging.FileHandler(
        log_file,
        encoding="utf-8",
        delay=True,
    )
    handler.setLevel(level)
    handler.setFormatter(formatter)
    logger.addHandler(handler)


def configure_backend_file_logging(
    *,
    level: int = logging.INFO,
    log_dir: Path | None = None,
    filename: str = BACKEND_LOG_FILENAME,
    extra_logger_names: Iterable[str] = EXTRA_FILE_LOGGER_NAMES,
) -> Path:
    resolved_log_dir = Path(log_dir) if log_dir is not None else get_backend_log_dir()
    resolved_log_dir.mkdir(parents=True, exist_ok=True)
    log_file = resolved_log_dir / filename
    formatter = logging.Formatter(BACKEND_LOG_FORMAT)

    root_logger = logging.getLogger()
    if root_logger.level == logging.NOTSET or root_logger.level > level:
        root_logger.setLevel(level)
    _attach_file_handler(root_logger, log_file=log_file, level=level, formatter=formatter)

    for logger_name in extra_logger_names:
        target_logger = logging.getLogger(logger_name)
        if target_logger.level == logging.NOTSET or target_logger.level > level:
            target_logger.setLevel(level)
        _attach_file_handler(
            target_logger,
            log_file=log_file,
            level=level,
            formatter=formatter,
        )

    return log_file
