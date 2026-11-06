#!/usr/bin/env python3
"""Hard-fail linter for CLAUDE.md policy quality."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

REQUIRED_HEADINGS = [
    "Cross-Agent Compliance",
    "Project Goal",
    "Planning Communication",
    "Instruction Precedence",
    "Security Guardrails",
    "Policy Modules",
    "Development Workflow",
]
SCOPED_REQUIRED_HEADINGS = [
    "Scope",
    "Local Constraints",
    "Local Commands",
    "Safety Notes",
]

PLACEHOLDER_PATTERNS = [
    r"\[1-2 sentence description of repo purpose\]",
    r"\[Describe key directories and files\]",
    r"\[test commands\]",
    r"\[build commands\]",
    r"\[Document institutional knowledge here as it accumulates\]",
    r"\[REPO_NAME\]",
    r"\[DATE\]",
]

ROOT_LINE_LIMIT = 220
# Kept in step with surfaces.scoped_agents.hard_cap in policy/instruction-topology.json.
# Raised 100 -> 120 on 2026-08-09: a scoped AGENTS.md must embed the 20-line
# DELIVERABLE_REVIEW_HANDOFF block verbatim (validate_machine_agent_stack.py asserts those
# markers), so the old limit conflicted with a hard validator requirement and could only have
# been satisfied by deleting operational content.
SCOPED_LINE_LIMIT = 120
# The plan protocol lives in the machine root policy (WORKFLOW_PROTOCOL.md). A repo or
# scoped file must not carry its own copy. The Plan-Linear names were retired with
# Linear on 2026-11-05; a repo file that still carries them is a regression.
RETIRED_PROTOCOL_HEADINGS = (
    "Mandatory Plan-to-Linear Protocol",
    "MANDATORY PLAN-LINEAR EXECUTION PROTOCOL",
)
ROOT_PROTOCOL_HEADINGS = RETIRED_PROTOCOL_HEADINGS + ("MANDATORY PLAN EXECUTION PROTOCOL",)
IMPORT_PATTERN = re.compile(r"@([A-Za-z0-9_./-]+\.md)")
POLICY_VERSION_PATTERN = re.compile(r"^POLICY_VERSION:\s+\d{4}-\d{2}-\d{2}$", re.MULTILINE)
RUNTIME_REQUIRED_SECTIONS = {
    "Communication Standard": (
        "<!-- COMMUNICATION_STANDARD_START -->",
        "<!-- COMMUNICATION_STANDARD_END -->",
    ),
    "Decision Support Standard": (
        "<!-- DECISION_SUPPORT_STANDARD_START -->",
        "<!-- DECISION_SUPPORT_STANDARD_END -->",
    ),
    "Execution Standard": (
        "<!-- EXECUTION_STANDARD_START -->",
        "<!-- EXECUTION_STANDARD_END -->",
    ),
    "Verification Standard": (
        "<!-- VERIFICATION_STANDARD_START -->",
        "<!-- VERIFICATION_STANDARD_END -->",
    ),
}
RUNTIME_REQUIRED_PHRASES = {
    "Decision Support Standard": [
        "cost, speed, risk, revenue, scalability, operations, customer impact, and competitive advantage",
        "rollback path",
    ],
    "Execution Standard": [
        "State decision-critical assumptions",
        "Surface material ambiguity and tradeoffs",
        "smallest working solution",
        "Every changed line should trace directly to the user request",
    ],
    "Verification Standard": [
        "explicit success criteria",
        "Pair each implementation step with a verification check",
        "what changed, why it changed, how it was verified, and what remains unresolved",
    ],
}


@dataclass
class LintResult:
    path: Path
    errors: list[str]


def _discover_candidates(repo_root: Path, file_args: list[str]) -> list[Path]:
    if file_args:
        paths = []
        for item in file_args:
            candidate = Path(item)
            if not candidate.is_absolute():
                candidate = repo_root / candidate
            if candidate.exists():
                paths.append(candidate.resolve())
        return paths

    defaults = [
        repo_root / "CLAUDE.md",
        repo_root / "templates" / "CLAUDE.md.template",
        repo_root / "templates" / "CLAUDE.md.template.macos",
        repo_root / "templates" / "AGENTS.scoped.template.md",
    ]
    return [path.resolve() for path in defaults if path.exists()]


def _is_template(path: Path) -> bool:
    return "template" in path.name.lower()


def _missing_headings(text: str) -> list[str]:
    missing = []
    for heading in REQUIRED_HEADINGS:
        if f"## {heading}" not in text:
            missing.append(heading)
    return missing


def _missing_scoped_headings(text: str) -> list[str]:
    missing = []
    for heading in SCOPED_REQUIRED_HEADINGS:
        if f"## {heading}" not in text:
            missing.append(heading)
    return missing


def _extract_h2_section(text: str, heading: str) -> str | None:
    """Return content under an H2 heading until the next H2 heading."""
    heading_re = re.compile(rf"^##\s+{re.escape(heading)}\s*$", re.MULTILINE)
    match = heading_re.search(text)
    if not match:
        return None

    section_start = match.end()
    next_h2 = re.search(r"^##\s+", text[section_start:], re.MULTILINE)
    section_end = section_start + next_h2.start() if next_h2 else len(text)
    return text[section_start:section_end]


def _is_scoped_policy(path: Path, repo_root: Path) -> bool:
    if path.name == "AGENTS.scoped.template.md":
        return True
    if path.name == "AGENTS.md" and path.parent != repo_root:
        return True
    return False


def _runtime_policy_errors(repo_root: Path) -> list[str]:
    runtime_dir = repo_root / "policy" / "runtime"
    if not runtime_dir.exists():
        return []

    module_text = "\n".join(
        path.read_text(encoding="utf-8", errors="replace")
        for path in sorted(runtime_dir.glob("*.md"))
    )
    errors: list[str] = []

    for heading, (start_marker, end_marker) in RUNTIME_REQUIRED_SECTIONS.items():
        start_count = module_text.count(start_marker)
        end_count = module_text.count(end_marker)
        heading_count = len(
            re.findall(rf"^##\s+{re.escape(heading)}\s*$", module_text, re.MULTILINE)
        )

        if start_count != 1:
            errors.append(f"{heading} start marker must appear exactly once ({start_count} found)")
        if end_count != 1:
            errors.append(f"{heading} end marker must appear exactly once ({end_count} found)")
        if heading_count != 1:
            errors.append(f"## {heading} must appear exactly once ({heading_count} found)")

    for section, phrases in RUNTIME_REQUIRED_PHRASES.items():
        for phrase in phrases:
            if phrase not in module_text:
                errors.append(f"{section} missing required phrase: {phrase}")

    return errors


def _lint_file(path: Path, repo_root: Path, strict: bool) -> LintResult:
    errors: list[str] = []
    text = path.read_text(encoding="utf-8", errors="replace")
    template_mode = _is_template(path)
    scoped_mode = _is_scoped_policy(path, repo_root)

    if scoped_mode:
        missing = _missing_scoped_headings(text)
        if missing:
            errors.append(f"missing scoped heading(s): {', '.join(missing)}")
    else:
        missing = _missing_headings(text)
        if missing:
            errors.append(f"missing required heading(s): {', '.join(missing)}")

    if strict and not scoped_mode:
        if not POLICY_VERSION_PATTERN.search(text):
            errors.append("missing or invalid POLICY_VERSION date (expected YYYY-MM-DD)")

        for heading in RETIRED_PROTOCOL_HEADINGS:
            if _extract_h2_section(text, heading) is not None:
                errors.append(
                    f"retired section '## {heading}' present (Linear retired 2026-11-05); "
                    "the plan protocol lives in the machine root policy. Remove it with "
                    "scripts/remove_retired_linear_block.py"
                )

        imports = sorted(set(IMPORT_PATTERN.findall(text)))
        if not imports:
            errors.append("Policy Modules section must reference @... imports")
        for imp in imports:
            imp_path = (repo_root / imp).resolve()
            if not imp_path.exists():
                errors.append(f"missing imported policy module: {imp}")

    if (
        scoped_mode
        and strict
        and any(f"## {heading}" in text for heading in ROOT_PROTOCOL_HEADINGS)
    ):
        errors.append("scoped AGENTS.md must not redefine the root plan protocol")

    if not template_mode:
        for pattern in PLACEHOLDER_PATTERNS:
            if re.search(pattern, text):
                errors.append(f"contains unresolved placeholder matching pattern: {pattern}")

        if path.name == "CLAUDE.md" and strict and not scoped_mode:
            line_count = len(text.splitlines())
            if line_count > ROOT_LINE_LIMIT:
                errors.append(f"root CLAUDE.md exceeds {ROOT_LINE_LIMIT} lines ({line_count})")
        if scoped_mode and strict:
            line_count = len(text.splitlines())
            if line_count > SCOPED_LINE_LIMIT:
                errors.append(f"scoped AGENTS.md exceeds {SCOPED_LINE_LIMIT} lines ({line_count})")

    return LintResult(path=path, errors=errors)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="*", help="Specific policy files to lint")
    parser.add_argument("--repo-root", default=".", help="Repository root path")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Enable strict checks: imports, contradiction checks, line limits",
    )
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    candidates = _discover_candidates(repo_root, args.files)
    if not candidates:
        print("claude_policy_lint: no candidate files found", file=sys.stderr)
        return 1

    has_error = False
    for candidate in candidates:
        result = _lint_file(candidate, repo_root=repo_root, strict=args.strict)
        if result.errors:
            has_error = True
            rel = (
                result.path.relative_to(repo_root)
                if result.path.is_relative_to(repo_root)
                else result.path
            )
            print(f"{rel}:")
            for err in result.errors:
                print(f"  - {err}")

    if args.strict:
        runtime_errors = _runtime_policy_errors(repo_root)
        if runtime_errors:
            has_error = True
            print("policy/runtime:")
            for err in runtime_errors:
                print(f"  - {err}")

    return 1 if has_error else 0


if __name__ == "__main__":
    sys.exit(main())
