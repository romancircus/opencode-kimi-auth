# Plan: strict-agent-policy-recovery

Date: 2026-03-15
Owner: Codex
Status: In Progress

## Context and Objective

`opencode-kimi-auth` already had the root `AGENTS.md -> CLAUDE.md` link, but it was still missing the strict plan/lint/tooling contract now required by the machine-wide repo validator. The objective of this plan is to add the missing governance scaffold, replace the placeholder-heavy root policy with a repo-specific strict policy, and leave the repo passing strict compliance without losing the existing staged onboarding work.

## Success Criteria

1. `python3 scripts/plan_lint.py --all --require-files` passes in this repo.
2. `python3 scripts/claude_policy_lint.py --strict` passes in this repo.
3. `python3 scripts/validate_repo_compliance.py . --require-plan-linear --require-plan-semantics --require-claude-quality` passes in this repo.

## ASCII Diagram

```text
+---------------------------+
| Existing staged scaffold  |
+-------------+-------------+
              |
              v
+-------------+-------------+
| Root policy normalization |
| + plan/lint helper files  |
+-------------+-------------+
              |
              v
+-------------+-------------+
| Repo-specific plan file   |
| + validation evidence     |
+-------------+-------------+
              |
              v
+-------------+-------------+
| Commit + push onboarding  |
+---------------------------+
```

## Business Logic Specification

The repo-level agent contract should be strong enough that any coding agent can enter this repository and follow the same plan and policy workflow without guessing. This remediation makes the plugin repo auditable and easier to maintain by giving it the same strict policy and plan scaffold already used in the rest of the active fleet.

- Outcome: `opencode-kimi-auth` joins the strict fleet baseline instead of remaining a special-case failure.
- User impact: future repo work can rely on local plan/lint scripts and a repo-specific root policy instead of placeholder text.
- Acceptance checks:
  - the repo-local strict validator passes
  - the onboarding delta is committed separately from unrelated repo history

## Technical Implementation Plan

1. Update files/modules:
- `CLAUDE.md`
- `docs/plans/strict-agent-policy-recovery-2026-03-15.md`
- `scripts/plan_lint.py`
- `scripts/claude_policy_lint.py`
- `templates/plan.artifact.template.md`

2. Implementation notes:
- Preserve the existing staged onboarding-related files and add only the missing strict contract files.
- Keep `AGENTS.md` as a symlink to the root `CLAUDE.md`.
- Replace unresolved placeholders in the root policy with repo-specific guidance for the Kimi auth plugin.

3. Verification strategy:
- `python3 scripts/plan_lint.py --all --require-files`
- `python3 scripts/claude_policy_lint.py --strict`
- `python3 scripts/validate_repo_compliance.py . --require-plan-linear --require-plan-semantics --require-claude-quality`

## Executable Steps

| Step ID | Description | Business Outcome | Technical Deliverable | Linear Issue | State | Evidence | Last Updated |
|---|---|---|---|---|---|---|---|
| S1 | Add the missing strict scaffold and root policy | The repo gains the same strict governance baseline as the rest of the active fleet | `CLAUDE.md`, plan template, policy modules, local lint scripts | `ROM-1291` | Completed | onboarding scaffold applied and root policy rewritten with repo-specific guidance | 2026-03-16 00:01 |
| S2 | Validate, commit, and push the onboarding delta | The repo becomes an actual passing member of the strict fleet | validator output, repo commit, remote push | `ROM-1291` | In Progress | `python3 scripts/plan_lint.py --all --require-files`, `python3 scripts/claude_policy_lint.py --strict`, `python3 scripts/validate_repo_compliance.py . --require-plan-linear --require-plan-semantics --require-claude-quality`, and `npm run typecheck` passed | 2026-03-16 00:01 |

## Risks and Rollback

- Risk: the normalized root policy loses useful repo-specific context.
- Mitigation: keep the policy focused on the plugin entrypoint, token storage, and local build commands.
- Rollback: restore the previous root policy from git history if the strict version blocks normal plugin work.

## Handoff Snapshot

- Completed decisions: use the shared strict scaffold; keep the remediation mapped to `ROM-1291`; preserve staged onboarding work instead of resetting the repo.
- Open risks: none beyond normal remote push/auth failure risk for the final onboarding commit.
- Next command(s):
```bash
python3 scripts/plan_lint.py --all --require-files
```
