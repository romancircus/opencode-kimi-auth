#!/usr/bin/env python3
"""Validate repo compliance with CLAUDE.md/AGENTS.md standards.

Usage:
    python3 ~/scripts/validate_repo_compliance.py           # All repos
    python3 ~/scripts/validate_repo_compliance.py /path/to/repo  # Single repo

Exit code 0 if all pass, 1 if any fail.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess  # nosec B404 - trusted local subprocess usage for validators and git checks
import sys
from pathlib import Path

STALE_REPOS = {
    "seed-vc",
    "YuE",
    "jigyoung-website",
    "Roman-Circus-LandingPage",
    "YoutubeGodMode",
    "KalosData_Automation",
    "pizzagateDemo",
    "protonvpn-wg-config-generate",
    "chatterbox-finetuning",
    "thermal-monitor",
    "MacVPN-Performance",
    "learning-comfyui",
    "ai-model-docs",
    "gemini-cli-guide",
    "crt-shader-reference",
    "ghostty-nightly",
    "roblox-game-bible",
    "CosyVoice",
    "llama.cpp",
    "SimpleTuner",
    "mcp-linear-cached",
    "jinyang-landing",
    "jinyang-public",
    "shannon",
}

INFRA_CONTROL_REPOS = {
    "agent-infrastructure",
}

COMFYUI_REPOS = {
    "pokedex-generator",
    "KDH-Automation",
    "Goat",
    "RobloxChristian",
    "comfyui-massmediafactory-mcp",
}

REQUIRED_CLAUDE_SECTIONS: list[str] = []
PLAN_ARTIFACT_PATTERN = re.compile(r"docs/plans/<slug>-<YYYY-MM-DD>\.md", re.IGNORECASE)
DEFAULT_ISSUE_PATTERN = re.compile(
    r"one\s+linear\s+issue\s+per\s+executable\s+step", re.IGNORECASE
)
SINGLE_ISSUE_PATTERN = re.compile(r"single[- ]issue", re.IGNORECASE)
EXCEPTION_MARKER = "Execution Mode: overnight-single-issue"
PLAN_LINT_COMMAND_PATTERN = re.compile(
    r"python3\s+scripts/plan_lint\.py\s+--all\s+--require-files", re.IGNORECASE
)
LINEAR_OUTBOX_SCRIPT = "scripts/linear_outbox_append.py"
LINEAR_FLUSH_SCRIPT = "scripts/linear_flush_outbox.py"
SCOPED_IGNORE_DIRS = {
    ".git",
    ".venv",
    "__pycache__",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "third_party",
    "vendor",
}
SCOPED_VARIANT_FILENAMES = {
    ".agents.md",
    "AGENTS.override.md",
    "agents.md",
}
SCOPED_IGNORE_PREFIXES = (
    Path("tests") / "fixtures" / "instruction-evals",
)


def _normalize_content(content: str) -> str:
    return " ".join(content.lower().split())


def has_plan_linear_protocol(content: str) -> bool:
    normalized = _normalize_content(content)
    return all(
        (
            "`docs/plans/<slug>-<yyyy-mm-dd>.md`" in normalized,
            "linear outage fallback" in normalized,
            any(
                marker in normalized
                for marker in (
                    "mandatory plan-to-linear protocol",
                    "mandatory plan-linear execution protocol",
                    "<!-- plan_linear_protocol_start -->",
                )
            ),
        )
    )


def _extract_h2_section(content: str, headings: list[str]) -> str | None:
    for heading in headings:
        heading_re = re.compile(rf"^##\s+{re.escape(heading)}\s*$", re.MULTILINE)
        match = heading_re.search(content)
        if not match:
            continue
        section_start = match.end()
        next_h2 = re.search(r"^##\s+", content[section_start:], re.MULTILINE)
        section_end = section_start + next_h2.start() if next_h2 else len(content)
        return content[section_start:section_end]
    return None


def _lint_plan_semantics(repo_path: Path) -> tuple[bool, str]:
    lint_script = Path(__file__).resolve().parent / "plan_lint.py"
    if not lint_script.exists():
        return False, f"missing plan lint script: {lint_script}"
    try:
        proc = subprocess.run(  # nosec B603 - runs trusted local validator script
            [
                sys.executable,
                str(lint_script),
                "--repo-root",
                str(repo_path),
                "--all",
                "--require-files",
            ],
            check=False,
            capture_output=True,
            text=True,
        )
    except Exception as exc:
        return False, f"plan semantic lint execution failed: {exc}"

    if proc.returncode == 0:
        return True, ""

    detail = (proc.stderr or proc.stdout or "").strip().replace("\n", " | ")
    return False, detail or "plan semantic lint failed"


def _lint_claude_quality(repo_path: Path, file_paths: list[Path] | None = None) -> tuple[bool, str]:
    lint_script = Path(__file__).resolve().parent / "claude_policy_lint.py"
    if not lint_script.exists():
        return False, f"missing claude policy lint script: {lint_script}"
    command = [
        sys.executable,
        str(lint_script),
        "--repo-root",
        str(repo_path),
        "--strict",
    ]
    if file_paths:
        command.extend(str(path) for path in file_paths)
    try:
        proc = subprocess.run(  # nosec B603 - runs trusted local validator script
            command,
            check=False,
            capture_output=True,
            text=True,
        )
    except Exception as exc:
        return False, f"claude policy lint execution failed: {exc}"

    if proc.returncode == 0:
        return True, ""

    detail = (proc.stderr or proc.stdout or "").strip().replace("\n", " | ")
    return False, detail or "claude policy lint failed"


def _discover_scoped_instruction_files(repo_path: Path) -> tuple[list[Path], list[Path], list[Path]]:
    scoped_files: list[Path] = []
    variant_files: list[Path] = []
    claude_rules: list[Path] = []

    for path in repo_path.rglob("*"):
        if path.name in SCOPED_IGNORE_DIRS and path.is_dir():
            continue
        relative = path.relative_to(repo_path)
        if any(relative == prefix or prefix in relative.parents for prefix in SCOPED_IGNORE_PREFIXES):
            continue
        relative_parts = set(relative.parts)
        if relative_parts & SCOPED_IGNORE_DIRS:
            continue
        if path.is_dir():
            continue
        if path.name == "AGENTS.md" and path.parent != repo_path:
            scoped_files.append(path)
        elif path.name in SCOPED_VARIANT_FILENAMES:
            variant_files.append(path)
        elif ".claude" in path.parts and "rules" in path.parts and path.suffix == ".md":
            claude_rules.append(path)

    return sorted(scoped_files), sorted(variant_files), sorted(claude_rules)


def _validate_plan_linear_semantics(content: str) -> list[str]:
    issues: list[str] = []

    section = _extract_h2_section(
        content,
        [
            "Mandatory Plan-to-Linear Protocol",
            "MANDATORY PLAN-LINEAR EXECUTION PROTOCOL",
        ],
    )
    if section is None:
        issues.append(
            "missing heading: ## Mandatory Plan-to-Linear Protocol or ## MANDATORY PLAN-LINEAR EXECUTION PROTOCOL"
        )
        section = ""

    if not PLAN_ARTIFACT_PATTERN.search(section):
        issues.append(
            "missing plan artifact convention: docs/plans/<slug>-<YYYY-MM-DD>.md"
        )
    if not DEFAULT_ISSUE_PATTERN.search(section):
        issues.append("missing default issue strategy: one Linear issue per executable step")

    has_single_issue = bool(SINGLE_ISSUE_PATTERN.search(section))
    if has_single_issue and EXCEPTION_MARKER not in section:
        issues.append("single-issue mode mentioned without explicit exception marker")

    if not PLAN_LINT_COMMAND_PATTERN.search(content):
        issues.append(
            "missing strict plan lint command: python3 scripts/plan_lint.py --all --require-files"
        )

    section_lower = section.lower()
    if "linear outage fallback" not in section_lower:
        issues.append("missing Linear outage fallback section")
    if LINEAR_OUTBOX_SCRIPT not in section:
        issues.append(f"missing outage fallback command reference: {LINEAR_OUTBOX_SCRIPT}")
    if LINEAR_FLUSH_SCRIPT not in section:
        issues.append(f"missing outage fallback command reference: {LINEAR_FLUSH_SCRIPT}")

    return issues


def check_repo(
    repo_path: Path,
    active_only: bool = True,
    require_plan_linear: bool = False,
    require_plan_semantics: bool = False,
    require_claude_quality: bool = False,
) -> dict:
    name = repo_path.name
    if active_only and name in INFRA_CONTROL_REPOS:
        return {"path": str(repo_path), "name": name, "skipped": True, "reason": "infra-control"}
    if active_only and name in STALE_REPOS:
        return {"path": str(repo_path), "name": name, "skipped": True, "reason": "stale"}

    try:
        subprocess.run(  # nosec B603,B607 - trusted local git invocation
            ["git", "-C", str(repo_path), "rev-parse", "--is-inside-work-tree"],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception:
        return {"path": str(repo_path), "name": name, "skipped": True, "reason": "not git"}

    results = {
        "path": str(repo_path),
        "name": name,
        "skipped": False,
        "agents_symlink": False,
        "agents_exists": False,
        "precommit": False,
        "mcp_hooks": False,
        "claude_md": False,
        "has_required_sections": False,
        "mcp_templates": False,
        "mmf_section": False,
        "needs_templates": name in COMFYUI_REPOS,
        "needs_plan_linear": False,
        "plan_linear_protocol": False,
        "plan_semantics": False,
        "linear_fallback_scripts": False,
        "plans_dir": False,
        "plan_template": False,
        "plan_lint_script": False,
        "claude_policy_lint_script": False,
        "claude_quality": False,
        "scoped_files": 0,
        "claude_rule_files": 0,
        "issues": [],
        "warnings": [],
    }

    scoped_files, variant_files, claude_rule_files = _discover_scoped_instruction_files(repo_path)
    results["scoped_files"] = len(scoped_files)
    results["claude_rule_files"] = len(claude_rule_files)
    if variant_files:
        joined = ", ".join(str(path.relative_to(repo_path)) for path in variant_files)
        results["warnings"].append(
            "variant scoped-instruction filenames present; prefer uppercase nested AGENTS.md: " + joined
        )

    agents_md = repo_path / "AGENTS.md"
    if agents_md.exists() or agents_md.is_symlink():
        results["agents_exists"] = True
        if agents_md.is_symlink():
            target = os.readlink(str(agents_md))
            if "CLAUDE.md" in target:
                results["agents_symlink"] = True
            else:
                results["issues"].append(
                    f"AGENTS.md symlink points to {target}, should point to CLAUDE.md"
                )
        else:
            results["issues"].append("AGENTS.md is regular file, should be symlink -> CLAUDE.md")
    else:
        results["issues"].append("AGENTS.md missing")

    if (repo_path / ".pre-commit-config.yaml").exists():
        results["precommit"] = True
    else:
        results["issues"].append("Missing .pre-commit-config.yaml")

    if results["needs_templates"]:
        hooks_path = repo_path / "scripts" / "precommit_mcp_hooks.py"
        if hooks_path.exists():
            results["mcp_hooks"] = os.access(str(hooks_path), os.X_OK)
            if not results["mcp_hooks"]:
                results["issues"].append("precommit_mcp_hooks.py not executable")
        else:
            results["issues"].append("Missing scripts/precommit_mcp_hooks.py")
    else:
        results["mcp_hooks"] = True

    claude_md = repo_path / "CLAUDE.md"
    if claude_md.exists() and not claude_md.is_symlink():
        results["claude_md"] = True
        try:
            content = claude_md.read_text(errors="replace")
            missing = [s for s in REQUIRED_CLAUDE_SECTIONS if s not in content]
            if not missing:
                results["has_required_sections"] = True
            else:
                results["issues"].append(f"CLAUDE.md missing sections: {', '.join(missing)}")
        except Exception as exc:
            results["issues"].append(f"Cannot read CLAUDE.md: {exc}")
    elif claude_md.is_symlink():
        results["claude_md"] = True
        results["has_required_sections"] = True
    else:
        results["issues"].append("Missing CLAUDE.md")

    claude_lint_script = repo_path / "scripts" / "claude_policy_lint.py"
    results["claude_policy_lint_script"] = claude_lint_script.exists() and os.access(
        str(claude_lint_script), os.X_OK
    )
    if require_claude_quality:
        if not results["claude_policy_lint_script"]:
            results["issues"].append("Missing executable scripts/claude_policy_lint.py")
        file_paths = [claude_md] if claude_md.exists() or claude_md.is_symlink() else []
        file_paths.extend(scoped_files)
        ok, detail = _lint_claude_quality(repo_path, file_paths=file_paths or None)
        results["claude_quality"] = ok
        if not ok:
            results["issues"].append(
                f"CLAUDE policy quality lint failed{': ' + detail if detail else ''}"
            )
    else:
        results["claude_quality"] = True

    linear_append = repo_path / "scripts" / "linear_outbox_append.py"
    linear_flush = repo_path / "scripts" / "linear_flush_outbox.py"
    results["linear_fallback_scripts"] = linear_append.exists() and linear_flush.exists()
    results["needs_plan_linear"] = require_plan_linear or results["linear_fallback_scripts"]

    if results["needs_plan_linear"] and results["claude_md"]:
        try:
            content = (repo_path / "CLAUDE.md").read_text(errors="replace")
            if has_plan_linear_protocol(content):
                results["plan_linear_protocol"] = True
            else:
                results["issues"].append(
                    "CLAUDE.md missing canonical Plan/Linear protocol markers "
                    "(need plan artifact reference, outage fallback section, and protocol heading/block)"
                )
        except Exception as exc:
            results["issues"].append(
                f"Cannot read CLAUDE.md for plan/linear protocol: {exc}"
            )

        plans_dir = repo_path / "docs" / "plans"
        results["plans_dir"] = plans_dir.exists()
        if not results["plans_dir"]:
            results["issues"].append("Missing docs/plans directory for plan artifact convention")

        plan_template_candidates = [
            repo_path / "templates" / "plan.artifact.template.md",
            repo_path / "docs" / "plans" / "plan.template.md",
        ]
        results["plan_template"] = any(p.exists() for p in plan_template_candidates)
        if require_plan_semantics and not results["plan_template"]:
            results["issues"].append(
                "Missing plan template (expected templates/plan.artifact.template.md "
                "or docs/plans/plan.template.md)"
            )

        plan_lint_script = repo_path / "scripts" / "plan_lint.py"
        results["plan_lint_script"] = plan_lint_script.exists() and os.access(
            str(plan_lint_script), os.X_OK
        )
        if require_plan_semantics and not results["plan_lint_script"]:
            results["issues"].append("Missing executable scripts/plan_lint.py")

        if require_plan_semantics:
            semantic_issues = _validate_plan_linear_semantics(content)
            if semantic_issues:
                results["issues"].append(
                    "CLAUDE.md plan/linear protocol semantic gaps: " + "; ".join(semantic_issues)
                )
            ok, detail = _lint_plan_semantics(repo_path)
            results["plan_semantics"] = ok and not semantic_issues
            if not ok:
                results["issues"].append(f"Plan semantic lint failed{': ' + detail if detail else ''}")
        else:
            results["plan_semantics"] = True
    else:
        results["plan_linear_protocol"] = True
        results["plan_semantics"] = True
        results["plans_dir"] = True
        results["plan_template"] = True
        results["plan_lint_script"] = True

    if results["needs_templates"]:
        if (repo_path / "mcp_templates").exists():
            results["mcp_templates"] = True
        else:
            results["issues"].append("ComfyUI repo missing mcp_templates/")

    if results["needs_templates"] and results["claude_md"]:
        try:
            content = claude_md.read_text(errors="replace")
            if "mmf" in content and ("mmf run" in content or "mmf pipeline" in content):
                results["mmf_section"] = True
            else:
                results["issues"].append(
                    "CLAUDE.md missing mmf CLI section (need 'mmf run' or 'mmf pipeline' examples)"
                )
        except Exception as exc:
            results["warnings"].append(f"Cannot read CLAUDE.md for mmf check: {exc}")

    return results


def print_results(
    results: list[dict],
    require_plan_semantics: bool = False,
    require_claude_quality: bool = False,
) -> int:
    print(
        f"{'Repo':<35} {'AGENTS':>6} {'HOOKS':>6} {'CLAUDE':>7} {'PLAN':>5} {'CLQ':>4} {'MMF':>4} {'ISSUES':>6}"
    )
    print("-" * 70)

    failures = 0
    skipped = 0

    for result in sorted(results, key=lambda item: item["name"]):
        if result.get("skipped"):
            skipped += 1
            continue

        plan_ok = result["plan_linear_protocol"] and result["plans_dir"]
        templates_ok = result["mcp_hooks"] and result["mcp_templates"] and result["mmf_section"]

        is_pass = result["agents_symlink"] and result["precommit"] and result["claude_md"]
        if result["needs_templates"] and not templates_ok:
            is_pass = False
        if result["needs_plan_linear"] and not plan_ok:
            is_pass = False
        if (
            require_plan_semantics
            and result["needs_plan_linear"]
            and not result["plan_semantics"]
        ):
            is_pass = False
        if require_claude_quality and not result["claude_quality"]:
            is_pass = False
        if not is_pass:
            failures += 1

        sym = (
            "sym"
            if result["agents_symlink"]
            else ("file" if result["agents_exists"] else "MISS")
        )
        pre = "OK" if result["precommit"] else "MISS"
        cla = "OK" if result["claude_md"] else "MISS"
        pla = "OK" if plan_ok else ("n/a" if not result["needs_plan_linear"] else "MISS")
        clq = (
            "OK"
            if result["claude_quality"]
            else ("n/a" if not require_claude_quality else "MISS")
        )
        mmf = "OK" if result["mmf_section"] else ("n/a" if not result["needs_templates"] else "MISS")
        iss = str(len(result["issues"]))

        mark = " " if is_pass else "!"
        print(
            f"{mark} {result['name']:<33} {sym:>6} {pre:>6} {cla:>7} {pla:>5} {clq:>4} {mmf:>4} {iss:>6}"
        )

    total = len(results) - skipped
    passing = total - failures
    print(f"\n{'=' * 70}")
    print(f"Total: {total} active repos | Passing: {passing} | Failing: {failures} | Skipped: {skipped}")

    if failures > 0:
        print("\nFailing repos need: ~/scripts/onboard_repo.sh <repo-path>")

    return 0 if failures == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repo", nargs="?", help="Optional single repository path")
    parser.add_argument(
        "--require-plan-linear",
        action="store_true",
        help="Require mandatory Plan/Linear protocol markers in CLAUDE.md for all checked repos.",
    )
    parser.add_argument(
        "--require-plan-semantics",
        action="store_true",
        help="Require strict plan semantics readiness and passing plan lint.",
    )
    parser.add_argument(
        "--require-claude-quality",
        action="store_true",
        help="Require strict CLAUDE policy quality checks and passing policy lint.",
    )
    args = parser.parse_args()

    if args.repo:
        repo = Path(args.repo).resolve()
        result = check_repo(
            repo,
            active_only=False,
            require_plan_linear=args.require_plan_linear,
            require_plan_semantics=args.require_plan_semantics,
            require_claude_quality=args.require_claude_quality,
        )
        if result.get("skipped"):
            print(f"Skipped: {result.get('reason')}")
            return 0

        print(f"Repo: {result['name']}")
        print(f"  AGENTS.md symlink: {'YES' if result['agents_symlink'] else 'NO'}")
        print(f"  Pre-commit config: {'YES' if result['precommit'] else 'NO'}")
        print(f"  MCP hooks:         {'YES' if result['mcp_hooks'] else 'NO'}")
        print(f"  CLAUDE.md:         {'YES' if result['claude_md'] else 'NO'}")
        print(f"  Required sections: {'YES' if result['has_required_sections'] else 'NO'}")
        print(f"  Plan protocol:     {'YES' if result['plan_linear_protocol'] else 'NO'}")
        if result["needs_plan_linear"]:
            print(f"  docs/plans/:       {'YES' if result['plans_dir'] else 'NO'}")
        if args.require_plan_semantics and result["needs_plan_linear"]:
            print(f"  Plan template:     {'YES' if result['plan_template'] else 'NO'}")
            print(f"  Plan lint script:  {'YES' if result['plan_lint_script'] else 'NO'}")
            print(f"  Plan semantics:    {'YES' if result['plan_semantics'] else 'NO'}")
        if args.require_claude_quality:
            print(f"  CLAUDE lint script: {'YES' if result['claude_policy_lint_script'] else 'NO'}")
            print(f"  CLAUDE quality:    {'YES' if result['claude_quality'] else 'NO'}")
        if result["needs_templates"]:
            print(f"  MCP templates:     {'YES' if result['mcp_templates'] else 'NO'}")
            print(f"  mmf CLI section:   {'YES' if result['mmf_section'] else 'NO'}")
        if result["issues"]:
            print(f"\n  Issues ({len(result['issues'])}):")
            for issue in result["issues"]:
                print(f"    - {issue}")
        if result["warnings"]:
            print(f"\n  Warnings ({len(result['warnings'])}):")
            for warning in result["warnings"]:
                print(f"    - {warning}")
        return 0 if not result["issues"] else 1

    results = []
    seen_names = set()
    scan_dirs = [
        Path.home() / "Applications",
        Path.home() / "Dropbox" / "RomanCircus_Apps",
        Path.home() / "clawd",
        Path.home() / "repos",
        Path.home() / "Projects",
    ]

    for scan_dir in scan_dirs:
        if not scan_dir.exists():
            continue
        for directory in sorted(scan_dir.iterdir()):
            if not directory.is_dir():
                continue
            if not (directory / ".git").exists():
                continue
            if directory.name in seen_names:
                continue
            seen_names.add(directory.name)
            results.append(
                check_repo(
                    directory,
                    require_plan_linear=args.require_plan_linear,
                    require_plan_semantics=args.require_plan_semantics,
                    require_claude_quality=args.require_claude_quality,
                )
            )

    return print_results(
        results,
        require_plan_semantics=args.require_plan_semantics,
        require_claude_quality=args.require_claude_quality,
    )


if __name__ == "__main__":
    sys.exit(main())
