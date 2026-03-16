#!/usr/bin/env python3
"""
MCP Big Bang Migration - Custom Pre-commit Hooks
Prevents costly MCP anti-patterns and enforces architecture standards

Usage:
    python precommit_mcp_hooks.py <command> [files...]

Commands:
    block-comfyui-client    - Block comfyui_client imports (use mcp_adapter)
    block-direct-http       - Block requests/urllib in MCP server code
    detect-loops            - Flag MCP calls in loops >10 iterations
    check-commit            - Enforce commit message conventions
"""

import re
import sys
from pathlib import Path


def block_comfyui_client(files: list[str]) -> int:
    """Rule 1: Block comfyui_client imports."""
    errors = []
    pattern = re.compile(r'^\s*(from\s+comfyui_client|import\s+comfyui_client)')

    for filepath in files:
        path = Path(filepath)
        if not path.exists() or path.suffix != '.py':
            continue

        try:
            content = path.read_text()
            for i, line in enumerate(content.split('\n'), 1):
                if pattern.match(line):
                    errors.append(
                        f"{filepath}:{i}: BLOCKED - 'comfyui_client' import. "
                        "Use mcp_adapter or direct urllib API instead. "
                        "See CLAUDE.md MCP section."
                    )
        except Exception as e:
            print(f"Error reading {filepath}: {e}", file=sys.stderr)

    if errors:
        print("\n".join(errors))
        return 1
    return 0


def block_direct_http(files: list[str]) -> int:
    """Rule 2: Block direct HTTP imports in MCP server code."""
    errors = []
    # Match imports of requests or urllib
    import_pattern = re.compile(r'^\s*(import\s+(requests|urllib[0-9]*)|from\s+(requests|urllib[0-9]*)\s+import)')

    for filepath in files:
        path = Path(filepath)
        if not path.exists():
            continue

        try:
            content = path.read_text()
            for i, line in enumerate(content.split('\n'), 1):
                if import_pattern.match(line):
                    errors.append(
                        f"{filepath}:{i}: BLOCKED - Direct HTTP import '{line.strip()}'. "
                        "Allowed in scripts/ but blocked in MCP server code. "
                        "Use MCP tools for batch operations."
                    )
        except Exception as e:
            print(f"Error reading {filepath}: {e}", file=sys.stderr)

    if errors:
        print("\n".join(errors))
        return 1
    return 0


def detect_mcp_in_loops(files: list[str]) -> int:
    """Rule 3: Detect MCP calls inside loops with >10 iterations."""
    warnings = []

    # Pattern to match MCP function calls
    mcp_patterns = [
        re.compile(r'mcp__(\w+)__execute_workflow'),
        re.compile(r'mcp__(\w+)__regenerate'),
        re.compile(r'mcp__(\w+)__batch_execute'),
    ]

    # Pattern to match loops
    loop_patterns = [
        re.compile(r'^\s*for\s+\w+\s+in\s+range\((\d+)\)'),
        re.compile(r'^\s*for\s+\w+\s+in\s+range\((\d+),\s*(\d+)\)'),
        re.compile(r'^\s*while\s+'),
    ]

    for filepath in files:
        path = Path(filepath)
        if not path.exists() or path.suffix != '.py':
            continue

        try:
            content = path.read_text()
            lines = content.split('\n')
            in_loop = False
            loop_start = 0
            loop_iterations = 0

            for i, line in enumerate(lines, 1):
                # Check for loop start
                for pattern in loop_patterns:
                    match = pattern.match(line)
                    if match:
                        in_loop = True
                        loop_start = i
                        # Try to detect iteration count
                        groups = match.groups()
                        if len(groups) >= 1 and groups[0].isdigit():
                            loop_iterations = int(groups[0])
                        elif len(groups) >= 2 and groups[1].isdigit():
                            loop_iterations = int(groups[1])
                        break

                # Check for MCP calls in loops
                if in_loop and loop_iterations > 10:
                    for pattern in mcp_patterns:
                        if pattern.search(line):
                            warnings.append(
                                f"{filepath}:{i}: WARNING - MCP call in loop with {loop_iterations}+ iterations. "
                                "Use direct urllib API for batch operations to save tokens. "
                                "See CLAUDE.md 'MCP vs Direct API' section."
                            )
                            break

                # Simple loop end detection (decreased indent or blank line after loop body)
                if in_loop and i > loop_start:
                    # Check if we're outside the loop by indentation
                    if line.strip() and not line.startswith(' ') and not line.startswith('\t'):
                        in_loop = False
                        loop_iterations = 0

        except Exception as e:
            print(f"Error analyzing {filepath}: {e}", file=sys.stderr)

    if warnings:
        print("\n".join(warnings))
        # Return 0 but warn (allow override with --no-verify)
        return 0
    return 0


def check_commit_message() -> int:
    """Rule 4: Enforce commit message conventions."""
    commit_msg_file = Path('.git/COMMIT_EDITMSG')
    if not commit_msg_file.exists():
        # Not in commit context, skip
        return 0

    try:
        content = commit_msg_file.read_text()
        lines = content.split('\n')

        # Skip comments and empty lines to find actual message
        message_lines = [l for l in lines if not l.startswith('#') and l.strip()]
        if not message_lines:
            return 0

        first_line = message_lines[0]

        # Check conventional commit format
        valid_types = ['feat:', 'fix:', 'docs:', 'style:', 'refactor:',
                      'perf:', 'test:', 'chore:', 'ci:', 'build:']

        if not any(first_line.startswith(t) for t in valid_types):
            print(
                f"COMMIT MESSAGE ERROR: Must use conventional commit format.\n"
                f"  Current: {first_line}\n"
                f"  Required: <type>: <description>\n"
                f"  Valid types: {', '.join(t.rstrip(':') for t in valid_types)}\n"
                f"  Example: 'feat: Add batch video generation'"
            )
            return 1

        # Check line length
        if len(first_line) > 72:
            print(f"COMMIT MESSAGE WARNING: First line >72 chars ({len(first_line)})")
            return 0  # Warning only

    except Exception as e:
        print(f"Error reading commit message: {e}", file=sys.stderr)

    return 0


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]
    files = sys.argv[2:]

    if command == 'block-comfyui-client':
        sys.exit(block_comfyui_client(files))
    elif command == 'block-direct-http':
        sys.exit(block_direct_http(files))
    elif command == 'detect-loops':
        sys.exit(detect_mcp_in_loops(files))
    elif command == 'check-commit':
        sys.exit(check_commit_message())
    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == '__main__':
    main()
