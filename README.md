# Strip Hashtags

An [Obsidian](https://obsidian.md) plugin to remove hashtags from your notes.

Built for the **Obsidian Web Clipper** workflow: clipped pages arrive full of foreign tags that pollute your tag pane. Strip them away — manually or automatically — and re-tag yourself.

## Features

- **Right-click → "Strip hashtags"** on:
  - a single note
  - a multi-selected group of notes
  - a folder (recursive — every `.md` file inside it)
- **Careful matching** — removes only *real* tags (`#tag`, `#nested/tag`, `#موزريلا`, `#オープンまで`), leaving alone headings (`# Heading`), code blocks, URLs (`…#fragment`), and hex colors (`#ffffff`).
- **Inline + frontmatter tags** — strips `#tags` in the body *and* empties the `tags:` property to `tags: []` (the key stays).
- **Inline-only mode** — a setting to strip body hashtags while leaving the frontmatter `tags:` untouched (for filed notes with real frontmatter tags).
- **Directory watcher** — watch a folder and strip tags automatically from new files that land there (created, moved, or clipped). Subfolders included.
- **Safety** — multi-file operations ask for confirmation; a notice always reports what happened.

## Install

1. Copy this repo into `.obsidian/plugins/strip-hashtags/` (or install from the Obsidian community list once it's listed).
2. Enable **Strip Hashtags** in Settings → Community plugins.

## Usage

### Manual

Right-click a note, a group, or a folder in the file explorer → **Strip hashtags**.

### Automatic (directory watcher)

1. Settings → Strip Hashtags.
2. Under **Watched folders**, use the combobox to add a folder.
3. Drop, move, or clip a file into that folder — its tags are stripped on arrival. Toggling a folder off pauses it.

### Command palette

**"Strip hashtags on current note"** strips the note you're viewing.

## For agents / scripts

Two ways to strip programmatically:

```js
// by path, via eval:
app.plugins.plugins['strip-hashtags'].stripPath('path/to/note.md')

// or via the command:
app.commands.executeCommandById('strip-hashtags:strip-active-note')
```

## Development

```bash
node --test   # 28 tests, no Obsidian needed
```

The tag-stripping logic (`stripTags`, `isWatched`, `filterFolders`) is pure and unit-tested; the Obsidian glue lives in the same `main.js`. No build step.
