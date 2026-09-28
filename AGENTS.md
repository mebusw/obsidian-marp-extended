# AGENTS.md

## Project overview

This is **Marp Extended**, an Obsidian community plugin forked from `obsidian-marp-slides`. It previews, presents, and exports Marp-based Markdown slide decks inside Obsidian.

Prefer changes that preserve current slide/export behavior while keeping fork metadata and maintenance workflows explicit.

Current plugin ID: `marp-extended`.

## Repo structure

```text
src/main.ts                         # Obsidian plugin entry point, ribbon, settings load
src/commands/registerMarpCommands.ts # Command palette registration
src/settings/marpExtendedSettingTab.ts # Settings UI
src/views/marpPreviewView.ts        # Custom ItemView for rendered slide preview
src/editor/mermaidEditorExtension.ts # Live Preview Mermaid decorations
src/utilities/settings.ts           # Settings interface and defaults
src/utilities/filePath.ts           # Vault/resource path resolution and image wiki-link conversion
src/utilities/marpExport.ts         # Marp CLI export orchestration
src/utilities/marpMarkdown.ts       # Shared preview/export Markdown compile path
src/utilities/marpPreparation.ts    # Shared preview/export preparation policy and ordered deck CSS
src/utilities/previewLinks.ts       # Preview iframe link activation (internal/external)
src/utilities/mermaid.ts            # Mermaid fence rendering for preview/export
src/utilities/themeManager.ts       # Slide theme manager (thin VaultThemeManager subclass)
src/utilities/mermaidThemeManager.ts # Mermaid theme manager (thin VaultThemeManager subclass)
src/utilities/vaultThemeManager.ts  # Generic vault theme manager base (differential writes)
src/utilities/icons.ts              # SVG icons registered with Obsidian
src/runtime/marpEngine.ts           # Shared Core 5 semantic engine factory
src/runtime/cliEngine.ts            # Standalone CLI engine entry point
src/runtime/marpCli.ts               # Marp CLI discovery, validation, process execution, fallback
src/runtime/engineArtifact.ts       # Embedded engine integrity/materialization
src/runtime/mermaidFallback.ts      # Shared Mermaid fence plugin (native marp_mermaid tokens, figure output, --bg/--marp-mermaid-* dual CSS)
src/runtime/mermaidShared.ts        # Shared Mermaid constants and fence-info parsing
src/shims/marp-shiki.cjs            # Curated Shiki language subset for Core 5
src/shims/mathjax-cold-font-extensions.cjs # Empty stubs for cold MathJax font extensions (bbm/bboldx/dsfont)
packages/code-fence-scanner/        # @marp-extended/code-fence-scanner: fence/inline-code scanning primitives
packages/marp-dsl/                  # @marp-extended/marp-dsl: %%marp-*%% marker compiler
packages/wiki-links/                # @marp-extended/wiki-links: note wiki-link conversion (preview/export)
packages/mermaid-autofit/           # @marp-extended/mermaid-autofit: zigzag auto-layout for linear LR/TD chains
specs/                              # Tracked execution specs (Draft/Active) + archive/
scripts/check-specs.mjs             # Spec tree validator
tests/                              # Jest tests (unit + integration) and Obsidian mocks
assets/themes/                      # Packaged slide theme CSS sources
assets/mermaid-themes/              # Packaged Mermaid theme CSS sources
docs/                               # Optional user-facing notes (not a full docs site)
manifest.json                       # Obsidian plugin metadata
styles.css                          # Plugin CSS
esbuild.config.mjs                  # Build/watch configuration
CHANGELOG.md                        # Release notes
```

## Commands

Run focused checks before reporting completion:

```bash
npm run typecheck
npm run lint
npm run check:specs
npm test -- --runInBand
```

For release/build-output changes, also run:

```bash
npm run build
```

Useful commands:

| Task | Command |
| --- | --- |
| Install dependencies | `npm install` |
| Development watch build | `npm run dev` |
| Production build | `npm run build` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Auto-fix lint | `npm run lint:fix` |
| Tracked specs validator | `npm run check:specs` |
| Sync packaged theme CSS | `npm run sync:themes` |
| Test | `npm test` |
| Test coverage | `npm run test:coverage` |
| Single test file | `npm run test -- --runInBand tests/unit/filePath.test.ts` |
| Spec validator tests | `npm test -- --runInBand tests/unit/scripts/checkSpecs.test.ts` |
| Bundle analysis | `npm run analyze:bundle` |
| Reload local Obsidian dev plugin | `npm run obsidian:reload` |
| Profile local Obsidian preview | `npm run obsidian:profile -- path="slides/examples/kami.md"` |
| Version metadata sync | `npm run version` |

For manual Obsidian testing, set `OBSIDIAN_VAULT` in `.env.local`; `npm run dev` and `npm run build` auto-copy `main.js`, `manifest.json`, `styles.css`, and `marp-engine.cjs` into:

```text
<vault>/.obsidian/plugins/marp-extended/
```

Then reload the dev plugin with the Obsidian CLI:

```bash
npm run obsidian:reload
```

