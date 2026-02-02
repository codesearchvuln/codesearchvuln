import asyncio
import json
import logging
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml

from app.schemas.opengrep import OpengrepRuleCreateRequest

from .llm_rule.config import Config
from .llm_rule.git_manager import GitManager
from .llm_rule.llm_client import LLMClient
from .llm_rule.patch_processor import PatchInfo, PatchProcessor
from .llm_rule.rule_manager import RuleManager
from .llm_rule.rule_validator import RuleValidator


class AutoGrep:
    def __init__(self, config: Config):
        self.config = config
        self.rule_manager = RuleManager(config)
        self.patch_processor = PatchProcessor(config)
        self.rule_validator = RuleValidator(config)
        self.git_manager = GitManager(config)
        self.llm_client = LLMClient()

    async def process_patch(self, patch_file: Path) -> Optional[Dict[str, Any]]:
        """Process a single patch file with improved rule checking."""
        repo_path = None
        patch_info = None
        attempts: List[Dict[str, Any]] = []
        # Check if patch has already been processed
        if self.config.cache_manager.is_patch_processed(patch_file.name):
            logging.info(f"Skipping already processed patch: {patch_file.name}")
            return None

        try:
            patch_info = self.patch_processor.process_patch(patch_file)
            if not patch_info:
                self.config.cache_manager.mark_patch_processed(patch_file.name)
                logging.warning(f"Failed to process patch file: {patch_file}")
                return {
                    "rule": None,
                    "patch_info": None,
                    "attempts": [],
                    "validation": {
                        "is_valid": False,
                        "message": "Failed to process patch file",
                    },
                }

            # Check if repo is known to fail
            repo_key = f"{patch_info.repo_owner}/{patch_info.repo_name}"
            if self.config.cache_manager.is_repo_failed(repo_key):
                error = self.config.cache_manager.get_repo_error(repo_key)
                logging.warning(f"Skipping known failed repository {repo_key}: {error}")
                self.config.cache_manager.mark_patch_processed(patch_file.name)
                return {
                    "rule": None,
                    "patch_info": patch_info,
                    "attempts": [],
                    "validation": {
                        "is_valid": False,
                        "message": f"Skipping known failed repository {repo_key}: {error}",
                    },
                }

            # Prepare repository
            repo_path = self.git_manager.prepare_repo(patch_info)
            if not repo_path:
                self.config.cache_manager.mark_repo_failed(repo_key, "Failed to prepare repository")
                self.config.cache_manager.mark_patch_processed(patch_file.name)
                return {
                    "rule": None,
                    "patch_info": patch_info,
                    "attempts": [],
                    "validation": {
                        "is_valid": False,
                        "message": "Failed to prepare repository",
                    },
                }

            # Get the language from patch info
            language = patch_info.file_changes[0].language

            # Check if any existing rules can detect this vulnerability
            existing_rules = self.rule_manager.rules.get(language, [])
            is_detected, detecting_rule = self.rule_validator.check_existing_rules(
                patch_info, repo_path, existing_rules
            )

            if is_detected:
                logging.info(f"Vulnerability already detectable by existing rule: {detecting_rule}")
                self.config.cache_manager.mark_patch_processed(patch_file.name)
                return {
                    "rule": None,
                    "patch_info": patch_info,
                    "attempts": [],
                    "validation": {
                        "is_valid": False,
                        "message": "Vulnerability already detectable by existing rule",
                    },
                }

            # Initialize error tracking
            error_msg = None

            # Try generating and validating rule
            for attempt in range(self.config.max_retries):
                logging.info(
                    f"Attempt {attempt + 1}/{self.config.max_retries} for patch {patch_file}"
                )

                rule = await self.llm_client.generate_rule(patch_info, error_msg)
                if not rule:
                    error_msg = "Failed to generate valid rule structure"
                    attempts.append(
                        {
                            "attempt": attempt + 1,
                            "rule": None,
                            "validation": {"is_valid": False, "message": error_msg},
                        }
                    )
                    continue

                is_valid, validation_error = self.rule_validator.validate_rule(
                    rule, patch_info, repo_path
                )

                if is_valid:
                    attempts.append(
                        {
                            "attempt": attempt + 1,
                            "rule": rule,
                            "validation": {"is_valid": True, "message": None},
                        }
                    )
                    logging.info(f"Successfully generated valid rule for {patch_file}")
                    self.config.cache_manager.mark_patch_processed(patch_file.name)
                    return {
                        "rule": rule,
                        "patch_info": patch_info,
                        "attempts": attempts,
                        "validation": {"is_valid": True, "message": None},
                    }

                # If validation failed due to parse errors, skip this patch
                attempts.append(
                    {
                        "attempt": attempt + 1,
                        "rule": rule,
                        "validation": {"is_valid": False, "message": validation_error},
                    }
                )

                if validation_error and (
                    "Parse error" in validation_error
                    or "Syntax error" in validation_error
                    or "Skipped all files" in validation_error
                ):
                    logging.info(f"Skipping patch due to parse errors: {validation_error}")
                    self.config.cache_manager.mark_patch_processed(patch_file.name)
                    return {
                        "rule": None,
                        "patch_info": patch_info,
                        "attempts": attempts,
                        "validation": {"is_valid": False, "message": validation_error},
                    }

                # Otherwise, use the error message for the next attempt
                error_msg = validation_error
                logging.warning(f"Attempt {attempt + 1} failed: {error_msg}")

            self.config.cache_manager.mark_patch_processed(patch_file.name)
            return {
                "rule": None,
                "patch_info": patch_info,
                "attempts": attempts,
                "validation": {"is_valid": False, "message": error_msg},
            }

        except Exception as e:
            logging.error(f"Unexpected error processing patch {patch_file}: {e}", exc_info=True)
            self.config.cache_manager.mark_patch_processed(patch_file.name)
            return {
                "rule": None,
                "patch_info": patch_info,
                "attempts": attempts,
                "validation": {"is_valid": False, "message": str(e)},
            }
        finally:
            # Always reset the repository state if it exists
            if repo_path and repo_path.exists():
                if not self.git_manager.reset_repo(repo_path):
                    logging.warning(f"Failed to reset repository state for: {repo_path}")
                    # If reset fails, we might want to force cleanup
                    self.git_manager.cleanup_repo(repo_path)

    async def _process_repo_patches(self, patches: list) -> list:
        """Process all patches for a single repository with caching."""
        rules = []
        for patch_file in patches:
            try:
                result = await self.process_patch(patch_file)
                if result:  # Check if we got a valid result
                    rule = result.get("rule")
                    patch_info = result.get("patch_info")
                    if rule and patch_info and patch_info.file_changes:
                        language = patch_info.file_changes[0].language
                        # Add language field to rule if not present
                        if "language" not in rule:
                            rule["language"] = language
                        # Store the rule immediately after generation
                        self.rule_manager.add_generated_rule(language, rule)
                        rules.append(rule)
                        logging.info(f"Successfully stored rule for {patch_file} in {language}")
            except Exception as e:
                logging.error(f"Error processing patch {patch_file}: {e}", exc_info=True)
        return rules

    async def run(self):
        """Main execution flow with caching."""
        logging.info("Starting AutoGrep processing with caching...")
        # Load initial rules
        self.rule_manager.load_initial_rules()
        # Get all patch files
        patch_files = list(self.config.patches_dir.glob("*.patch"))

        # Group patches by repository
        repo_patches = {}
        for patch_file in patch_files:
            # Skip if already processed
            if self.config.cache_manager.is_patch_processed(patch_file.name):
                logging.info(f"Skipping already processed patch: {patch_file.name}")
                continue
            logging.info(f"Processing patch file: {patch_file}")
            try:
                # Try to parse the patch filename to get repo info
                repo_owner, repo_name, _ = self.patch_processor.parse_patch_filename(
                    patch_file.name
                )
                repo_key = f"{repo_owner}/{repo_name}"

                # Skip if repo is known to fail
                if self.config.cache_manager.is_repo_failed(repo_key):
                    error = self.config.cache_manager.get_repo_error(repo_key)
                    logging.warning(f"Skipping known failed repository {repo_key}: {error}")
                    self.config.cache_manager.mark_patch_processed(patch_file.name)
                    continue

                if repo_key not in repo_patches:
                    repo_patches[repo_key] = []
                repo_patches[repo_key].append(patch_file)
            except ValueError as e:
                logging.error(f"Error parsing patch filename {patch_file}: {e}")
                self.config.cache_manager.mark_patch_processed(patch_file.name)
                continue

        # Process different repos in parallel using asyncio
        repo_tasks = []
        for repo_key, patches in repo_patches.items():
            task = self._process_repo_patches(patches)
            repo_tasks.append(task)

        # Wait for all repos to complete
        if repo_tasks:
            results = await asyncio.gather(*repo_tasks, return_exceptions=True)
            for result in results:
                if isinstance(result, Exception):
                    logging.error(f"Error processing repository patches: {result}")


