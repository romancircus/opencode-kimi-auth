# Claude Code Instructions for opencode-kimi-auth

POLICY_VERSION: 2026-02-11

## Cross-Agent Compliance

AGENTS.md is symlinked to this file. This ensures Claude Code, Codex, and other agents all read the same instructions. Do not break this symlink.

**Critical guardrails**:
- **Token cost**: Blocking wait ($0.20) vs polling loop ($20-40) = 100x savings
- **MCP vs Direct API**: <10 workflows use MCP, >10 use templates + urllib
- **Pre-commit hooks**: Automatically block anti-patterns (git-enforced)

---

## PROJECT GOAL

[1-2 sentence description of repo purpose]

---

## Execution Tasks

**For multi-phase overnight work, use the jinyang orchestration pattern.**
Canonical orchestration root is `~/.jinyang` (legacy `~/.cyrus` aliases should be normalized to `~/.jinyang`).

### Quick Start

1. **Copy template:**
   ```bash
   cp ~/.jinyang/templates/execution_script_template.py scripts/<task_name>_execute.py
   ```

2. **Implement phases** as `OrchestrationScript` subclass

3. **Create Linear issue** from template:
   ```bash
   cat ~/.jinyang/templates/linear_execution_issue.md
   ```

4. **Validate before delegating:**
   ```bash
   python ~/.jinyang/scripts/validate_execution_issue.py ROM-XXX
   ```

5. **Delegate to jinyang** — execution happens automatically
   ```
   mcp__linear__update_issue(issue_id, delegate="jinyang")
   ```

### Resources

- **Template:** `~/.jinyang/templates/execution_script_template.py`
- **Docs:** `~/.jinyang/docs/EXECUTION_PATTERN.md`
- **Issue template:** `~/.jinyang/templates/linear_execution_issue.md`

**DON'T:** Create multiple Linear issues with `blockedBy` (doesn't auto-trigger)
**DO:** Single issue, single orchestration script, all phases sequential

---

## Project Structure

```
[Describe key directories and files]
```

---

## Development Workflow

### Testing
```bash
[test commands]
```

### Building
```bash
[build commands]
```

---

<!-- Remove this section if repo does not use ComfyUI -->
## ComfyUI Generation (mmf CLI)

**All ComfyUI generation uses the `mmf` CLI.** One command replaces 3+ MCP calls with 0 schema overhead.

```bash
mmf run --model flux --type t2i --prompt "your prompt" -o output.png
mmf run --model wan --type i2v --image keyframe.png --prompt "gentle motion" -o video.mp4
mmf pipeline i2v --image keyframe.png --prompt "breathing" -o video.mp4
mmf batch dir --input keyframes/ --template wan26_img2vid --prompt "motion" --output videos/
```

| Need | Command |
|------|---------|
| Single image/video | `mmf run` |
| Pre-tested multi-stage | `mmf pipeline` (i2v, upscale, viral-short) |
| Batch (<50) | `mmf batch seeds` or `mmf batch dir` |
| Batch (>50) / jinyang | Local templates + urllib (see CLAUDE.md in hub repo) |

For the `/mmf` skill and full reference: `~/.claude/skills/mmf/SKILL.md`
<!-- End ComfyUI section -->

---

## Hard-Won Lessons

[Document institutional knowledge here as it accumulates]

---

*Last updated: 2026-02-11*

---

## Mandatory Plan-to-Linear Protocol

For non-trivial work, this sequence is required:

1. Create or update a plan file at `docs/plans/<slug>-<YYYY-MM-DD>.md`.
2. Break work into executable steps.
3. Create one Linear issue per executable step.
4. Link the plan path in each Linear issue.
5. Keep plan + Linear in sync as execution progresses.
6. Never ask the user to do manual Linear operations.

Linear outage fallback:
- If Linear is down/rate-limited, queue changes and continue execution:
  - `python3 scripts/linear_outbox_append.py ...`
  - `python3 scripts/linear_flush_outbox.py --backend auto`
