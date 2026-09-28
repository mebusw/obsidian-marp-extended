# Changelog

## Unreleased

### Changed

* **deps:** update Marp CLI support to 4.5.1 and refresh development dependencies
* **tooling:** require Node.js 22.20 for development and verify Node.js 22.20 and 24 in CI

## [0.12.0](https://github.com/shuuul/obsidian-marp-extended/compare/0.11.1...0.12.0) (2026-09-06)


### Features

* **editor:** render Mermaid in reading view without source button ([c5ea434](https://github.com/shuuul/obsidian-marp-extended/commit/c5ea434cbda2b71d166fcb7cce8616621df768b9))
* **mermaid:** adopt Marp Core 5 native mermaid token semantics ([1938ded](https://github.com/shuuul/obsidian-marp-extended/commit/1938ded76bd0ce71bb41f704041aad833ad26e01))
* **mermaid:** dual-write Core 5 CSS vars and native fence fallback ([b2e6d3c](https://github.com/shuuul/obsidian-marp-extended/commit/b2e6d3cbd2dbf038b231d57b4bb426b779479993))
* **preview:** drive sync from the active pane without jumps ([50985a0](https://github.com/shuuul/obsidian-marp-extended/commit/50985a0210fca053d720c1dc8922007d00fa5ab7))
* **preview:** sync reading view and deck preview by slide ([0f2ff46](https://github.com/shuuul/obsidian-marp-extended/commit/0f2ff463612876e98d11262aaba8e2527ff7dd5d))


### Bug Fixes

* **preview:** label presenter notes by slide and allow resizing ([320dd3c](https://github.com/shuuul/obsidian-marp-extended/commit/320dd3c2358af596709703c0783978382cb3ec4c))
* **styles:** replace !important with selector specificity in editor mermaid rules ([2f81bd7](https://github.com/shuuul/obsidian-marp-extended/commit/2f81bd72384379684bc494657d95e7c9f2663f2a))


### Performance Improvements

* **bundle:** reduce main.js from 9.75 to 7.70 MiB ([b805ee8](https://github.com/shuuul/obsidian-marp-extended/commit/b805ee88536e611908d7e2a5776777bc2813a6d4))

## [0.11.1](https://github.com/shuuul/obsidian-marp-extended/compare/0.11.0...0.11.1) (2026-09-06)


### Bug Fixes

* **preview:** reveal marpit fragments by default ([d33a490](https://github.com/shuuul/obsidian-marp-extended/commit/d33a490cfe3c848ebd70dc0a5f96f033922a4bc3))

## [0.11.0](https://github.com/shuuul/obsidian-marp-extended/compare/0.10.2...0.11.0) (2026-09-04)


### Features

* **preview:** navigate from slides to source ([ebb9793](https://github.com/shuuul/obsidian-marp-extended/commit/ebb9793b374bfe5daa28a735130f7e5943202be1)), closes [#9](https://github.com/shuuul/obsidian-marp-extended/issues/9)


### Bug Fixes

* **export:** support Windows command-script CLIs ([1a83599](https://github.com/shuuul/obsidian-marp-extended/commit/1a835993e9685e3368007b26b8b8e1c5691b0016))

## [0.10.2](https://github.com/shuuul/obsidian-marp-extended/compare/0.10.1...0.10.2) (2026-09-04)


### Bug Fixes

* **ci:** allow release branch verification ([f4ec3d9](https://github.com/shuuul/obsidian-marp-extended/commit/f4ec3d9ca7cd0c1d0af61d212566bf0d0834914e))
* **export:** keep preview and export markdown aligned ([280dc7f](https://github.com/shuuul/obsidian-marp-extended/commit/280dc7f9b2fbd13f5f2807f8290950ff9bcbf51a))
* **release:** complete release PR label lifecycle ([8968ebb](https://github.com/shuuul/obsidian-marp-extended/commit/8968ebb37386a8fdbe9e17678bbccae67a8574b1))

## [0.10.1](https://github.com/shuuul/obsidian-marp-extended/compare/0.10.0...0.10.1) (2026-08-15)


### Bug Fixes

* **editor:** clean up Mermaid theme stylesheets ([d9f9e66](https://github.com/shuuul/obsidian-marp-extended/commit/d9f9e66c5963aa1d77612d836dd8bad7a884b626))
* **export:** preserve theme colors for slide links ([556b948](https://github.com/shuuul/obsidian-marp-extended/commit/556b94853cf89bfeb0056fb39b9c1a884b17bbab))
* **settings:** index plugin options in Obsidian search ([938cf0b](https://github.com/shuuul/obsidian-marp-extended/commit/938cf0b67d29f13eb4018771639358feab5392f9))

## [0.10.0](https://github.com/shuuul/obsidian-marp-extended/compare/0.9.0...0.10.0) (2026-08-15)


### Bug Fixes

* **preview:** open sidebar http(s) links in the system browser instead of navigating inside Obsidian
* **preview:** fall back to `window.open` when Electron's `openExternal` rejects asynchronously
* **preview:** resolve note wiki-links with heading/block subpaths instead of reporting "note not found"
* **preview:** keep wiki-link-like text inside inline code spans and long/nested code fences untouched
* **preview:** keep scanning after an unmatched inline backtick so later code spans still protect wiki-link-like text
* **preview:** keep note wiki-links well-formed when note names contain unbalanced parentheses
* **settings:** refresh the open slide preview when the Mermaid auto-fit toggle changes

### Performance Improvements

* **preview:** coalesce duplicate per-edit preview triggers and reuse cached theme CSS and the Marp engine across renders
* **export:** cache the Marp CLI version check per settings snapshot
* **themes:** skip rewriting unchanged bundled default themes on plugin load

### Code Refactoring

* deduplicate code-fence scanning into `codeFenceScanner`, shared by the Extended DSL compiler, wiki-link conversion, Mermaid rendering, editor decorations, and preview sync
* merge the Mermaid dual-stack constants and fence-info parsing into `runtime/mermaidShared`
* merge the slide/Mermaid theme managers into a shared `VaultThemeManager` base and unify the settings-tab theme UI

### Features

* **runtime:** bump shared Marp Core engine pin to `5.0.1` (`next` channel)
* **language:** add a theme-independent Marp Extended authoring layer with namespaced classes, configurable columns/cards/callouts, and CommonMark fence handling
* **preview:** add Marpit fragment stepping, reset/status controls, keyboard-bindable commands, active-slide tracking, and a safe presenter-notes panel
* **runtime:** share one isolated Marp Core 5 engine contract across preview and managed CLI export, including Shiki, MathJax, Mermaid fallback, inline SVG, and Extended structural CSS
* **export:** ship and embed a standalone `marp-engine.cjs`, verify it by SHA-256 before materialization, and pass it to supported Marp CLI 4.5.0 exports
* **preview:** migrate slide rendering to Marp Core 5 (`5.0.1`) with curated Shiki and MathJax plugins while keeping the custom Mermaid theme stack
* **export:** pin npx Marp CLI fallback to `@marp-team/marp-cli@4.5.0`
* **mermaid:** apply theme CSS variables (`--bg/--fg/...`) to beautiful-mermaid render options
* **themes:** move packaged theme sources to `assets/` and add `npm run sync:themes`
* **bundle:** ship a curated Shiki language subset for slide decks (esbuild `#marp-shiki` shim)
* **theme:** align bilingual Kami code blocks with upstream Kami code-card + Pygments token palette
* **mermaid:** auto-fit long linear `flowchart LR`/`TD`/`TB` chains into compact zigzag bands in preview, export, and the editor (`MERMAID_AUTO_FIT`, default on)

### BREAKING CHANGES

* The marker compiler, template command IDs, generated CSS classes, and utility module exports now use only the canonical Marp Extended names.
* Theme CSS that only styles highlight.js `.hljs-*` classes no longer affects preview or managed-export code colors under Core 5. Use `--marp-shiki-*` variables (bundled sample themes were migrated).
* Managed export accepts exactly Marp CLI 4.5.0. Auto-detected incompatible versions may use the pinned npx fallback; an explicitly configured incompatible executable is rejected instead of silently rendering with a different contract.
* Sample `vault/` tree removed from the repository; theme CSS sources live under `assets/themes` and `assets/mermaid-themes`.
* KaTeX is not bundled; preview math is MathJax-only.


## [0.9.0](https://github.com/shuuul/obsidian-marp-extended/compare/0.8.1...0.9.0) (2026-07-11)


### Features

* **editor:** add zoom and pan controls for editor tab Mermaid diagrams ([2071a9d](https://github.com/shuuul/obsidian-marp-extended/commit/2071a9d6971b7d5e8dc7b9eba05b06564166ccfa))
* **mermaid:** async rendering with official Mermaid fallback for unsupported diagram types ([9c5195b](https://github.com/shuuul/obsidian-marp-extended/commit/9c5195b6bfde8d5119d3c78a888e0c58feb913f7))

## [0.8.1](https://github.com/shuuul/obsidian-marp-extended/compare/0.8.0...0.8.1) (2026-07-08)


### Bug Fixes

* resolve security warnings and css compatibility issues ([8657d41](https://github.com/shuuul/obsidian-marp-extended/commit/8657d41f3e2702fd2eaaeaa3e918f204f07bc0f4))

## [0.8.0](https://github.com/shuuul/obsidian-marp-extended/compare/0.7.1...0.8.0) (2026-07-05)


### Features

* **editor:** add configurable Mermaid previews ([63335f4](https://github.com/shuuul/obsidian-marp-extended/commit/63335f45dffb395ca11e5a5511a90c253985b271))
* **kami:** use comment marker DSL ([71458b1](https://github.com/shuuul/obsidian-marp-extended/commit/71458b12128076c9d6b3e1156e776f9a3b292441))


### Bug Fixes

* **export:** improve Marp CLI fallback cleanup ([6148cde](https://github.com/shuuul/obsidian-marp-extended/commit/6148cde75b2d37aa3b5e421ad4b6ccdf6425ff20))
* **preview:** ignore stale preview leaves ([1e2d99c](https://github.com/shuuul/obsidian-marp-extended/commit/1e2d99cf4abd63d60a19b69ea411cab83ca4b9f0))

## [0.7.1](https://github.com/shuuul/obsidian-marp-extended/compare/0.7.0...0.7.1) (2026-06-29)

### Bug Fixes

* **release:** pass Obsidian release checks ([64bdb3f](https://github.com/shuuul/obsidian-marp-extended/commit/64bdb3fb593aaebf18d759f30e02fda60f9c447c))

- Changed export to call an external Marp CLI executable instead of bundling `@marp-team/marp-cli` into `main.js`; settings now support explicit path input, auto-detection, and an optional pinned npx fallback.
- Removed the unsupported release ZIP asset from the community release workflow and added provenance attestations for `main.js`, `manifest.json`, and `styles.css`.
- Removed external URLs from packaged theme CSS and replaced plugin `:has()` styling with explicit classes for review compatibility.
- Limited default Marp and Mermaid theme installation to `kami`, `kami-en`, `github`, `beamer`, `olive`, and `dracula` while keeping the other vault CSS files as non-default examples.
- Embedded those default Marp and Mermaid theme CSS files in the plugin bundle so first-run install and restore-default actions no longer fetch CSS from GitHub.
- Removed separate default CSS sync markers; managed defaults are overwritten from the packaged CSS on startup.
- Updated theme settings so bundled defaults are managed/read-only in the UI, can be forked, and custom themes can be edited.
- Fixed review-listed unsafe TypeScript patterns in Mermaid cache eviction, export error handling, and theme property suggestions.
- Removed the legacy markdown-it container/mark extensions, downloaded Marp engine files, and `lib3` runtime artifact.

## [0.7.0](https://github.com/shuuul/obsidian-marp-extended/compare/0.6.0...0.7.0) (2026-06-29)


### Features

* **export:** use external Marp CLI and packaged themes ([48334d1](https://github.com/shuuul/obsidian-marp-extended/commit/48334d1525c73af5f5fc9de481aa66d3a5bb4a05))
* **settings:** simplify Marp options and detect browsers ([ba95712](https://github.com/shuuul/obsidian-marp-extended/commit/ba95712266dfe164c0655de735bd17655d006403))

## [0.6.0](https://github.com/shuuul/obsidian-marp-extended/compare/0.5.0...0.6.0) (2026-06-27)


### Features

* **kami:** add fenced block DSL ([a7c51df](https://github.com/shuuul/obsidian-marp-extended/commit/a7c51dfcfd905771c46a932f931b07710960457a))

## 0.5.0

- Migrated slide preview to sandboxed iframe rendering using ESM `markdown-it-container` and `markdown-it-mark` plugins.
- Restricted Marp CLI export and optional markdown-it lib loading to desktop Obsidian via `Platform.isDesktop` guards.
- Replaced direct `node:path`/`node:fs` imports with lazy CommonJS `require` for mobile-safe bundling.
- Bumped minimum Obsidian version to 1.7.2 and kept the plugin desktop-only.
- Modernized the ESLint toolchain with `eslint-plugin-obsidianmd` and `typescript-eslint`.
- Cleaned up the preview zoom lifecycle, removed dead debug logging, and fixed unsafe type casts.

## 0.4.0

- Added themed Mermaid diagram rendering as inline SVG for preview/export, including `mermaidTheme` and `mermaidFlat` support.
- Added default theme update controls for bundled Marp and Mermaid themes.
- Added the Kami portfolio slide size and refreshed the README example image.
- Improved preview performance by reducing refresh overhead and caching Mermaid render output plus remote theme assets.
- Fixed preview slide sync after render updates.
- Fixed default theme refresh cache busting and Kami blockquote styling.
- Fixed Kami portfolio PDF/PPTX/HTML exports and removed the PNG export option.
- Added Obsidian plugin reload tooling for local development.
- Updated project, vault, CSS, and Obsidian Marp skill documentation for the current Marp Extended release flow and syntax behavior.

## 0.3.0

- Added Obsidian image wiki-link conversion for Marp preview/export, including alt text, image size directives, URL-encoded paths, and unresolved-link fallback.
- Added installed Marp theme suggestions for the frontmatter theme property.
- Added Marp slide size preset suggestions for theme/frontmatter editing.
- Added an Obsidian Marp syntax skill for development guidance.

## 0.2.0

- Added fit-width Marp preview zoom controls with step zoom, pinch zoom, and zoom state preservation across preview rerenders.
- Added real Marp CLI export coverage for sample deck exports with managed themes across PDF, PDF notes, PPTX, PNG, and HTML outputs.

## 0.1.1

- Fixed Obsidian sidebar and command export actions so failures and output paths are visible in Notices.
- Fixed export path resolution by using Obsidian adapter filesystem paths instead of `app://` resource URLs for Marp CLI.
- Fixed markdown-it engine loading inside Obsidian's renderer by forcing Marp CLI to resolve local engine files through CommonJS during export.
- Fixed PNG export argument construction to produce a single selected output file.
- Updated bundled Kami themes to use pixel-based Marp slide sizes for browser image/PPTX export compatibility.
- Updated fork-owned theme download URLs to `shuuul/obsidian-marp-extended`.
- Added a README screenshot and clarified the dev-only audit note.

## 0.1.0

- Initial Marp Extended fork baseline.
- Renamed plugin metadata from Marp Slides to Marp Extended.
- Refreshed dependencies and build/test maintenance scripts.
- Removed user-facing docs site content; retained developer notes only.