async def get_rule_by_patch(request: OpengrepRuleCreateRequest) -> Dict[str, Any]:
    repo_owner = request.repo_owner
    repo_name = request.repo_name
    commit_hash = request.commit_hash
    commit_content = request.commit_content

    temp_file = (
        Path(__file__).parent
        / "llm_rule"
        / "patches"
        / f"github.com_{repo_owner}_{repo_name}_{commit_hash}.patch"
    )
    temp_file.write_text(commit_content)

    config = Config(
        max_files_changed=1,
        max_retries=3,
    )

    config.generated_rules_dir.mkdir(parents=True, exist_ok=True)
    config.repos_cache_dir.mkdir(parents=True, exist_ok=True)
    config.rules_dir.mkdir(parents=True, exist_ok=True)
    config.patches_dir.mkdir(parents=True, exist_ok=True)
    try:
        autogen = AutoGrep(config)
        logging.info("Starting AutoGrep run for single patch...")
        result = await autogen.process_patch(temp_file)

        if result:
            patch_info = result.get("patch_info")
            language = None
            if patch_info and patch_info.file_changes:
                language = patch_info.file_changes[0].language

            return {
                "rule": result.get("rule"),
                "validation": result.get("validation"),
                "attempts": result.get("attempts", []),
                "meta": {
                    "repo_owner": repo_owner,
                    "repo_name": repo_name,
                    "commit_hash": commit_hash,
                    "language": language,
                },
            }

        return {
            "rule": None,
            "validation": {"is_valid": False, "message": "大模型生成规则失败，请稍后重试"},
            "attempts": [],
            "meta": {
                "repo_owner": repo_owner,
                "repo_name": repo_name,
                "commit_hash": commit_hash,
                "language": None,
            },
        }
    except Exception as e:
        logging.error(f"Error running AutoGrep: {e}", exc_info=True)
        return {
            "rule": None,
            "validation": {"is_valid": False, "message": "生成失败"},
            "attempts": [],
            "meta": {
                "repo_owner": repo_owner,
                "repo_name": repo_name,
                "commit_hash": commit_hash,
                "language": None,
            },
        }
    finally:
        if temp_file.exists():
            temp_file.unlink()
        shutil.rmtree(config.generated_rules_dir, ignore_errors=True)
        # shutil.rmtree(config.repos_cache_dir, ignore_errors=True)


