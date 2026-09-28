# Marp Extended plugin adaptation notes

These notes adapt upstream Marp syntax to this repository's Obsidian plugin. Source paths are relative to the repo root.
The canonical user-facing marker contract lives in `docs/marp-extended-syntax.md`;
keep this implementation-focused reference aligned with it.

## Plugin identity

- Display name: `Marp Extended` (`manifest.json`).
- Plugin id: `marp-extended` (`manifest.json`).
- Package name: `marp-extended` (`package.json`).
- Package version: `0.12.0` (`package.json`). Stable Community `manifest.json` stays on the latest published stable until the next Community release.
- Repository: <https://github.com/shuuul/obsidian-marp-extended>.
- Local/manual runtime files: `main.js`, `manifest.json`, `styles.css`, `marp-engine.cjs`. Community installs materialize a SHA-256-checked, content-addressed copy of the embedded engine on first export.
- Generated `main.js` should not be edited by hand; change `src/` and run the build.
- Node.js **≥ 22.20** required for local typecheck/build. The optional npx export fallback supports Node.js **≥ 20.19** because the shipped Core 5 engine retains that runtime floor.

## Runtime engines

| Surface | Engine |
| --- | --- |
| In-Obsidian preview | Shared `@marp-team/marp-core` **5.0.2** factory + `shiki`, `mathjax`, Mermaid fallback |
| Export host | Exactly `@marp-team/marp-cli@4.5.1` + shipped Core 5 engine through `--engine` |
| Explicit user CLI path | Accepted only when its reported CLI version is exactly 4.5.1 |

Preview and CLI engine entries call `src/runtime/marpEngine.ts`. Each call creates
a fresh Marp instance with Shiki, MathJax, custom Mermaid fallback, inline SVG,
HTML, CSS minification, and no injected Marp Core browser script. **Do not**
enable Core Mermaid or KaTeX plugins in this product build.

Shiki languages are a curated subset via esbuild alias of `#marp-shiki` → `src/shims/marp-shiki.cjs`.

## Settings that affect export and editor

Defined in `src/utilities/settings.ts`:

| Setting | Default | Effect |
| --- | --- | --- |
| `MARP_CLI_PATH` | `''` | Explicit Marp CLI executable path. |
| `MARP_CLI_USE_NPX` | `false` | When enabled and no path is set, run pinned `@marp-team/marp-cli@4.5.1` via npx. |
| `CHROME_PATH` | `''` | Optional browser path for PDF/PPTX export. |
| `MERMAID_EDITOR_RENDER` | `true` | Live Preview and Reading view Mermaid decorations. Reading view omits the show-source button. |
| `MERMAID_EDITOR_THEME` | `kami` | Default Mermaid theme name for editor when frontmatter omits `mermaidTheme`. |

There is **no** plugin setting for math engine or HTML export template in the current settings interface. Preview math is fixed to MathJax. HTML export uses the bespoke template path in export code (see `marpExport.ts`).

## Wiki-link image conversion

Implemented in `src/utilities/filePath.ts`.

The converter transforms Obsidian image wiki-links into standard Markdown image links:

```markdown
![[image.png]]              -> ![image.png](resolved/path/image.png)
![[image.png|Alt text]]     -> ![Alt text](resolved/path/image.png)
![[image.png|600]]          -> ![w:600](resolved/path/image.png)
![[image.png|600x400]]      -> ![w:600 h:400](resolved/path/image.png)
```

Important constraints:

- Only image extensions are converted: `png`, `jpg`, `jpeg`, `gif`, `svg`, `webp`, `bmp`.
- The file is resolved with Obsidian `metadataCache.getFirstLinkpathDest(filename, sourceFile.path)`.
- Absolute Obsidian link format produces paths from the vault root.
- Relative Obsidian link format produces paths relative to the current note's folder.
- If the linked image cannot be resolved, the converter still emits a Markdown image using the wiki-link target as the path.
- Non-image wiki-links and embeds are out of scope for this converter.

## Export behavior

Implemented in `src/utilities/marpExport.ts`.

Before calling Marp CLI, the plugin:

1. Resolves a filesystem path for the source note (desktop only).
2. Collects existing theme paths from `.marp-extended/themes`.
3. Compiles Marp Extended `%%marp-*%%` markers into Marp-compatible directives/HTML.
4. Converts image wiki-links.
5. Loads Mermaid theme CSS, parses `--bg/--fg/...` into beautiful-mermaid render options, and replaces Mermaid fences with inline SVG figures.
6. Writes a temporary export source when content was transformed.
7. Verifies/materializes the embedded Core 5 engine by SHA-256.
8. Validates Marp CLI 4.5.1 (configured path, PATH detect, or npx pin) and invokes it with the engine.

Typical CLI argv shape:

```text
<source.md> --allow-local-files --engine <absolute marp-engine.cjs> --html [--theme-set ...] [--browser-path ...] --pdf|--pptx|--template bespoke ...
```

Security note: `--allow-local-files` is necessary for vault resources but should only be used with trusted Markdown.

## Mermaid themes

Mermaid styling is separate from Marp slide themes:

