import os
import subprocess
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _run_backend_python(code: str) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    existing_pythonpath = env.get("PYTHONPATH")
    env["PYTHONPATH"] = (
        f"{BACKEND_ROOT}{os.pathsep}{existing_pythonpath}"
        if existing_pythonpath
        else str(BACKEND_ROOT)
    )
    return subprocess.run(
        [sys.executable, "-c", code],
        cwd=BACKEND_ROOT,
        env=env,
        capture_output=True,
        text=True,
    )


def test_password_hashing_does_not_log_bcrypt_version_warning():
    result = _run_backend_python(
        "from app.core.security import get_password_hash, verify_password; "
        "hashed = get_password_hash('secret'); "
        "assert verify_password('secret', hashed)"
    )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode == 0, combined_output
    assert "error reading bcrypt version" not in combined_output, combined_output


def test_scan_endpoint_compiles_without_syntax_warnings():
    result = subprocess.run(
        [
            sys.executable,
            "-W",
            "error::SyntaxWarning",
            "-m",
            "py_compile",
            str(BACKEND_ROOT / "app/api/v1/endpoints/scan.py"),
        ],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )

    combined_output = "\n".join(part for part in [result.stdout, result.stderr] if part)
    assert result.returncode == 0, combined_output