LANGUAGE_EXTENSION_MAP = {
    "python": ".py",
    "javascript": ".js",
    "typescript": ".ts",
    "java": ".java",
    "go": ".go",
    "rust": ".rs",
    "cpp": ".cpp",
    "c++": ".cpp",
    "c": ".c",
    "csharp": ".cs",
    "c#": ".cs",
    "php": ".php",
    "ruby": ".rb",
    "kotlin": ".kt",
    "swift": ".swift",
    "scala": ".scala",
    "solidity": ".sol",
}


def _normalize_rule_yaml(
    rule_yaml: str, llm_client: LLMClient
) -> Tuple[Optional[str], Optional[dict], Optional[str]]:
    cleaned = llm_client.clean_yaml_text(rule_yaml)
    if not cleaned:
        return None, None, "规则YAML格式错误"
    try:
        data = yaml.safe_load(cleaned) or {}
    except yaml.YAMLError:
        return None, None, "规则YAML解析失败"

    rules = data.get("rules")
    if not isinstance(rules, list) or not rules:
        return None, None, "规则中未找到有效的 rules 列表"

    rule = rules[0]
    if not isinstance(rule, dict):
        return None, None, "规则结构不合法"

    return cleaned, rule, None


def _validate_rule_schema_generic(rule: dict) -> Tuple[bool, Optional[str]]:
    if not isinstance(rule, dict):
        return False, "规则结构不合法"

    required_fields = ["id", "message", "severity", "languages"]
    missing_fields = [field for field in required_fields if field not in rule]
    if missing_fields:
        return False, f"缺少必填字段: {', '.join(missing_fields)}"

    pattern_fields = ["pattern", "patterns", "pattern-either", "pattern-regex"]
    if not any(field in rule for field in pattern_fields):
        return False, "缺少模式字段: pattern/patterns/pattern-either/pattern-regex"

    valid_severities = ["ERROR", "WARNING", "INFO"]
    if rule.get("severity") not in valid_severities:
        return False, f"严重程度必须为: {', '.join(valid_severities)}"

    return True, None


