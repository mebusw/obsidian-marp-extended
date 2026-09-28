# Marp Extended syntax

Marp Extended uses standard [Marpit Markdown](https://marpit.marp.app/markdown)
and [Marp Core Markdown](https://github.com/marp-team/marp-core/blob/main/docs/markdown.md)
as its base language. The plugin adds a small `%%marp-*%%` authoring layer for
layout and semantic wrappers that are awkward to write as raw HTML in Obsidian.

## What is standard and what is Extended

Use standard Marp/Marpit syntax wherever it already exists:

| Need | Syntax owner | Example |
| --- | --- | --- |
| Slides | Marpit | `---` ruler between slides |
| Global/local directives | Marpit | `paginate: true`, `<!-- _class: lead -->` |
| Backgrounds and image sizing | Marpit | `![bg right:40%](image.png)`, `![w:400](image.png)` |
| Fragmented lists | Marpit + preview host | `* item` or `1) item` |
| Presenter notes | Marpit + preview host | ordinary `<!-- comment -->` |
| Scoped styles | Marpit | `<style scoped>...</style>` |
| Fitting headings, emoji, math, code | Marp Core | `# <!-- fit --> Title`, `$E=mc^2$`, fenced code |
| Obsidian image embeds | Marp Extended adapter | `![[image.png\|600]]` |
| Columns, cards, semantic callouts | Marp Extended language | `%%marp-columns%%`, `%%marp-cards[...]%%` |
| Mermaid figures | Marp Extended adapter | fenced `mermaid` block |

Marp Extended does not add alternative syntax for slide separators,
backgrounds, fragments, or presenter notes.

## Deck frontmatter

Deck-wide configuration remains normal Marp frontmatter:

```yaml
---
marp: true
theme: kami
lang: en
mermaidTheme: kami
mermaidFlat: true
size: kami
paginate: true
footer: "Kami · Marp Extended"
---
```

`theme`, `size`, `paginate`, `header`, `footer`, and other Marp directives retain
their upstream meaning. `mermaidTheme` and `mermaidFlat` are plugin additions.

## Slide-local directives

`%%marp-slide[...]%%` is an Obsidian-friendly shorthand for Marpit spot
directives:

```md
%%marp-slide[class=cover paginate=false footer="" header="01 · Origin"]%%
```

It compiles to:

```md
<!-- _class: cover -->
<!-- _paginate: false -->
<!-- _footer: "" -->
<!-- _header: 01 · Origin -->
```

Put the marker on the slide it controls. Quote values containing spaces. Use
standard directive comments directly when the shorthand is not useful.

## Semantic blocks

All blocks use paired Obsidian comment markers. Their contents remain normal
Markdown and can contain headings, lists, code fences, Mermaid fences, or nested
Extended blocks.

| Marker | Stable output class |
| --- | --- |
| `marp-lead` | `marp-extended-lead` |
| `marp-subtitle` | `marp-extended-subtitle` |
| `marp-metadata` | `marp-extended-metadata` |
| `marp-callout[variant=co]` | `marp-extended-callout marp-extended-callout-co` |
| `marp-callout[variant=mc]` | `marp-extended-callout marp-extended-callout-mc` |
| `marp-callout[variant=note]` | `marp-extended-callout marp-extended-callout-note` |

Example:

```md
%%marp-lead%%
Same Markdown, with a reusable semantic wrapper.
%%/marp-lead%%

%%marp-callout[variant=warning]%%
The variant becomes `marp-extended-callout-warning`.
%%/marp-callout%%
```

Callout variants are normalized to lowercase CSS-safe tokens. The only callout
attribute is `variant`; omitting it selects `co`. Variants are theme hooks:
the Kami theme styles `mc` as a secondary note and `co` / `note` as conclusion
callouts.

A callout with `variant=note` is visible slide content, not a presenter note. Use
a standard Marpit HTML comment for presenter notes.

## Columns

Use `%%marp-columns%%` and split columns with `%%marp-column%%`:

````md
%%marp-columns%%
### Standard Marpit

* Fragmented item
* Another item

%%marp-column%%

### Extended layout

```mermaid[Render path]
flowchart LR
  M[Markdown] --> C[Compiler] --> R[Marp Core]
```
%%/marp-columns%%
````

One through six columns receive
`marp-extended-columns-1` … `marp-extended-columns-6`. Each child receives
`marp-extended-column`.

## Cards

Use `columns=N` (1–6) to choose cards per row and split cards with
`%%marp-card%%`:

```md
%%marp-cards[columns=2]%%
### A · Palette
One accent.

%%marp-card%%

### B · Type
One serif.

%%marp-card%%

### C · Layout
Namespaced structural classes.

%%marp-card%%

### D · Runtime
Shared Core 5 semantics.
%%/marp-cards%%
```

The first heading in each card becomes `marp-extended-card-title`. `A · Palette`,
`A: Palette`, and `A：Palette` split the leading label into
`marp-extended-card-label`. `columns` is the only cards attribute; values from 1
through 6 are supported.

## Editor commands

The command palette exposes one insertion command for each canonical form:

- **Insert Marp Extended slide metadata**
- **Insert Marp Extended lead block**
- **Insert Marp Extended subtitle block**
- **Insert Marp Extended metadata block**
- **Insert Marp Extended callout block**
- **Insert Marp Extended columns block**
- **Insert Marp Extended 2x2 cards block**

## Navigation, fragments, and presenter notes in preview

With **Sync preview** on, the pane you are using drives the other pane. See
[preview sync](preview_sync.md).

Selecting rendered text, then clicking the slide, briefly highlights the matching
source text in the editor. With **Sync preview** off, a click with no selection
jumps the editor to the start of that slide. With sync on, a click with no
selection does not jump. Link clicks keep their normal internal or external
navigation behavior.

Marpit marks unordered lists using `*` and ordered lists using `1)` as
fragments:

```md
* First reveal
* Second reveal

1) First ordered reveal
2) Second ordered reveal
```

The Marp Extended preview adds the runtime behavior that Marpit intentionally
leaves to its host application. Fragments start fully revealed so the preview
matches the exported deck. Use the command palette or bind these commands:

- **Next preview fragment** — reveal the next fragment of the active slide
- **Previous preview fragment** — hide the last revealed fragment of the active slide
- **Reset preview fragments** — rewind the active slide so no fragment is revealed,
  ready for a fresh step-through
- **Toggle preview presenter notes**

An ordinary comment becomes a presenter note for its slide:

```md
# Public slide

<!--
Private presenter note. This is shown as text in the preview notes panel.
-->
```

Directive comments such as `<!-- _class: lead -->` are directives, not notes.
The notes panel renders comments as literal text rather than injected HTML.

## Fences, nesting, and malformed markers

The compiler recognizes CommonMark backtick and tilde fences, including long and
up-to-three-space-indented fences. Marker-looking text inside a fence is left
literal. Nested Extended blocks are compiled recursively.

Ordinary Obsidian comments such as `%%draft note%%` are unchanged. Unknown,
unclosed, or mismatched Extended markers are also left in the source rather than
silently consuming following content.

## Preview/export runtime contract

Preview and managed export use the same Marp Core 5 engine factory, HTML policy,
inline SVG mode, Shiki subset, MathJax integration, Mermaid fallback, CSS
minification, and Extended structural CSS. Each render receives a fresh engine
instance.

The hosts still own different outer behavior: preview uses an Obsidian iframe,
while Marp CLI owns the HTML template and the browser-backed PDF/PPTX pipeline.
This is semantic parity, not a pixel-for-pixel guarantee across browsers and file
formats.

Managed export requires Marp CLI **4.5.1** and passes the shipped Core 5 engine
through `--engine`. Auto-detected incompatible versions can use the pinned
`@marp-team/marp-cli@4.5.1` npx fallback when enabled. An explicitly configured
incompatible executable fails with a version error instead of silently using a
different rendering contract.

Release/manual installs use `marp-engine.cjs` directly when its hash matches.
Community installs and upgrades materialize a content-addressed engine filename
from the copy embedded in `main.js`, which avoids unsafe in-place replacement on
Windows and lets concurrent exports accept the same verified artifact.

## HTML and trust boundary

HTML is always enabled because Extended layout wrappers and pre-rendered Mermaid
SVG require it. There is no separate “Enable HTML” setting.

Treat decks and themes as trusted author content:

- the Obsidian preview runs in a sandboxed iframe without script permission;
- raw HTML follows standard Marpit HTML handling;
- exported HTML follows Marp CLI's `--html` behavior and may execute
  author-supplied HTML scripts when opened in a browser.

Do not preview or export untrusted Markdown as active HTML without reviewing it.