- Slide themes live under `.marp-extended/themes` and are selected with `theme`.
- Mermaid themes live under `.marp-extended/mermaid-themes` and are selected with `mermaidTheme`.
- Theme CSS sources for packaging live in `assets/themes/` and `assets/mermaid-themes/`; regenerate the TS package with `npm run sync:themes`.
- `mermaidFlat: true` injects a small post-theme override to remove the Mermaid figure background, border, shadow, and padding.
- Preview/export/editor parse Mermaid theme CSS variables (`--bg`, `--fg`, `--line`, `--accent`, `--muted`, `--surface`, `--border`) into beautiful-mermaid render options so diagram fills match the theme.

Example frontmatter for a complete deck:

```yaml
---
marp: true
theme: kami
mermaidTheme: kami
mermaidFlat: true
size: kami
paginate: true
math: mathjax
---
```

Available themes out of the box: Marp Core built-ins `default` / `gaia` /
`uncover`, plus packaged `kami`. Kami uses Chinese metrics by default and English
metrics when frontmatter sets `lang: en` (Marpit writes `lang` on each
`<section>`; theme CSS uses `section:lang(en)`).

Preview and export inject a small scale override so built-in themes use the same
body size as Kami (`13pt` on `section[data-theme=…]`). Headings stay `em`-relative.
See `src/utilities/builtinThemeScale.ts`.

Obsidian property suggestions for `theme`, `size`, `mermaidTheme`, and
`mermaidFlat` are patched by the plugin.

## Math

- Preview always constructs Marp with `math: 'mathjax'` and registers the MathJax Core plugin.
- KaTeX is **not** a dependency and is **not** registered. Frontmatter `math: katex` will not work in this plugin build.
- Prefer `math: mathjax` or omit the field.

## Code highlighting (Shiki)

- Preview uses Marp Core Shiki plugin with CSS variables `--marp-shiki-*`.
- Language coverage is a curated subset in `src/shims/marp-shiki.cjs` (not the full 200+ Marp Core pack).
- Theme authors must not rely on highlight.js `.hljs-*` classes for preview.
- Kami code chrome: ivory background, `1px` border, `6pt` radius, mono ~`10pt`, `width: fit-content; max-width: 100%`, optional scroll for tall blocks.

## Authoring language style (plugin posture)

Marpit's published Markdown page stresses CommonMark compatibility: decks should
still read well in a normal Markdown editor. This plugin leans further toward
Obsidian-native notes:

| Prefer in vault notes | Why |
| --- | --- |
| YAML frontmatter for deck globals | First-class Obsidian properties + Marpit front-matter |
| `%%marp-slide[...]%%` for spot locals | Hidden in Reading view; compiles to `_` spot directives |
| Marp Extended `%%marp-*%%` layout markers | Stable namespaced classes without raw HTML noise |
| `![[img\|600]]` wiki-links | Vault-resolved paths; size aliases → `w`/`h` |
| MathJax only | KaTeX not bundled in preview |
| Shiki fence tags from the curated subset | Full Marp Core language pack is not shipped |

Still use raw Marpit when needed: `![bg left:40%]()`, image filters, fragmented
`*` / `1)` lists, `headingDivider`, fitting headers, and bespoke `transition`.
Wiki-links do not encode `bg` or filters — switch to standard `![]()` for those.

See `references/syntax.md` for the full syntax matrix.

## Marp Extended comment-marker compiler

Preview and export both run `compileMarpExtendedCommentBlocks` before Marp
rendering. The compiler is implemented in
`src/utilities/marpExtendedDsl.ts`:

```markdown
%%marp-slide[class=cover paginate=false footer=""]%%

%%marp-columns%%
### Left

%%marp-column%%

### Right
%%/marp-columns%%
```

- `%%marp-slide[...]%%` metadata becomes Marp spot directives such as `<!-- _class: cover -->`.
- `lead`, `subtitle`, `metadata`, `callout[variant=...]`, `columns`/`column`, and `cards[columns=N]` forms emit stable `marp-extended-*` classes.
- Backtick/tilde CommonMark fences and nested blocks are preserved and processed by their later pipeline stages.
- `%%marp-callout[variant=note]%%` is a visible block; presenter notes use ordinary Marpit HTML comments. The preview notes panel is labeled by slide number and can be resized from its top edge.
- **Sync preview** (on by default) follows the pane the user is currently using. See `docs/preview_sync.md`. While sync is on, clicking a slide without a text selection does not jump the editor.

## Themes in this repo

Packaged theme CSS lives under `assets/themes/` (and Mermaid themes under `assets/mermaid-themes/`); see `assets/Themes.md` for credits.

When adding or advising custom themes:

- Include `/* @theme name */`.
- Prefer vault theme files under `.marp-extended/themes` so `--theme-set` can register them.
- Keep upstream license notices in copied/modified theme CSS.
- For Kami themes, note the TsangerJinKai02 font licensing caveat from `README.md`.
- After editing `assets/themes` or `assets/mermaid-themes`, run `npm run sync:themes`.

## Export prerequisites and gotchas

- PDF, PPTX, and image export require Chrome/Chromium/Edge or a configured browser path.
- The plugin reports a friendly error when Marp CLI cannot find Chromium.
- Export is desktop-only (`Platform.isDesktop`).
- Preview and managed export share Core 5 semantics. Container/template/browser wrappers and PDF/PPTX backends can still differ visually.
- Explicit incompatible Marp CLI paths fail validation; auto-detected incompatible versions may use the pinned npx fallback when enabled.
- Obsidian preview paths may differ from Node filesystem paths. The plugin normalizes paths for Marp CLI.
