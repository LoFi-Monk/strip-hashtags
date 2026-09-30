// =====================================================================
// strip-hashtags - Obsidian plugin
// Remove tags from notes via right-click.
// =====================================================================

const { Plugin, PluginSettingTab, Setting, Notice, Modal } = require('obsidian');

// --- Constants ---
const PLUGIN_ID = 'strip-hashtags';
const PLUGIN_NAME = 'Strip Hashtags';
const PLUGIN_VERSION = '0.1.0';
const DEFAULT_SETTINGS = {};

// --- Logger ---
function log(...args)  { console.log(`[${PLUGIN_ID}]`, ...args); }
function warn(...args) { console.warn(`[${PLUGIN_ID}]`, ...args); }
function err(...args)  { console.error(`[${PLUGIN_ID}]`, ...args); }

// --- Core: stripTags (pure function) ---
/**
 * Strip tags from markdown text.
 *
 * Removes *real* tags only (`#` + letters/digits/`_`/`-`/`/`), skipping headings,
 * code blocks / inline code, URLs, and hex colors. Also empties the frontmatter
 * `tags:` value while leaving the key behind.
 *
 * Pure — no Obsidian dependency, so it can be unit-tested directly.
 *
 * @param {string} text - the full markdown source of a note
 * @returns {string} the text with tags removed
 */
function stripTags(text) {
  return stripFrontmatterTags(text)
    // Remove inline tags, leaving fenced + inline code untouched.
    .replace(/(```[\s\S]*?```|`[^`]*`)|(?<![\w/])#([A-Za-z0-9_/-]+)/g, (m, code, tag) => {
      if (code !== undefined) return code; // code block / inline code — leave as-is
      if (isHexColor(tag)) return m;        // hex colour, not a tag
      return '';                            // drop the tag
    })
    // Collapse the double space a removed tag leaves behind.
    .replace(/[ \t]{2,}/g, ' ');
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

// --- Settings tab (dormant - phase 2) ---
class StripHashtagsSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: PLUGIN_NAME });
    containerEl.createEl('p', { text: 'Directory-watcher settings will live here (phase 2).' });
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

    this.addSettingTab(new StripHashtagsSettingTab(this.app, this));
    log('ready');
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
      return target.children.filter(f => f.extension === 'md'); // folder — direct .md only
    }
    const selected = this._selected();
    return selected.length > 1 ? selected : [target];
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
      const out = stripTags(text);
      if (out !== text) { await this.app.vault.modify(f, out); count++; }
    }
    notice.success(`Stripped tags from ${count} file${count === 1 ? '' : 's'}.`);
  }

  onunload() { log('unloaded'); }
}

module.exports = StripHashtagsPlugin;
module.exports.stripTags = stripTags;  // exposed for the test harness
