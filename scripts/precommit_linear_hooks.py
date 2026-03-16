#!/usr/bin/env python3
"""
Linear Enforcement Pre-commit Hooks
Enforces LINEAR-FIRST OPERATING MANDATE from AGENTS.md

Usage:
    python precommit_linear_hooks.py <command> [args...]

Commands:
    check-linear            - Check if commit references Linear task
    check-commit-msg        - Validate commit message references Linear (commit-msg stage)
    enforce-task-exists     - Block if no Linear task file exists
"""

import sys
import re
import os
from pathlib import Path

# Path to Linear task tracking file
LINEAR_TASK_FILE = Path("/tmp/current-linear-task.txt")

# Pattern to match Linear issue IDs in commit messages
LINEAR_ID_PATTERN = re.compile(r"ROM-\d+", re.IGNORECASE)

# Whitelisted commit message patterns (maintenance commits that don't need Linear)
WHITELIST_PATTERNS = [
    # Standard commit types (no Linear required for maintenance)
    re.compile(r"^(chore|style|ci|test|docs|refactor|perf|build):", re.IGNORECASE),
    # Merge operations (handled by git)
    re.compile(r"^Merge (branch|pull request|PR)"),
    re.compile(r"^Revert"),
    re.compile(r"^fixup!"),
    re.compile(r"^squash!"),
    # Special markers
    re.compile(r"^Initial commit", re.IGNORECASE),
    re.compile(r"^WIP:", re.IGNORECASE),
    re.compile(r"^DRAFT:", re.IGNORECASE),
    re.compile(r"^HOTFIX:", re.IGNORECASE),
    re.compile(r"^EMERGENCY:", re.IGNORECASE),
    # Already has Linear reference tags
    re.compile(r"^[\[\(]?linear[\]\)]", re.IGNORECASE),
    re.compile(r"^[\[\(]?rom-\d+[\]\)]", re.IGNORECASE),
    # Common maintenance patterns
    re.compile(r"^Bump version", re.IGNORECASE),
    re.compile(r"^Release", re.IGNORECASE),
    re.compile(r"^Tag v?\d+", re.IGNORECASE),
    # GitHub/CI generated commits
    re.compile(r"^Auto-merge"),
    re.compile(r"^Dependabot"),
    re.compile(r"^[Bb]ot:", re.IGNORECASE),
]


def check_commit_message(msg_file: str) -> int:
    """
    Check if commit message references a Linear task.
    Called at commit-msg stage.
    """
    try:
        with open(msg_file, "r") as f:
            commit_msg = f.read()
    except Exception as e:
        print(f"ERROR: Cannot read commit message file: {e}", file=sys.stderr)
        return 1

    # Check for Linear ID in message
    linear_matches = LINEAR_ID_PATTERN.findall(commit_msg)

    # Check if whitelisted
    for pattern in WHITELIST_PATTERNS:
        if pattern.match(commit_msg.strip()):
            return 0  # Allow whitelisted commits

    if linear_matches:
        # Has Linear reference - good!
        print(f"Linear task referenced: {', '.join(linear_matches)}")
        return 0
    else:
        # No Linear reference - warn but allow (for interactive commits)
        print(
            "WARNING: Commit message does not reference a Linear task (ROM-XXX)",
            file=sys.stderr,
        )
        print(
            "   MANDATORY: Create Linear task before starting work:",
            file=sys.stderr,
        )
        print(
            "      ~/.clawdbot/scripts/linear/create-issue.sh --title 'Task' --team 'YourTeam'",
            file=sys.stderr,
        )
        print("   Or add [ROM-XXX] to your commit message", file=sys.stderr)

        # Check if there's a current Linear task file
        if LINEAR_TASK_FILE.exists():
            task_id = LINEAR_TASK_FILE.read_text().strip()
            print(f"   Current Linear task: {task_id}", file=sys.stderr)
            print(
                f"      Run: ~/.clawdbot/scripts/linear/update-issue.sh {task_id} --state 'Done'",
                file=sys.stderr,
            )

        # BLOCK commits without Linear reference (STRICT MODE)
        # To bypass in emergencies: git commit --no-verify -m "message"
        return 1


def enforce_task_exists() -> int:
    """
    Enforce that a Linear task exists before committing.
    Called at pre-commit stage.
    """
    # Check for Linear task file
    if LINEAR_TASK_FILE.exists():
        task_id = LINEAR_TASK_FILE.read_text().strip()
        print(f"Linear task active: {task_id}")
        return 0

    # Check if we're in a worktree (worktrees should have Linear context)
    git_dir = Path(".git")
    if git_dir.exists():
        try:
            git_config = git_dir / "config"
            if git_config.exists():
                config_content = git_config.read_text()
                # Check if this is a jinyang worktree (which has Linear context)
                if "jinyang" in config_content or "worktree" in config_content:
                    # Worktrees are managed by jinyang with Linear context
                    return 0
        except Exception:
            pass

    # Check if repo has AGENTS.md with Linear mandate
    agents_md = Path("AGENTS.md")
    if agents_md.exists():
        try:
            content = agents_md.read_text()
            if "LINEAR-FIRST" in content or "Linear" in content:
                # Repo uses Linear - check for task
                print("WARNING: No active Linear task found", file=sys.stderr)
                print(
                    "   LINEAR-FIRST MANDATE: Create task before committing:",
                    file=sys.stderr,
                )
                print(
                    "      ~/.clawdbot/scripts/linear/create-issue.sh --title 'Task' --team 'YourTeam'",
                    file=sys.stderr,
                )
                # Allow but warn
                return 0
        except Exception:
            pass

    return 0


def check_linear_status() -> int:
    """
    Check Linear integration status and provide helpful info.
    """
    print("Linear Enforcement Check")
    print("=" * 50)

    # Check Linear task file
    if LINEAR_TASK_FILE.exists():
        task_id = LINEAR_TASK_FILE.read_text().strip()
        print(f"Active Linear task: {task_id}")
        print(
            f"   Update: ~/.clawdbot/scripts/linear/update-issue.sh {task_id} --state 'Done'"
        )
    else:
        print("No active Linear task")
        print(
            "   Create: ~/.clawdbot/scripts/linear/create-issue.sh --title 'Task' --team 'YourTeam'"
        )

    # Check Linear API
    linear_api_key = os.environ.get("LINEAR_API_KEY", "")
    if not linear_api_key:
        env_file = Path("~/.clawdbot/.env").expanduser()
        if env_file.exists():
            try:
                content = env_file.read_text()
                if "LINEAR_API_KEY" in content:
                    linear_api_key = "found in ~/.clawdbot/.env"
            except Exception:
                pass

    if linear_api_key:
        print("Linear API key configured")
    else:
        print("Linear API key not found")

    print("=" * 50)
    return 0


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    command = sys.argv[1]
    args = sys.argv[2:]

    if command == "check-linear":
        return check_linear_status()
    elif command == "check-commit-msg":
        if not args:
            print("Usage: check-commit-msg <commit-msg-file>", file=sys.stderr)
            return 1
        return check_commit_message(args[0])
    elif command == "enforce-task-exists":
        return enforce_task_exists()
    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        print(__doc__)
        return 1


if __name__ == "__main__":
    sys.exit(main())
