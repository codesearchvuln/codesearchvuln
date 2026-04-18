import os
import shutil
import stat
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def _run_sourcecode_generator(output_dir: Path, *, validate: bool = False) -> subprocess.CompletedProcess[str]:
    script_path = REPO_ROOT / "scripts" / "generate-sourcecode-branch.sh"
    script_path.chmod(script_path.stat().st_mode | stat.S_IXUSR)

    env = os.environ.copy()
    env["PATH"] = f"/usr/bin:/bin:{env['PATH']}"

    command = [
        str(script_path),
        "--output",
        str(output_dir),
    ]
    if validate:
        command.append("--validate")

    return subprocess.run(
        command,
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
    )


def test_sourcecode_generator_builds_public_source_tree_with_full_only_contract(tmp_path: Path) -> None:
    output_dir = tmp_path / "sourcecode-tree"

    result = _run_sourcecode_generator(output_dir, validate=True)

    assert result.returncode == 0, result.stderr
    assert (output_dir / "backend").is_dir()
    assert (output_dir / "frontend").is_dir()
    assert (output_dir / "docker").is_dir()
    assert (output_dir / "data").is_dir()
    assert (output_dir / "nexus-web").is_dir()
    assert (output_dir / "nexus-itemDetail").is_dir()
    assert (output_dir / "docker-compose.yml").is_file()
    assert (output_dir / "docker-compose.full.yml").is_file()
    assert (output_dir / "README.md").is_file()
    assert (output_dir / "README_EN.md").is_file()
    assert (output_dir / "Makefile").is_file()
    assert (output_dir / "scripts" / "setup-env.sh").is_file()
    assert (output_dir / "docker" / "env" / "backend" / "env.example").is_file()

    assert not (output_dir / ".github").exists()
    assert not (output_dir / "docs").exists()
    assert not (output_dir / "deploy").exists()
    assert not (output_dir / "agent_checkpoints").exists()
    assert not (output_dir / "docker-compose.hybrid.yml").exists()
    assert not (output_dir / "CLAUDE.md").exists()

    assert sorted(path.relative_to(output_dir / "scripts").as_posix() for path in (output_dir / "scripts").rglob("*")) == [
        "setup-env.sh"
    ]

    readme_text = (output_dir / "README.md").read_text(encoding="utf-8")
    readme_en_text = (output_dir / "README_EN.md").read_text(encoding="utf-8")
    makefile_text = (output_dir / "Makefile").read_text(encoding="utf-8")
    setup_env_text = (output_dir / "scripts" / "setup-env.sh").read_text(encoding="utf-8")
    compose_text = (output_dir / "docker-compose.yml").read_text(encoding="utf-8")
    full_compose_text = (output_dir / "docker-compose.full.yml").read_text(encoding="utf-8")

    for text in (
        readme_text,
        readme_en_text,
        makefile_text,
        setup_env_text,
        compose_text,
        full_compose_text,
    ):
        assert "docker-compose.hybrid.yml" not in text
        assert "compose-up-with-fallback" not in text
        assert "docker compose up" not in text

    assert "docker compose -f docker-compose.yml -f docker-compose.full.yml up --build" in readme_text
    assert "docker compose -f docker-compose.yml -f docker-compose.full.yml up --build" in readme_en_text

    if shutil.which("docker") and subprocess.run(
        ["docker", "compose", "version"],
        capture_output=True,
        text=True,
    ).returncode == 0:
        config_result = subprocess.run(
            ["docker", "compose", "-f", "docker-compose.yml", "-f", "docker-compose.full.yml", "config"],
            cwd=output_dir,
            capture_output=True,
            text=True,
        )
        assert config_result.returncode == 0, config_result.stderr


def test_sourcecode_templates_and_setup_env_expose_full_only_entrypoint() -> None:
    template_readme = (REPO_ROOT / "scripts" / "sourcecode-templates" / "README.md").read_text(encoding="utf-8")
    template_readme_en = (REPO_ROOT / "scripts" / "sourcecode-templates" / "README_EN.md").read_text(encoding="utf-8")
    template_makefile = (REPO_ROOT / "scripts" / "sourcecode-templates" / "Makefile").read_text(encoding="utf-8")
    setup_env_text = (REPO_ROOT / "scripts" / "setup-env.sh").read_text(encoding="utf-8")
    compose_text = (REPO_ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    full_compose_text = (REPO_ROOT / "docker-compose.full.yml").read_text(encoding="utf-8")

    for text in (
        template_readme,
        template_readme_en,
        template_makefile,
        setup_env_text,
        compose_text,
        full_compose_text,
    ):
        assert "docker-compose.hybrid.yml" not in text
        assert "compose-up-with-fallback" not in text
        assert "docker compose up" not in text

    assert "docker compose -f docker-compose.yml -f docker-compose.full.yml up --build" in template_readme
    assert "docker compose -f docker-compose.yml -f docker-compose.full.yml up --build" in template_readme_en
    assert "# 部署指南" in template_readme
    assert "# Deployment Guide" in template_readme_en
    assert "podman compose" not in template_readme
    assert "podman compose" not in template_readme_en
    assert "make up-full" in template_makefile
    assert "\nup:\n" not in template_makefile
    assert "\nup-build:\n" not in template_makefile
    assert "\nup-attached:\n" not in template_makefile
    assert "\nbuild-backend:\n" not in template_makefile
    assert "\nbuild-frontend:\n" not in template_makefile
    assert "docker compose -f docker-compose.yml -f docker-compose.full.yml up --build" in setup_env_text
    assert "唯一推荐入口" in full_compose_text


def test_publish_sourcecode_workflow_syncs_generated_tree_to_sourcecode_branch() -> None:
    workflow_text = (REPO_ROOT / ".github" / "workflows" / "publish-sourcecode.yml").read_text(
        encoding="utf-8"
    )

    assert 'FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"' in workflow_text
    assert "workflow_dispatch:" in workflow_text
    assert "branches:" in workflow_text
    assert "- main" in workflow_text
    assert "git worktree add --detach --force" in workflow_text
    assert "generate-sourcecode-branch.sh" in workflow_text
    assert "git ls-remote --exit-code --heads origin sourcecode" in workflow_text
    assert 'git checkout --orphan "sourcecode-publish-${GITHUB_RUN_ID}"' in workflow_text
    assert "git push origin HEAD:sourcecode" in workflow_text
