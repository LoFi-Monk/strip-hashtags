// =====================================================================
// strip-hashtags - Obsidian plugin
// Remove tags from notes via right-click.
// =====================================================================

const { Plugin, PluginSettingTab, Setting, Notice, Modal, AbstractInputSuggest } = require('obsidian');

// --- Constants ---
const PLUGIN_ID = 'strip-hashtags';
const PLUGIN_NAME = 'Strip Hashtags';
const PLUGIN_VERSION = '0.1.0';
const DEFAULT_SETTINGS = { watchedDirs: [], mode: 'both' }; // mode: 'both' | 'inline'

// --- Logger ---
function log(...args)  { console.log(`[${PLUGIN_ID}]`, ...args); }
function warn(...args) { console.warn(`[${PLUGIN_ID}]`, ...args); }
function err(...args)  { console.error(`[${PLUGIN_ID}]`, ...args); }

// --- Core: stripTags (pure function) ---
/**
 * Strip tags from markdown text.
 *
 * Removes *real* tags only, skipping headings, code blocks / inline code, URLs,
 * and hex colors. Tag chars are Unicode-aware (letters, digits, emoji/symbols,
 * `_` `-` `/`). Also empties the frontmatter `tags:` value while leaving the key
 * behind — unless `inlineOnly` is set, in which case the frontmatter is untouched.
 *
 * Pure — no Obsidian dependency, so it can be unit-tested directly.
 *
 * @param {string} text - the full markdown source of a note
 * @param {{inlineOnly?: boolean}} [opts] - `inlineOnly` skips frontmatter stripping
 * @returns {string} the text with tags removed
 */
