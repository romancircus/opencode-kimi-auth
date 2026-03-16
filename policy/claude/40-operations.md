# Policy Module: Operations and Portability

## Intent-First Rule

Write policy in terms of required outcomes first, then provide tool-specific adapters as examples.

## Adapter Style

- Prefer: "update issue status in Linear and add evidence comment."
- Avoid: hard-coding a single tool API as the only valid implementation path.

Example adapter table:

| Outcome | Claude/Codex/OpenCode Adapter |
|---|---|
| Update Linear state | Use workspace Linear integration to set state + comment with evidence |
| Validate plan contract | `python3 scripts/plan_lint.py --all --require-files` |
| Validate policy quality | `python3 scripts/claude_policy_lint.py --strict` |

## Volatile Heuristics

- Token/cost guidance is heuristic, not absolute.
- Add timestamp when quoting numeric heuristics.
- Last verified in this repository: 2026-03-04.
