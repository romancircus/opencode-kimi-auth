# Policy Module: Instruction Precedence

## Purpose

Define deterministic instruction resolution so implementers do not guess when directives conflict.

## Order

1. Runtime system/developer directives from the active environment.
2. Nearest scoped instruction file relative to changed files.
3. Repository root `CLAUDE.md` and imported policy modules.
4. User instructions consistent with higher-level policy.

## Conflict Resolution

- Higher-precedence instruction overrides lower-precedence instruction.
- If two instructions are at the same level, nearest scope wins.
- If ambiguity remains after scope comparison, use the safer behavior and record the assumption.

## Required Behavior

- Do not ignore conflicts; resolve and document them explicitly.
- Do not silently mix contradictory directives.
