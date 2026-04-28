import os
import shutil
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def _run_sourcecode_generator(
    output_dir: Path, *, source_dir: Path | None = None, validate: bool = False
) -> subprocess.CompletedProcess[str]:
    script_path = REPO_ROOT / "scripts" / "generate-sourcecode-branch.sh"

    env = os.environ.copy()
    env["PATH"] = f"/usr/bin:/bin:{env['PATH']}"

    command = [
        "bash",
        str(script_path),
        "--output",
        str(output_dir),
    ]
    if source_dir is not None:
        command.extend(["--source", str(source_dir)])
    if validate:
        command.append("--validate")

    return subprocess.run(
        command,
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
    )


def _git_tree_hash(source_dir: Path, repo_dir: Path) -> str:
    repo_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(["git", "init", "-q", str(repo_dir)], check=True)
    shutil.copytree(source_dir, repo_dir, dirs_exist_ok=True)
    subprocess.run(["git", "-C", str(repo_dir), "add", "-A"], check=True)
    return subprocess.run(
        ["git", "-C", str(repo_dir), "write-tree"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


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
    assert (output_dir / "backend" / "app").is_dir()
    assert (output_dir / "frontend" / "src").is_dir()
    assert (output_dir / "backend" / "app" / "api" / "v1" / "endpoints" / "agent_test.py").is_file()
    assert (output_dir / "backend" / "app" / "services" / "agent" / "skill_test_runner.py").is_file()
    assert (output_dir / "backend" / "app" / "services" / "agent" / "agents" / "skill_test.py").is_file()

    assert not (output_dir / ".github").exists()
    assert not (output_dir / "docs").exists()
    assert not (output_dir / "deploy").exists()
    assert not (output_dir / "agent_checkpoints").exists()
    assert not (output_dir / "docker-compose.hybrid.yml").exists()
    assert not (output_dir / "CLAUDE.md").exists()
    assert not (output_dir / "backend" / "tests").exists()
    assert not (output_dir / "frontend" / "tests").exists()

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
    assert "商业交付、商业支持" in readme_text
    assert "separate commercial delivery/support terms may apply outside the license" in readme_en_text

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
    assert "商业交付、商业支持" in template_readme
    assert "separate commercial delivery/support terms may apply outside the license" in template_readme_en
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


def _write_tracked_file(repo_dir: Path, rel_path: str, content: str, *, executable: bool = False) -> None:
    path = repo_dir / rel_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    if executable:
        path.chmod(0o755)


def test_sourcecode_generator_sanitizes_generated_tree_only_with_synthetic_source(tmp_path: Path) -> None:
    source_dir = tmp_path / "source-repo"
    output_dir = tmp_path / "sourcecode-tree"
    source_dir.mkdir()
    subprocess.run(["git", "init", "-q", str(source_dir)], check=True)

    _write_tracked_file(source_dir, "scripts/setup-env.sh", "#!/usr/bin/env bash\n# remove setup comment\necho setup\n", executable=True)
    _write_tracked_file(source_dir, "docker/env/backend/env.example", "LLM_API_KEY=\n")
    _write_tracked_file(source_dir, "docker/Dockerfile", "FROM scratch\n")
    _write_tracked_file(source_dir, "frontend/src/main.ts", "export {}\n")
    _write_tracked_file(source_dir, "nexus-web/index.html", "<html></html>\n")
    _write_tracked_file(source_dir, "nexus-itemDetail/index.html", "<html></html>\n")
    _write_tracked_file(source_dir, "docker-compose.yml", (REPO_ROOT / "docker-compose.yml").read_text(encoding="utf-8"))
    _write_tracked_file(source_dir, "backend/app/keep.py", "# remove module comment\n# noqa: preserve directive\nvalue = '# not a comment'  # remove inline comment\n")
    _write_tracked_file(source_dir, "backend/app/not_allowlisted.py", "# preserve ordinary comment outside allowlist\nvalue = 1\n")
    _write_tracked_file(source_dir, "backend/app/__pycache__/gone.pyc", "bytecode")
    _write_tracked_file(source_dir, "backend/app/.ruff_cache/state", "cache")
    _write_tracked_file(source_dir, "frontend/src/component.test.ts", "console.log('test')\n")
    _write_tracked_file(source_dir, "frontend/src/component.spec.tsx", "console.log('spec')\n")
    _write_tracked_file(source_dir, "frontend/src/component.test.helper.ts", "console.log('test helper')\n")
    _write_tracked_file(source_dir, "frontend/src/component.spec.helper.ts", "console.log('spec helper')\n")
    _write_tracked_file(source_dir, "frontend/src/app.js.map", "{}")
    _write_tracked_file(source_dir, "frontend/src/debug.log", "debug")
    _write_tracked_file(source_dir, "fixtures/input.txt", "fixture")
    _write_tracked_file(source_dir, "mocks/mock.txt", "mock")
    _write_tracked_file(source_dir, "samples/sample.txt", "sample")
    _write_tracked_file(source_dir, "__tests__/case.txt", "test")
    _write_tracked_file(source_dir, "backend/app/db/rules/fixtures/keep.txt", "runtime rule fixture")
    _write_tracked_file(source_dir, "LICENSE", (REPO_ROOT / "LICENSE").read_text(encoding="utf-8"))

    subprocess.run(["git", "-C", str(source_dir), "add", "-A"], check=True)

    result = _run_sourcecode_generator(output_dir, source_dir=source_dir, validate=True)

    assert result.returncode == 0, result.stderr
    assert (output_dir / "scripts" / "setup-env.sh").is_file()
    assert (output_dir / "backend" / "app" / "keep.py").is_file()
    assert not (output_dir / "backend" / "app" / "__pycache__").exists()
    assert not (output_dir / "backend" / "app" / ".ruff_cache").exists()
    assert not (output_dir / "frontend" / "src" / "component.test.ts").exists()
    assert not (output_dir / "frontend" / "src" / "component.spec.tsx").exists()
    assert not (output_dir / "frontend" / "src" / "component.test.helper.ts").exists()
    assert not (output_dir / "frontend" / "src" / "component.spec.helper.ts").exists()
    assert not (output_dir / "frontend" / "src" / "app.js.map").exists()
    assert not (output_dir / "frontend" / "src" / "debug.log").exists()
    assert not (output_dir / "fixtures").exists()
    assert not (output_dir / "mocks").exists()
    assert not (output_dir / "samples").exists()
    assert not (output_dir / "__tests__").exists()
    assert (output_dir / "backend" / "app" / "db" / "rules" / "fixtures" / "keep.txt").is_file()

    setup_text = (output_dir / "scripts" / "setup-env.sh").read_text(encoding="utf-8")
    assert setup_text.startswith("#!/usr/bin/env bash")
    assert "remove setup comment" not in setup_text

    python_text = (output_dir / "backend" / "app" / "keep.py").read_text(encoding="utf-8")
    assert "remove module comment" not in python_text
    assert "# noqa: preserve directive" in python_text
    assert "# not a comment" in python_text
    assert "remove inline comment" not in python_text

    not_allowlisted_text = (output_dir / "backend" / "app" / "not_allowlisted.py").read_text(encoding="utf-8")
    assert "preserve ordinary comment outside allowlist" in not_allowlisted_text


def test_publish_sourcecode_workflow_syncs_generated_tree_to_sourcecode_branch() -> None:
    workflow_text = (REPO_ROOT / ".github" / "workflows" / "publish-sourcecode.yml").read_text(
        encoding="utf-8"
    )

    assert 'FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"' in workflow_text
    assert "workflow_dispatch:" in workflow_text
    assert "branches:" in workflow_text
    assert "- main" in workflow_text
    assert "git worktree add --detach --force" in workflow_text
    assert "bash ./scripts/generate-sourcecode-branch.sh" in workflow_text
    assert "git_tree_hash_for_dir()" in workflow_text
    assert 'git rev-parse refs/remotes/origin/sourcecode^{tree}' in workflow_text
    assert 'git checkout --orphan "sourcecode-publish-${GITHUB_RUN_ID}"' in workflow_text
    assert "git checkout -B sourcecode origin/sourcecode" not in workflow_text
    assert "git push origin HEAD:sourcecode" not in workflow_text
    assert "git push --force origin HEAD:sourcecode" in workflow_text

    # Detect-changes step gates smoke test and publish
    assert "id: detect_changes" in workflow_text
    assert 'has_changes=${has_changes}' in workflow_text
    gate_condition = "steps.detect_changes.outputs.has_changes == 'true'"
    assert workflow_text.count(gate_condition) == 2, (
        f"Expected detect_changes gate on both smoke test and publish steps (2 occurrences), "
        f"found {workflow_text.count(gate_condition)}"
    )

    # Verify each gated step has the condition immediately after its name
    import re
    gated_steps = re.findall(
        r"-\s+name:\s*(.+)\n\s+if:\s*" + re.escape(gate_condition),
        workflow_text,
    )
    assert "Smoke test sourcecode build" in gated_steps, (
        f"Smoke test step missing detect_changes gate; gated steps: {gated_steps}"
    )
    assert "Publish sourcecode branch" in gated_steps, (
        f"Publish step missing detect_changes gate; gated steps: {gated_steps}"
    )

    # Smoke test step exists and uses full build compose command
    assert "Smoke test sourcecode build" in workflow_text
    assert "docker-compose.full.yml" in workflow_text
    assert "RUNNER_PREFLIGHT_ENABLED=false" in workflow_text
    assert '"${compose_cmd[@]}" build' in workflow_text
    assert '"${compose_cmd[@]}" up -d' in workflow_text
    assert "healthy_services=(db redis backend frontend nexus-web)" in workflow_text

    # Both smoke test and publish are conditional on detect_changes
    smoke_idx = workflow_text.index("Smoke test sourcecode build")
    publish_idx = workflow_text.index("Publish sourcecode branch")
    detect_idx = workflow_text.index("Detect sourcecode changes")
    assert detect_idx < smoke_idx < publish_idx


def test_generate_sourcecode_branch_script_is_tracked_executable_in_git_index() -> None:
    result = subprocess.run(
        ["git", "ls-files", "--stage", "scripts/generate-sourcecode-branch.sh"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )

    assert result.stdout.startswith("100755 "), result.stdout


def test_git_tree_hash_ignores_empty_directories_when_comparing_sourcecode_snapshots(tmp_path: Path) -> None:
    baseline_dir = tmp_path / "baseline"
    sourcecode_dir = tmp_path / "sourcecode"
    (baseline_dir / "scripts").mkdir(parents=True)
    (sourcecode_dir / "scripts").mkdir(parents=True)
    (sourcecode_dir / "data").mkdir()

    baseline_script = baseline_dir / "scripts" / "setup-env.sh"
    sourcecode_script = sourcecode_dir / "scripts" / "setup-env.sh"
    baseline_script.write_text("#!/usr/bin/env bash\n", encoding="utf-8")
    sourcecode_script.write_text("#!/usr/bin/env bash\n", encoding="utf-8")
    baseline_script.chmod(0o755)
    sourcecode_script.chmod(0o755)

    assert _git_tree_hash(sourcecode_dir, tmp_path / "source-repo") == _git_tree_hash(
        baseline_dir, tmp_path / "baseline-repo"
    )


def test_git_tree_hash_detects_executable_bit_changes(tmp_path: Path) -> None:
    executable_dir = tmp_path / "executable"
    non_executable_dir = tmp_path / "non-executable"
    (executable_dir / "scripts").mkdir(parents=True)
    (non_executable_dir / "scripts").mkdir(parents=True)

    executable_script = executable_dir / "scripts" / "setup-env.sh"
    non_executable_script = non_executable_dir / "scripts" / "setup-env.sh"
    executable_script.write_text("#!/usr/bin/env bash\n", encoding="utf-8")
    non_executable_script.write_text("#!/usr/bin/env bash\n", encoding="utf-8")
    executable_script.chmod(0o755)
    non_executable_script.chmod(0o644)

    assert _git_tree_hash(executable_dir, tmp_path / "exec-repo") != _git_tree_hash(
        non_executable_dir, tmp_path / "non-exec-repo"
    )
