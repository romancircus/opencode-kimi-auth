# Policy Module: Plan Workflow

## Mandatory Sequence for Non-Trivial Work

1. Create or update `docs/plans/<slug>-<YYYY-MM-DD>.md` and declare `Plan-Contract-Version: 2`.
2. Decompose implementation into executable steps in that plan (git is the log).
3. Keep each step's status in the plan's step table and commit it at checkpoints so any session can resume.
4. Record evidence under `docs/evidence/` and reference it from the step table.
5. The plan artifact in git is the program record. There is no external tracker: do not open, update or sync tracker issues, and do not ask the user to.

## Source of Truth

The machine root policy (`policy/WORKFLOW_PROTOCOL.md` in agent-infrastructure, built into every agent's global instructions) carries the full protocol and the plan artifact contract. Validate plans with `python3 scripts/plan_lint.py --all --require-files`.
