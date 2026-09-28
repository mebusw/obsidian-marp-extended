# Sources for the Obsidian Marp skill

Generated/updatable upstream snapshots are stored in `upstream/` by `../scripts/update-references.py`.

Current project metadata source: **Marp Extended** package `0.12.0`
(`package.json`; stable Community `manifest.json` stays on the latest published
stable until the next Community release), plugin/package id `marp-extended`,
repository <https://github.com/shuuul/obsidian-marp-extended>.

Preview: `@marp-team/marp-core` `5.0.2` (npm `next` channel; `latest` remains 4.x)
with curated **Shiki** + **MathJax** plugins and a custom Mermaid stack. Export
npx pin: `@marp-team/marp-cli@4.5.1` (CLI embeds Core 4.x). Packaged themes:
`assets/themes/`, `assets/mermaid-themes/`. Shiki language allowlist:
`src/shims/marp-shiki.cjs`.

## Agent Skill specification

- https://agentskills.io/specification

## Marp / Marpit official docs

- Marp homepage: https://marp.app/
- Marpit Markdown: https://marpit.marp.app/markdown
- Marpit directives: https://marpit.marp.app/directives
- Marpit image syntax: https://marpit.marp.app/image-syntax
- Marpit fragmented list: https://marpit.marp.app/fragmented-list
- Marpit theme CSS: https://marpit.marp.app/theme-css
- Marpit inline SVG: https://marpit.marp.app/inline-svg
- Marp Core Markdown features: https://github.com/marp-team/marp-core/blob/main/docs/markdown.md
- Marp Core README / features: https://github.com/marp-team/marp-core
- Marp CLI: https://github.com/marp-team/marp-cli
- Marp CLI bespoke transitions: https://github.com/marp-team/marp-cli/blob/main/docs/bespoke-transitions/README.md

## Plugin source files used for adaptation

- `manifest.json` — plugin id/name/version.
- `package.json` — Marp dependency versions and scripts.
- `README.md` — user-facing behavior and theme credits.
- `docs/marp-extended-syntax.md` — canonical user-facing Extended syntax contract.
- `src/utilities/settings.ts` — CLI path, npx fallback, Chrome path, editor Mermaid settings.
- `src/utilities/filePath.ts` — filesystem path resolution and Obsidian image wiki-link conversion.
- `src/utilities/marpExtendedDsl.ts` — Extended `%%marp-*%%` compiler.
- `src/utilities/marpExport.ts` — Marp CLI argv construction and export behavior.
- `src/runtime/marpEngine.ts` — shared Core 5 engine factory (`createMarpEngine`).
- `src/views/marpPreviewView.ts` — preview host wiring and render.
- `src/shims/marp-shiki.cjs` — curated Shiki language subset for the bundle.
- `assets/Themes.md`, `assets/themes/*.css`, `assets/mermaid-themes/*.css` — packaged theme sources.

## Refresh procedure

From the repo root:

```bash
python3 skills/obsidian-marp/scripts/update-references.py
```

Then review `references/upstream/` and update `syntax.md` / `plugin-adapter.md` only when upstream or plugin behavior changed.
