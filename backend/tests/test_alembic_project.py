import os
import subprocess
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _alembic_command() -> list[str]:
    venv_alembic = BACKEND_ROOT / ".venv" / "bin" / "alembic"
    if venv_alembic.exists():
        return [str(venv_alembic)]
    return [sys.executable, "-m", "alembic"]


def test_alembic_history_runs_from_backend_root():
    env = os.environ.copy()
    existing_pythonpath = env.get("PYTHONPATH")
    env["PYTHONPATH"] = (
        f"{BACKEND_ROOT}{os.pathsep}{existing_pythonpath}"
        if existing_pythonpath
        else str(BACKEND_ROOT)
    )

    result = subprocess.run(
        [*_alembic_command(), "history"],
        cwd=BACKEND_ROOT,
        env=env,
        capture_output=True,
        text=True,
    )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode == 0, combined_output


def test_alembic_has_a_single_head_revision():
    env = os.environ.copy()
    existing_pythonpath = env.get("PYTHONPATH")
    env["PYTHONPATH"] = (
        f"{BACKEND_ROOT}{os.pathsep}{existing_pythonpath}"
        if existing_pythonpath
        else str(BACKEND_ROOT)
    )

    result = subprocess.run(
        [*_alembic_command(), "heads"],
        cwd=BACKEND_ROOT,
        env=env,
        capture_output=True,
        text=True,
    )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode == 0, combined_output

    head_lines = [
        line.strip()
        for line in result.stdout.splitlines()
        if line.strip() and "(head)" in line
    ]
    assert len(head_lines) == 1, f"Expected a single Alembic head, got {len(head_lines)}: {head_lines}"
