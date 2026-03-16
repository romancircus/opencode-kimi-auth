# Policy Module: ComfyUI and Media Generation

## Applicability

Apply this module only when the target repository uses ComfyUI generation workflows.

## Default Guidance

- Prefer `mmf` CLI workflows for common generation tasks.
- Use direct API/template execution for large orchestrated runs when required by environment constraints.
- Keep generation prompts, model presets, and output paths deterministic and reproducible.

## Safety and Cost Controls

- Use bounded batch sizes unless explicitly instructed otherwise.
- Prefer blocking completion APIs over aggressive polling loops.
- Record generated artifact evidence paths in issue comments and plan files.
