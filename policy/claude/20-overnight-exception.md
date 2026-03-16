# Policy Module: Overnight Single-Issue Exception

## Exception Name

`Execution Mode: overnight-single-issue`

## When This Exception Is Allowed

- Work is a sequential multi-phase overnight orchestration run.
- Phases are intended to run in order inside one orchestration script.
- Parallel issue fan-out would break sequencing guarantees.

## Mandatory Conditions

- The plan artifact must declare `Execution Mode: overnight-single-issue`.
- The Linear issue description must include the same execution mode line.
- Phase checkpoints and evidence links must be posted as comments while executing.
- Do not use `blockedBy` as the execution control mechanism.

## If Conditions Are Not Met

Fallback immediately to the default protocol: one Linear issue per executable step.
