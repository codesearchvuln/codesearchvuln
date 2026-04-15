"""
Cython 编译脚本 - 将 backend/app/ 下可编译的 Python 模块编译为 .so 扩展

默认策略：排除法（排除已知不可编译的文件，其余全量编译）

使用方式：
    cd /build
    python cython_build/setup.py build_ext --build-lib /build/compiled --build-temp /build/tmp
"""

import fnmatch
import os
from pathlib import Path

from Cython.Build import cythonize
from Cython.Compiler import Options
from setuptools import Extension, setup

# ── 编译器全局选项 ──────────────────────────────────────────
Options.docstrings = False   # 剥除 docstring，减小 .so 体积
Options.annotate = False     # 不生成 HTML 注解文件

BUILD_DIR = Path(__file__).resolve().parent
APP_DIR = BUILD_DIR.parent / "app"
EXCLUSION_LIST_FILE = BUILD_DIR / "exclusion_list.txt"


def _load_patterns(pattern_file: Path) -> list[str]:
    if not pattern_file.exists():
        return []
    patterns: list[str] = []
    for raw_line in pattern_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.split("#", 1)[0].strip()
        if line:
            patterns.append(line)
    return patterns


EXCLUDE_PATTERNS = _load_patterns(EXCLUSION_LIST_FILE)


def _resolve_cython_nthreads() -> int:
    raw = os.environ.get("CYTHON_NTHREADS", "").strip()
    if raw:
        try:
            parsed = int(raw)
        except ValueError:
            parsed = 0
        if parsed > 0:
            return parsed
    return os.cpu_count() or 4


def _matches_pattern(rel_path: str, pattern: str) -> bool:
    basename = Path(rel_path).name
    if fnmatch.fnmatch(rel_path, pattern):
        return True
    if "/" not in pattern and fnmatch.fnmatch(basename, pattern):
        return True
    return False


def should_exclude(rel_path: str) -> bool:
    """判断文件是否应排除编译（相对于 app/ 的路径）"""
    for pattern in EXCLUDE_PATTERNS:
        if _matches_pattern(rel_path, pattern):
            return True
    return False


def collect_extensions() -> list[Extension]:
    """收集所有待编译的 Extension（显式模块名，兼容 namespace package 目录）"""
    all_py = sorted(APP_DIR.rglob("*.py"))
    result: list[Extension] = []
    excluded = []

    for f in all_py:
        rel = str(f.relative_to(APP_DIR))
        if should_exclude(rel):
            excluded.append(rel)
        else:
            module_name = f"app.{Path(rel).with_suffix('').as_posix().replace('/', '.')}"
            result.append(Extension(module_name, [str(f)]))

    print(
        f"[Cython] 模式: full-exclusion, 待编译模块数: {len(result)}, "
        f"排除模块数: {len(excluded)}"
    )
    if excluded:
        print("[Cython] 排除列表（前20条）:")
        for e in excluded[:20]:
            print(f"  - {e}")
    return result


ext_modules = cythonize(
    collect_extensions(),
    compiler_directives={
        "language_level": "3",
        "embedsignature": False,     # 不在 .so 中嵌入 docstring 签名
        "annotation_typing": False,  # 关键：忽略类型注解中的 Cython C 类型
                                     # （避免与 Pydantic v2 / dataclass / SQLAlchemy 冲突）
        "cdivision": False,          # 保持 Python 语义的整除
        "boundscheck": True,         # 保持 Python 语义的边界检查
        "wraparound": True,          # 保持 Python 的负索引语义
    },
    nthreads=_resolve_cython_nthreads(),
    quiet=False,
    include_path=[str(APP_DIR.parent)],  # 允许 cimport app.*
)

setup(
    name="vulhunter-backend-compiled",
    ext_modules=ext_modules,
)
