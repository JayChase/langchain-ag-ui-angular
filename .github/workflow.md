# Project Agent Workflow

This file is the canonical workflow reference for planning, implementing, reviewing, releasing, and UAT verification.

## Start Here (Kickoff)

1. Ensure a GitHub issue exists for the requested change.
2. Capture goals, non-goals, and acceptance criteria in the issue.
3. Confirm constraints, dependencies, and rollback expectations.
4. Select the active stage and report it before taking action.

## Stage Exit Rules

1. Planning exits only when acceptance criteria are explicit and testable.
2. Implementation exits only when changes are validated at narrow scope.
3. Review exits only when findings are documented and addressed or accepted.
4. Release exits only after dry-run checks and explicit approval.
5. UAT exits only after consumer install and smoke checks pass.

## Planning Workflow

1. Ensure a GitHub issue exists.
2. Use PRD templates and planning prompts.
3. Confirm acceptance criteria and non-goals.

## Implementation Workflow

1. Follow TDD for behavior changes when practical.
2. Validate narrow scope first.
3. Keep changes scoped to the issue.

## Review Workflow

1. Lead with findings ordered by severity.
2. Check docs impact.
3. Raise backlog follow-ups for improvements and risks.

## Release Workflow

1. Check whether `.github/release.yml` exists before drafting notes.
2. Generate release notes through GitHub so `.github/release.yml` categories, labels, and exclusions are applied.
3. Include pnpm-first install and update commands when package usage changes.
4. Confirm the generated notes reflect the configured release categories before publish.
5. Run dry-run publish before real publish.
6. Publish only with explicit approval.

## UAT Workflow

1. Create a clean consumer app outside the repo.
2. Install latest published packages.
3. Run install/build/type/runtime smoke checks.
4. Report failures with minimal repro steps.