def _extract_snippets(value: Any) -> List[str]:
    snippets: List[str] = []
    if isinstance(value, list):
        for item in value:
            if isinstance(item, str):
                snippets.append(item)
            elif isinstance(item, dict):
                code = item.get("code") or item.get("snippet") or item.get("content")
                if code:
                    snippets.append(code)
    elif isinstance(value, dict):
        code = value.get("code") or value.get("snippet") or value.get("content")
        if code:
            snippets.append(code)
    elif isinstance(value, str):
        snippets.append(value)
    return [s for s in snippets if isinstance(s, str) and s.strip()]


async def _generate_test_yaml(
    rule_yaml: str, rule: dict, llm_client: LLMClient
) -> Tuple[Optional[str], Optional[str]]:
    languages = rule.get("languages") or []
    language_hint = languages[0] if isinstance(languages, list) and languages else ""
    rule_id = rule.get("id") or "custom-rule"

    prompt = f"""你是静态规则测试工程师。
给定以下规则 YAML，请输出用于测试该规则的 test.yaml。

规则要求：
- 仅输出 YAML，不要任何解释
- YAML 必须包含字段：language, positive, negative
- positive/negative 为代码片段列表，每个片段应尽量短
- positive 必须命中该规则，negative 必须不命中该规则

规则ID: {rule_id}
建议语言: {language_hint}
规则YAML:
{rule_yaml}
"""

    try:
        response = await llm_client.client.chat_completion(
            messages=[
                {
                    "role": "system",
                    "content": "只输出YAML，不要输出markdown或其他文字。",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
        )
    except Exception as e:
        logging.error(f"Failed to generate test YAML: {e}")
        return None, "生成测试用例失败"

    content = response.get("content") if isinstance(response, dict) else None
    if not content:
        return None, "生成测试用例失败"

    text = llm_client.extract_response(content)
    try:
        data = yaml.safe_load(text)
    except yaml.YAMLError:
        return None, "测试用例YAML解析失败"

    if not isinstance(data, dict):
        return None, "测试用例格式错误"

    if "positive" not in data and "negative" not in data and "tests" in data:
        data = data.get("tests") or {}

    positive = _extract_snippets(data.get("positive"))
    negative = _extract_snippets(data.get("negative"))
    language = data.get("language") or language_hint

    if not language:
        return None, "测试用例缺少语言信息"
    if not positive or not negative:
        return None, "测试用例必须包含正负样本"

    normalized = {
        "language": language,
        "positive": [{"code": snippet} for snippet in positive],
        "negative": [{"code": snippet} for snippet in negative],
    }
    return yaml.safe_dump(normalized, sort_keys=False), None


def _run_opengrep(rule_file: str, target_path: str) -> Tuple[list, Optional[str]]:
    try:
        result = subprocess.run(
            ["opengrep", "--config", rule_file, "--json", target_path],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except FileNotFoundError:
        return [], "未找到 opengrep 命令"
    except subprocess.TimeoutExpired:
        return [], "opengrep 执行超时"
    except Exception as e:
        return [], f"opengrep 执行失败: {str(e)}"

    if not result.stdout:
        if result.stderr:
            return [], result.stderr.strip()
        return [], None

    try:
        output = json.loads(result.stdout)
    except json.JSONDecodeError:
        return [], "解析 opengrep 输出失败"

    errors = output.get("errors") or []
    if errors:
        for error in errors:
            if isinstance(error, dict):
                error_type = error.get("type", "")
                if "InvalidRuleSchemaError" in error_type or "InvalidRuleError" in error_type:
                    return [], error.get("long_msg") or "规则格式不合法"
        return [], errors[0].get("long_msg") if isinstance(errors[0], dict) else "opengrep 错误"

    return output.get("results", []), None


def _validate_rule_with_tests(
    rule_yaml: str, rule: dict, test_yaml: str
) -> Tuple[bool, Optional[str]]:
    try:
        test_data = yaml.safe_load(test_yaml) or {}
    except yaml.YAMLError:
        return False, "测试用例YAML解析失败"

    language = str(test_data.get("language") or "").strip()
    if not language:
        return False, "无法确定测试语言"

    language_key = language.lower()
    ext = LANGUAGE_EXTENSION_MAP.get(language_key)
    if not ext:
        return False, f"暂不支持语言: {language}"

    rule_languages = [
        str(lang).lower()
        for lang in (rule.get("languages") or [])
        if isinstance(lang, str) and lang.strip()
    ]
    if rule_languages and language_key not in rule_languages:
        return False, "测试语言不在规则 languages 中"

    positive_snippets = _extract_snippets(test_data.get("positive"))
    negative_snippets = _extract_snippets(test_data.get("negative"))
    if not positive_snippets or not negative_snippets:
        return False, "测试用例缺少正负样本"

    with tempfile.TemporaryDirectory() as temp_dir:
        rule_path = Path(temp_dir) / "rule.yaml"
        rule_path.write_text(rule_yaml)
        test_path = Path(temp_dir) / "test.yaml"
        test_path.write_text(test_yaml)

        for idx, snippet in enumerate(positive_snippets, start=1):
            target_path = Path(temp_dir) / f"positive_{idx}{ext}"
            target_path.write_text(snippet)
            results, error = _run_opengrep(str(rule_path), str(target_path))
            if error:
                return False, error
            if not results:
                return False, "正样本未命中规则"

        for idx, snippet in enumerate(negative_snippets, start=1):
            target_path = Path(temp_dir) / f"negative_{idx}{ext}"
            target_path.write_text(snippet)
            results, error = _run_opengrep(str(rule_path), str(target_path))
            if error:
                return False, error
            if results:
                return False, "负样本被规则误报"

    return True, None


async def validate_generic_rule(rule_yaml: str) -> Dict[str, Any]:
    llm_client = LLMClient()
    cleaned, rule, error = _normalize_rule_yaml(rule_yaml, llm_client)
    if error:
        return {
            "rule": None,
            "rule_yaml": None,
            "test_yaml": None,
            "validation": {"is_valid": False, "message": error},
        }

    is_valid, validation_error = _validate_rule_schema_generic(rule)
    if not is_valid:
        return {
            "rule": rule,
            "rule_yaml": cleaned,
            "test_yaml": None,
            "validation": {"is_valid": False, "message": validation_error},
        }

    test_yaml, test_error = await _generate_test_yaml(cleaned, rule, llm_client)
    if test_error:
        return {
            "rule": rule,
            "rule_yaml": cleaned,
            "test_yaml": None,
            "validation": {"is_valid": False, "message": test_error},
        }

    is_valid, validation_error = _validate_rule_with_tests(cleaned, rule, test_yaml)
    if not is_valid:
        return {
            "rule": rule,
            "rule_yaml": cleaned,
            "test_yaml": test_yaml,
            "validation": {"is_valid": False, "message": validation_error},
        }

    return {
        "rule": rule,
        "rule_yaml": cleaned,
        "test_yaml": test_yaml,
        "validation": {"is_valid": True, "message": None},
    }
