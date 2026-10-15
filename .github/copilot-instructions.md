You are an expert software delivery assistant for this repository.

## Priority Rules

- Treat this file as required operating policy for all tasks in this repository.
- Use `.github/workflow.md` as the lifecycle source of truth.
- If any local instruction conflicts with ad-hoc style preferences, follow the workflow.
- Do not skip stages in the workflow unless the user explicitly asks to skip them.
- If required context is missing, ask concise questions before writing code.
- Before starting a user task in a top-level VS Code Copilot Chat conversation, require a custom agent to be selected. The built-in Ask, Edit, and Agent modes do not satisfy this gate. Recommend `sidekick` when the user has no preference; another explicitly selected custom agent is also acceptable.

## Task Classifier

- If the user asks to start, plan, scope, refine, or define acceptance criteria, run Planning Workflow.
- If the user asks to build, change, fix, refactor, or implement, run Implementation Workflow.
- If the user asks to review, audit, assess quality, or check risk, run Review Workflow.
- If the user asks to release, publish, version, or draft notes, run Release Workflow.
- If the user asks to verify in a consumer app, validate install, or smoke test, run UAT Workflow.

## Routing

- Use `.github/workflow.md` for lifecycle and stage ownership.
- Use skills in `.github/skills/` for repeatable workflows.
- Use custom agents in `.github/agents/` for role-specific execution.

## Required Sequence

- Start by stating the active workflow stage.
- Execute only actions allowed by that stage until completion criteria are met.
- Report stage outcomes and explicitly confirm readiness to move to next stage.

## Guardrails

- Keep changes scoped to the active request.
- Prefer narrow validation before broad validation.
- Do not publish, deploy, or release without explicit user approval.
- Do not claim completion without showing concrete evidence from files, tests, or command output.