After completing code/config/style changes, refresh the local Obsidian dev plugin automatically: run `npm run build` so the updated runtime files are copied, then run `npm run obsidian:reload`. The reload script prefers `obsidian plugin:reload id=marp-extended`, uses `obsidian plugin:enable id=marp-extended filter=community` only when the plugin is installed but disabled, and then checks `obsidian dev:errors`. Do not run `plugin:enable` in parallel with a full `obsidian reload`; transient command registration during reload can report misleading “command not found” errors. If `OBSIDIAN_VAULT` is unset, the Obsidian CLI is unavailable, or Obsidian is not running, report that the reload could not be completed.

Required runtime files for a local/manual plugin install are:

```text
main.js
manifest.json
styles.css
marp-engine.cjs
```

Obsidian Community installs only the standard first three assets. `main.js`
embeds a compressed copy of `marp-engine.cjs`; first export verifies and
materializes a content-addressed engine file in the plugin directory. Release
archives and direct assets must still include the standalone `marp-engine.cjs`.

`npm run analyze:bundle` writes `metafile.json` for the esbuild analyzer. Remove it after ad-hoc analysis unless a task explicitly asks to keep it.

`npm run obsidian:profile` uses the Obsidian CLI and Chrome DevTools Protocol to capture Chrome Performance metrics and Marp Extended user-timing measures for the preview command. It temporarily enables preview profiling through `localStorage.marp-extended-profile` and accepts `path=`, `command=`, `settle=`, `delay=`, `timeout=`, `cpu=true`, and `out=` arguments. CPU profile capture is optional because CDP profiler stop can be flaky in Obsidian/Electron; when `cpu=true` succeeds, it writes a `.cpuprofile` file to the system temp directory by default. Do not commit generated `.cpuprofile` files.

## Stable release flow