function stripTags(text, opts = {}) {
  const { inlineOnly = false } = opts;
  let out = inlineOnly ? text : stripFrontmatterTags(text);
  let removed = false;
  out = out.replace(
    /(```[\s\S]*?```|`[^`]*`)|(?<![\p{L}\p{N}_/])#([\p{L}\p{N}\p{So}_/-]+)/gu,
    (m, code, tag) => {
      if (code !== undefined) return code; // code block / inline code — leave as-is
      if (isHexColor(tag)) return m;        // hex colour, not a tag
      removed = true;
      return '';                            // drop the tag
    }
  );
  // Only collapse double-spaces if we actually removed an inline tag — otherwise
  // leave pre-existing formatting alone.
  return removed ? out.replace(/[ \t]{2,}/g, ' ') : out;
}

/**
 * Empty the frontmatter `tags:` value (inline array or YAML list), leaving the
 * `tags:` key behind. Only the standard lowercase `tags:` key is touched.
 *
 * @param {string} text - markdown source
 * @returns {string} text with the frontmatter tags value emptied
 */
function stripFrontmatterTags(text) {
  const m = text.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (!m) return text;
  const body = m[2].replace(/^tags:[^\n]*(?:\n[ \t]+-[^\n]*)*/m, 'tags: []');
  return m[1] + body + m[3] + text.slice(m[0].length);
}

/** True when `token` is a bare 3/6/8-digit hex colour rather than a tag. */
function isHexColor(token) {
  return /^[0-9a-fA-F]{3}$/.test(token)
      || /^[0-9a-fA-F]{6}$/.test(token)
      || /^[0-9a-fA-F]{8}$/.test(token);
}

/**
 * Find the enabled watch entry that covers a file path (recursive prefix match).
 *
 * @param {string} filePath - vault-relative path of the file
 * @param {Array<{path: string, enabled?: boolean}>} watchedDirs - the watch list
 * @returns {object|null} the matching entry, or null if the file isn't watched
 */
function isWatched(filePath, watchedDirs) {
  const p = filePath.replace(/\\/g, '/');
  return (watchedDirs || []).find(d => {
    if (!d || d.enabled === false) return false;
    const dir = String(d.path || '').replace(/\/+$/, '');
    return dir !== '' && p.startsWith(dir + '/');
  }) || null;
}

/**
 * Filter vault folder paths by a case-insensitive query (for the combobox).
 *
 * @param {string[]} folders - vault folder paths
 * @param {string} query - the user's typed filter
 * @returns {string[]} matching folders (all of them when the query is empty)
 */
function filterFolders(folders, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return folders.slice();
  return folders.filter(f => f.toLowerCase().includes(q));
}

// --- Notice helper ---
const notice = {
  success(msg) { new Notice(`\u2713 ${msg}`, 4000); },
  error(msg)   { new Notice(`\u2717 ${msg}`, 8000); },
  info(msg)    { new Notice(`\u2139 ${msg}`, 4000); },
  warn(msg)    { new Notice(`\u26A0 ${msg}`, 0); },
};

// --- Confirmation modal ---
class ConfirmModal extends Modal {
  constructor(app, title, message, onConfirm) {
    super(app);
    this._title = title;
    this._message = message;
    this._onConfirm = onConfirm;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h3', { text: this._title });
    contentEl.createEl('p', { text: this._message });
    new Setting(contentEl)
      .addButton(btn => btn.setButtonText('Cancel').onClick(() => this.close()))
      .addButton(btn => btn.setButtonText('Confirm').setCta().onClick(() => {
        try { this._onConfirm(); } catch (e) { err('ConfirmModal:', e); }
        this.close();
      }));
  }
}

// --- Settings tab ---
class FolderSuggest extends AbstractInputSuggest {
  constructor(app, inputEl, folders, onSelect) {
    super(app, inputEl);
    this._folders = folders;
    this._onSelect = onSelect;
  }
  getSuggestions(query) { return filterFolders(this._folders, query); }
  renderSuggestion(value, el) { el.setText(value); }
  selectSuggestion(value) { this._onSelect(value); this.close(); }
}

class StripHashtagsSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: PLUGIN_NAME });
    containerEl.createEl('p', {
      text: 'Automatically strip tags from new files that land in watched folders (subfolders included).',
    });

    new Setting(containerEl)
      .setName('Strip mode')
      .setDesc('Both inline + frontmatter, or inline tags only.')
      .addDropdown((d) =>
        d
          .addOption('both', 'Both (inline + frontmatter)')
          .addOption('inline', 'Inline only')
          .setValue(this.plugin.settings.mode || 'both')
          .onChange(async (v) => {
            this.plugin.settings.mode = v;
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl('h3', { text: 'Watched folders' });
    const dirs = this.plugin.settings.watchedDirs || [];
    if (dirs.length === 0) {
      containerEl.createEl('p', { text: 'None yet — add one below.', cls: 'setting-item-description' });
    }
    for (const entry of dirs) {
      new Setting(containerEl)
        .setName(entry.path)
        .addToggle((t) =>
          t.setValue(entry.enabled !== false).onChange(async (v) => {
            entry.enabled = v;
            await this.plugin.saveSettings();
          })
        )
        .addExtraButton((b) =>
          b.setIcon('trash').setTooltip('Remove').onClick(async () => {
            this.plugin.settings.watchedDirs = dirs.filter((d) => d !== entry);
            await this.plugin.saveSettings();
            this.display();
          })
        );
    }

    new Setting(containerEl)
      .setName('Add a folder')
      .setDesc('Type to filter, then pick a folder to watch.')
      .addText((text) => {
        text.setPlaceholder('Search folders…');
        new FolderSuggest(this.app, text.inputEl, this._allFolders(), (path) => {
          if (!this.plugin.settings.watchedDirs.some((d) => d.path === path)) {
            this.plugin.settings.watchedDirs.push({ path, enabled: true });
            this.plugin.saveSettings();
          }
          text.setValue('');
          this.display();
        });
      });
  }

  _allFolders() {
    const folders = [];
    this.app.vault.getAllLoadedFiles().forEach((f) => {
      if (f && Array.isArray(f.children)) folders.push(f.path);
    });
    return folders.sort();
  }
}

// --- Plugin ---
class StripHashtagsPlugin extends Plugin {
  async onload() {
    log(`loading v${PLUGIN_VERSION}`);
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() || {});

    // Right-click context menu
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        menu.addItem((item) =>
          item.setTitle('Strip hashtags').setIcon('tag').onClick(() => this.stripTargets(file))
        );
      })
    );

    // --- Directory watcher ---
    //
    // Strips tags from files that land in watched folders. Listens to three events:
    //   - 'create' — a new note (e.g. the Web Clipper creating the file)
    //   - 'rename' — a note moved INTO a watched folder
    //   - 'modify' — needed because the Web Clipper writes a note in stages: it
    //               creates the file, adds a template, THEN fills in the body
    //               (where the tags live). Those later writes fire as 'modify',
    //               so we re-strip within a short window after arrival.
    //
    // `_arrived` records when a file first arrived (create/rename); `_onModify`
    // only re-strips within 15s of that, so the user's own later edits are never
    // touched. `_stripping` guards against re-entry (our own `vault.modify` also
    // fires 'modify', which would otherwise loop).
    this._stripping = new Set();
    this._arrived = new Map(); // file path -> arrival timestamp (ms)
    this.registerEvent(this.app.vault.on('create', (file) => this._onArrival(file)));
    this.registerEvent(this.app.vault.on('rename', (file) => this._onArrival(file)));
    this.registerEvent(this.app.vault.on('modify', (file) => this._onModify(file)));

    this.addCommand({
      id: 'strip-active-note',
      name: 'Strip hashtags on current note',
      callback: () => {
        const f = this.app.workspace.getActiveFile();
        if (f) this._stripFiles([f]);
      },
    });

    this.addSettingTab(new StripHashtagsSettingTab(this.app, this));
    log('ready');
  }

  /** A file just arrived (created or moved) in a watched folder. */
  _onArrival(file) {
    if (!file || file.extension !== 'md') return;
    if (!isWatched(file.path, this.settings.watchedDirs)) return;
    this._arrived.set(file.path, Date.now());
    this._stripGuarded(file);
  }

  /**
   * A watched file changed. Re-strips only shortly after arrival — this catches
   * the Web Clipper's staged write (create → template → fill) without touching
   * the user's own edits made later than 15s after the file arrived.
   */
  _onModify(file) {
    if (!file || file.extension !== 'md') return;
    if (!isWatched(file.path, this.settings.watchedDirs)) return;
    const arrived = this._arrived.get(file.path);
    if (!arrived || Date.now() - arrived > 15000) return; // ignore edits long after arrival
    this._stripGuarded(file);
  }

  /** Strip a watched file once, guarded against re-entry. */
  async _stripGuarded(file) {
    if (this._stripping.has(file.path)) return;
    this._stripping.add(file.path);
    try { await this._stripFiles([file]); }
    finally { this._stripping.delete(file.path); }
  }

  /** Strip for a right-clicked target (a note, a multi-selection, or a folder). */
  stripTargets(target) {
    const files = this._collect(target);
    if (files.length === 0) { notice.info('No markdown files to strip.'); return; }
    const run = () => this._stripFiles(files);
    if (files.length > 1) {
      new ConfirmModal(this.app, 'Strip hashtags',
        `Strip tags from ${files.length} files?`, run).open();
    } else {
      run();
    }
  }

  /** Collect the `.md` files a target expands to. */
  _collect(target) {
    if (Array.isArray(target.children)) {
      const files = [];
      this._folderFiles(target, files); // recursive — .md at any depth
      return files;
    }
    const selected = this._selected();
    return selected.length > 1 ? selected : [target];
  }

  /** Walk a folder recursively, collecting `.md` files. */
  _folderFiles(folder, out) {
    for (const child of folder.children) {
      if (Array.isArray(child.children)) this._folderFiles(child, out);
      else if (child.extension === 'md') out.push(child);
    }
  }

  /** Selected files in the file explorer (for multi-select right-clicks). */
  _selected() {
    return Array.from(document.querySelectorAll('.nav-file.is-selected'))
      .map(el => this.app.vault.getAbstractFileByPath(el.getAttribute('data-path')))
      .filter(f => f && f.extension === 'md');
  }

  /** Strip tags from each file and report how many changed. */
  async _stripFiles(files) {
    let count = 0;
    for (const f of files) {
      const text = await this.app.vault.read(f);
      const out = stripTags(text, { inlineOnly: this.settings.mode === 'inline' });
      if (out !== text) { await this.app.vault.modify(f, out); count++; }
    }
    notice.success(`Stripped tags from ${count} file${count === 1 ? '' : 's'}.`);
  }

  /** Strip a single file by vault path (no modal) — usable by the agent via `eval`. */
  async stripPath(path) {
    const f = this.app.vault.getAbstractFileByPath(path);
    if (!f || f.extension !== 'md') { warn('stripPath: no markdown file at', path); return; }
    await this._stripFiles([f]);
  }

  async saveSettings() { await this.saveData(this.settings); }

  onunload() { log('unloaded'); }
}

module.exports = StripHashtagsPlugin;
module.exports.stripTags = stripTags;          // exposed for the test harness
module.exports.isWatched = isWatched;
module.exports.filterFolders = filterFolders;
