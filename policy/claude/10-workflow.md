# Policy Module: Plan and Linear Workflow

## Mandatory Sequence for Non-Trivial Work

1. Create or update `docs/plans/<slug>-<YYYY-MM-DD>.md`.
2. Decompose implementation into executable steps.
3. Default issue strategy: one Linear issue per executable step.
4. Add plan path in each Linear issue description.
5. Keep plan + Linear synchronized while executing:
   - update step status in plan,
   - update status/comments in Linear,
   - capture evidence paths and timestamps.
6. Do not offload manual Linear updates to the user.

## Exception Gate

Single-issue execution is allowed only when `Execution Mode: overnight-single-issue` is explicitly declared and all exception requirements are met.

## Linear Outage Fallback

When Linear is unavailable or degraded, queue state mutations locally and replay when connectivity returns:

```bash
python3 scripts/linear_outbox_append.py --issue ROM-123 --op create_comment --payload '{"body":"status update"}'
python3 scripts/linear_flush_outbox.py --backend auto
```
