---
name: angular-insights-setup
description: 'Scaffold a custom Angular ErrorHandler backed by Application Insights, using the Angular CLI. Produces an InsightsService that implements ErrorHandler to centralize error handling and telemetry logging. Use when: adding Application Insights, App Insights, telemetry, or error logging to an Angular app; implementing a custom ErrorHandler; wiring up @microsoft/applicationinsights-web; creating an insights service, insights library, or InsightsService; "add insights logger", "set up app insights", "track events/errors in Angular". Supports both npm and pnpm, and both in-app and standalone-library setups.'
---

# Angular Insights Setup

Scaffolds an `InsightsService` (Application Insights wrapper implementing `ErrorHandler`) into a
fresh or existing Angular project, using the Angular CLI wherever a schematic exists. Mirrors the
pattern in [projects/insights](../../../ui/projects/insights/src/lib) of this repo.

## When to Use

- A new Angular app needs App Insights telemetry + global error logging.
- A new shared library should host the insights logic for reuse across apps (this repo's pattern).
- User asks to "add insights", "add app insights logging", "create InsightsService".

## Step 1 — Clarify Target

Ask (if not already stated):

1. **Package manager**: npm or pnpm?
2. **Target**: install directly into an existing app (`projects/<app>/src/app`), or scaffold a
   new standalone library (`projects/<lib-name>`) like `projects/insights` in this repo?
3. If library: the **library name** (default `insights`) and which app(s) will consume it.
4. **`@angular/cdk` dependency**: is `@angular/cdk` already a dependency (or acceptable to add)?
   - Yes → use [assets/insights.service.ts](./assets/insights.service.ts), which detects the
     browser via `Platform` from `@angular/cdk/platform` (matches this repo's `projects/insights`).
   - No → use [assets/insights.service.no-cdk.ts](./assets/insights.service.no-cdk.ts) instead,
     which falls back to `isPlatformBrowser(inject(PLATFORM_ID))` from `@angular/common` (no CDK
     dependency required). Rename it to `insights.service.ts` when copying.

## Step 2 — Install Dependencies

Run [scripts/install-dependencies.sh](./scripts/install-dependencies.sh) with the chosen package
manager and optional workspace filter. It installs the latest versions, including `@microsoft/dynamicproto-js` which is required at runtime by `@microsoft/applicationinsights-angularplugin-js`:

```bash
# Standalone app:
./scripts/install-dependencies.sh npm
# or
./scripts/install-dependencies.sh pnpm

# Monorepo / workspace:
./scripts/install-dependencies.sh pnpm app
```

If scaffolding a **library**, also add both packages as `peerDependencies` in the generated
`projects/<lib-name>/package.json` (see Step 3b) so consuming apps supply the versions.

## Step 3a — Target: Existing App

Run [scripts/scaffold-app.sh](./scripts/scaffold-app.sh) from the workspace root. If running in a
monorepo where `angular.json` is in a subdirectory (e.g. `packages/app`), pass that directory as
the second argument:

```bash
./scripts/scaffold-app.sh <app-name> [angular-workspace-dir]

# Monorepo example:
./scripts/scaffold-app.sh demo packages/app
```

This runs `ng generate service --flat false insights` and `ng generate interface` for the config
type. There is no CLI schematic for injection tokens, the config union type, or provider factory
functions — copy the remaining files from [assets/](./assets/) into the generated `insights/`
folder next to the service:

- [assets/insights-config.ts](./assets/insights-config.ts) (replaces the generated interface —
  it's a union type, not a plain interface)
- [assets/insights-config.token.ts](./assets/insights-config.token.ts)
- [assets/insights.service.ts](./assets/insights.service.ts) or
  [assets/insights.service.no-cdk.ts](./assets/insights.service.no-cdk.ts) per the choice made in
  Step 1 (replaces the generated service; rename the no-cdk variant to `insights.service.ts`)
- [assets/provide-insights.ts](./assets/provide-insights.ts)

Wire it into `app.config.ts`:

```ts
providers: [
  provideInsights({
    connectionString: environment.appInsights.connectionString,
    logLevel: environment.appInsights.logLevel,
  }),
  // ...other providers
];
```

## Step 3b — Target: New Library

Run [scripts/scaffold-library.sh](./scripts/scaffold-library.sh) from the workspace root:

```bash
./scripts/scaffold-library.sh <lib-name>
```

This uses the Angular CLI to create `projects/<lib-name>/` (`ng generate library`) with
`ng-package.json`, `package.json`, `public-api.ts`, and `tsconfig.*.json` already wired into
`angular.json`, then generates the service and config interface inside it.

Copy the same files listed in Step 3a from [assets/](./assets/) into
`projects/<lib-name>/src/lib`, then update `projects/<lib-name>/src/public-api.ts`:

```ts
export * from './lib/insights-config';
export * from './lib/insights-config.token';
export * from './lib/insights/insights.service';
export * from './lib/provide-insights';
```

Add the two Application Insights packages as `peerDependencies` in
`projects/<lib-name>/package.json` (match the `@angular/core` peer range already present).

Note: [assets/insights.service.ts](./assets/insights.service.ts) and
[assets/provide-insights.ts](./assets/provide-insights.ts) import `../insights-config` — adjust the
relative paths if `ng generate` placed files differently than this layout.

`INSIGHTS_CONFIG` is injected via `deps` in `provideInsights` (not a closure over the outer
`config` argument) so DI overrides — e.g. `TestBed.overrideProvider(INSIGHTS_CONFIG, ...)` in
tests — actually take effect.

## Step 4 — Environment Wiring

Add a `appInsightsConnectionString` field to each `environment.ts` / `environment.*.ts` and read it
in the `provideInsights(...)` call. Never hardcode a real connection string in source control.

## Step 5 — Validate

```bash
ng build <project-name>
ng test <project-name> --watch=false
```

Confirm the library (if created) appears under `projects/<lib-name>` in `angular.json` and that
`public-api.ts` exports all four files.

## Monorepo & Workspace Lessons Learned

1. **Keep Commands at Workspace Root**: Avoid `cd` into subdirectories during automation to prevent
   `cwd` drift in persistent agent terminals. Use workspace flags (`pnpm --filter <app>`).
2. **Strict Hoisting & Peer Dependencies**: When workspace `.npmrc` has `hoist=false`, transitive
   runtime dependencies such as `@microsoft/dynamicproto-js` must be explicitly installed alongside
   `@microsoft/applicationinsights-angularplugin-js` to avoid runtime import failures.
3. **Headless Test Execution**: Angular's default unit test runner launches in watch mode. Always pass
   `--watch=false` in automated scripts or agent tool calls:
   ```bash
   pnpm --filter <app> exec ng test --include="**/insights.spec.ts" --watch=false
   ```