Stable release preparation is automated by [Release Please](https://github.com/google-github-actions/release-please-action) on pushes to `main`; publication starts only from a maintainer-pushed annotated tag. This follows the Pivi release boundary so the tag commit is tested and published by the same workflow. The fork no longer tracks `upstream` and maintains its own release history (tags `0.1.x` onward).

- Config: `release-please-config.json`
- Preparation workflow: `.github/workflows/release-please.yml`
- Tag publication workflow: `.github/workflows/release.yml`
- Shared CI/release gates: `.github/actions/quality-gates/action.yml`
- Changelog: `CHANGELOG.md`
- Release artifact folder/name: `marp-extended`

Release Please expects [Conventional Commit](https://www.conventionalcommits.org/) messages:

- `fix:` for patch releases
- `feat:` for minor releases
- `feat!:` / `fix!:` / other `!` prefixes for breaking major releases

Flow:

1. Push `feat:`/`fix:`/`chore:` commits to `main`. The `release-please` job runs on every push to `main` and opens (or updates) a single release PR collecting unreleased Conventional Commits. `chore:` commits do not trigger a release.
2. Release Please updates `package.json`, `package-lock.json`, `manifest.json`, and `CHANGELOG.md`; the metadata sync job adds the matching `versions.json` entry to that PR.
3. Merge the release PR, then create an annotated tag with no `v` prefix at the merge commit: `git tag -a x.y.z -m "x.y.z"`.
4. Push the tag. `.github/workflows/release.yml` validates version metadata, runs the same quality gates as CI, builds the exact tag, creates or updates the GitHub release, and byte-compares downloaded assets.

Uploaded release assets:

- `main.js`
- `manifest.json`
- `styles.css`
- `marp-engine.cjs`
- `marp-extended-<version>.zip`

Tags must be annotated and exactly match `package.json` without a `v` prefix. Do not create GitHub releases manually; the tag workflow owns release creation and reruns update assets with `--clobber`.

## Beta release flow

Beta builds use a separate `next` (or `beta`) branch and the same `.github/workflows/release.yml` tag publisher as stable releases, following `shuuul/obsidian-pivi`:

1. Create or update `next` from the intended beta candidate commit.
2. Run `npm run version:beta`. It bumps only `package.json` to the next `x.y.z-beta.N`; root `manifest.json`, `versions.json`, and `.release-please-manifest.json` stay on the stable channel.
3. Commit `package.json` as `chore(release): prepare x.y.z-beta.N`.
4. Push `next`, then create an annotated tag with no `v` prefix: `git tag -a x.y.z-beta.N -m "x.y.z-beta.N"`.
5. Push that one tag. The workflow verifies the tagged commit is present on remote `next` or `beta`, runs all checks, generates a beta `manifest.json`, builds the runtime assets and zip, creates a GitHub Prerelease, and byte-compares downloaded assets.

Beta release assets are `main.js`, beta-versioned `manifest.json`, `styles.css`, `marp-engine.cjs`, and `marp-extended-<version>.zip`. Testers install and update prereleases through BRAT. Never add beta versions to root `versions.json` or move the stable root manifest off the latest Community Plugins version.

## Architecture

```diagram
╭──────────╮      ╭────────────╮      ╭───────────────╮
│ Obsidian │─────▶│ src/main.ts│─────▶│ Preview view  │
╰────┬─────╯      ╰─────┬──────╯      ╰──────┬────────╯
     │                  │                    │
     │                  ▼                    ▼
     │            ╭──────────╮        ╭────────────╮
     │            │ Exporter │───────▶│ Marp Core  │
     │            ╰────┬─────╯        ╰────────────╯
     │                 │
     │                 ▼
     │            ╭──────────╮        ╭──────────╮
     ╰───────────▶│ FilePath │───────▶│ Marp CLI │
                  ╰──────────╯        ╰──────────╯
```

Preview flow: active `MarkdownView` → `MarpPreviewView.displaySlides()` → `FilePath` base path/wiki-link conversion → Marp Core render → preview pane update.

Export flow: command/action → `MarpExport.export()` → hash-checked Core 5 engine artifact → `FilePath` source/theme paths → optional wiki-link/Extended/Mermaid compilation → Marp CLI 4.5.1 with `--engine` → output.

## Runtime requirements

- Node.js **≥ 22.20** for local typecheck/build. The optional npx export fallback supports Node.js **≥ 20.19** because its shipped Core 5 engine retains that runtime floor.
- Desktop Obsidian for export (Marp CLI + browser).

## Coding conventions

- Follow `.editorconfig`: UTF-8, LF, final newline, tabs width 4.
- Keep edits small and scoped; path/export behavior is sensitive.
- Do not hand-edit `main.js`; it is generated by `npm run build` and ignored by git.
- TypeScript uses ES modules, but this legacy plugin still permits `require()` where needed.
- Preserve user settings compatibility unless a task explicitly covers migration.
- When changing the fork name, keep `package.json`, `package-lock.json`, `manifest.json`, `versions.json`, README, release workflow artifact names, and hardcoded plugin paths consistent.

## Tracked specs

Long-running or multi-workstream work uses the tracked spec system under `specs/`
(init-repo contract). Specs are execution records; durable behavior still lands in
code, tests, `README.md`, `CHANGELOG.md`, optional `docs/*` notes, and this file.

| Status | Location | Meaning |
| --- | --- | --- |
| `Draft` | `specs/` | Scope/decisions not complete |
| `Active` | `specs/` | Execution contract ready |
| `Completed` | `specs/archive/` | Acceptance + doc sync done |

Rules:

- Copy `specs/000-template.md` → `specs/NNN-kebab-case.md`. IDs are permanent and continuous from `001` across active + archive.
- Coordinator owns frontmatter, index row in `specs/README.md`, cross-workstream decisions, and closeout.
- Claim a workstream before editing; append Progress and handoff entries.
- Before archive: satisfy success criteria, sync durable docs/AGENTS, set `status: Completed`, move file + index row together, run `npm run check:specs`.
- Do not store execution specs under `docs/superpowers` or any superpowers layout. That path is retired.

See `specs/README.md` for the full lifecycle.

## Testing guidance

- Unit tests live under `tests/unit/`; integration tests that exercise the real beautiful-mermaid renderer live under `tests/integration/` (separate Jest project, no beautiful-mermaid mock).
- Tests use `tests/__mocks__/obsidian.ts`; the unit project also maps `beautiful-mermaid` to `tests/__mocks__/beautiful-mermaid.ts`.
- Workspace packages under `packages/` are imported by package name (`@marp-extended/...`) in both source and tests.
- Use `npm run test*` scripts so tests go through `scripts/run-jest.js`.
- Current coverage is focused on `FilePath`, the specs validator, and `mermaid-autofit`; add tests when changing path handling, wiki-link conversion, export argv construction, frontmatter/preview sync, mermaid auto-fit, or `scripts/check-specs.mjs`.
- For path-related changes, consider relative and absolute Obsidian link formats plus Windows-style paths.

## Gotchas

- Export except HTML requires Chrome/Chromium/Edge or a configured `CHROME_PATH`.
- Managed export requires Marp CLI 4.5.1. The pinned npx fallback supplies that version; explicit incompatible CLI paths fail validation.
- Preview and export share Core 5 semantic options/plugins, but iframe/container/template/browser wrappers remain host-owned and are not expected to be pixel-identical.
- `MarpExport.export()` writes processed Markdown to the resolved export source before invoking Marp CLI. Be careful with source-file mutation semantics.
- Preview sync is driven by the pane the user is currently using; see `docs/preview_sync.md`. Cursor updates use CodeMirror `ViewUpdate`; reading view uses annotated section line starts. The driver pane must not jump.
- Runtime dependencies should audit clean with `npm audit --omit=dev`. Full `npm audit` may still report a dev-only `js-yaml` advisory through Jest/coverage tooling.
- Keep `docs/` limited to short user-facing notes (`custom-css.md`, `marp-extended-syntax.md`, and `preview_sync.md`). Do not re-add a full documentation site or a `docs/superpowers` tree unless explicitly requested.
- Release notes live at root `CHANGELOG.md`.
- Tracked specs live only under `specs/` (and `specs/archive/`).
