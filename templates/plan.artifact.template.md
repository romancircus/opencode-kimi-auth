# Plan: <slug-title>

Date: <YYYY-MM-DD>
Owner: <owner>
Status: Planned

## Context and Objective

<why this work matters and the objective in concrete terms>

## Success Criteria

1. <measurable success criterion>
2. <measurable success criterion>

## ASCII Diagram

```text
+---------------------------+
| Input / Trigger           |
+-------------+-------------+
              |
              v
+-------------+-------------+
| Business Logic Decision   |
+-------------+-------------+
              |
              v
+-------------+-------------+
| Technical Implementation  |
+-------------+-------------+
              |
              v
+-------------+-------------+
| Verification + Evidence   |
+---------------------------+
```

## Business Logic Specification

Describe the business intent in plain language so reviewers can verify the change is valuable, not only technically correct. Explain who benefits, how behavior changes, and what observable result proves success.

- Outcome: <business result this step should produce>
- User impact: <who is affected and how>
- Acceptance checks:
  - <observable check>
  - <observable check>

## Technical Implementation Plan

1. Update files/modules:
- `<path/to/file>`
- `<path/to/file>`

2. Implementation notes:
- <interfaces, data contracts, edge cases>
- <failure modes, fallback behavior, and rollback constraints>

3. Verification strategy:
- <tests/lint/build/validation commands>
- <what evidence artifact is generated and where it is stored>

## Executable Steps

| Step ID | Description | Business Outcome | Technical Deliverable | Linear Issue | State | Evidence | Last Updated |
|---|---|---|---|---|---|---|---|
| S1 | <step description> | <business result> | `<file or module change>` | `ROM-000` | Planned | `<path/to/evidence>` | <YYYY-MM-DD HH:MM> |

## Risks and Rollback

- Risk: <what can fail>
- Mitigation: <how risk is reduced>
- Rollback: <how to revert safely>

## Handoff Snapshot

- Completed decisions: <list>
- Open risks: <list>
- Next command(s):
```bash
<command>
```
