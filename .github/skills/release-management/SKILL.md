---
name: release-management
description: 'Use when: preparing release notes, validating publish steps, and coordinating final release actions.'
---

# Release Management

Draft notes, run dry-run validation, and require explicit approval before publish actions.

## Generated Release Notes

Before drafting release notes, check for `.github/release.yml`.

If `.github/release.yml` exists:

- Use GitHub-generated release notes so GitHub applies the configured changelog categories and exclusions.
- Verify `changelog.categories` is present and each category has `title` and `labels`.
- Verify `changelog.exclude.labels`, `changelog.exclude.authors`, category `exclude.labels`, and category `exclude.authors` are respected when present.
- Report the configured release categories and labels before publishing.
- Include pnpm-first install and update commands when package usage changes.
- Do not manually regroup pull requests in a way that conflicts with `.github/release.yml`.

If `.github/release.yml` does not exist, use GitHub-generated release notes with GitHub's default grouping and call out that no project release-note config was found.

## Package Usage Notes

Use pnpm as the first-class package manager in release notes. Prefer these commands:

```bash
pnpm dlx @jaychase/useful-workflow-kit init
pnpm dlx @jaychase/useful-workflow-kit@latest init --target . --force
```
