// Test harness for strip-hashtags.
//
// Loads main.js in a sandbox with a stubbed `obsidian` module so we can reach
// the pure `stripTags` function without running inside Obsidian.
//
// Run: node --test test/strip-tags.test.mjs

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const MAIN = path.join(__dirname, '..', 'main.js');

/** Load main.js with a stubbed obsidian module; return its exports. */
function loadPlugin() {
  const src = readFileSync(MAIN, 'utf8');
  const sandbox = {
    module: { exports: {} },
    exports: {},
    require: (name) => {
      if (name === 'obsidian') {
        return {
          Plugin: class {},
          PluginSettingTab: class {},
          Setting: class {},
          Notice: class {},
          Modal: class {},
        };
      }
      return require(name);
    },
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.module.exports;
}

const { stripTags } = loadPlugin();

// --- Phase 0: harness smoke tests ---
test('stripTags is exported as a function', () => {
  assert.strictEqual(typeof stripTags, 'function');
});

test('plain text with no tags is unchanged', () => {
  assert.strictEqual(stripTags('just plain text'), 'just plain text');
});

// --- Phase 1: inline tags ---
test('removes a simple inline tag', () => {
  assert.strictEqual(stripTags('hello #tag world'), 'hello world');
});

test('removes a nested inline tag', () => {
  assert.strictEqual(stripTags('see #agents/research now'), 'see now');
});

test('keeps markdown headings', () => {
  assert.strictEqual(stripTags('# Heading text'), '# Heading text');
});

test('keeps tags inside fenced code blocks', () => {
  const src = '```\n# not a tag\n```';
  assert.strictEqual(stripTags(src), src);
});

test('keeps tags inside inline code', () => {
  assert.strictEqual(stripTags('use `#notatag` here'), 'use `#notatag` here');
});

test('keeps URL fragments', () => {
  assert.strictEqual(stripTags('https://site.com/page#section'), 'https://site.com/page#section');
});

test('keeps hex colors', () => {
  assert.strictEqual(stripTags('#ff5733'), '#ff5733');
});

test('collapses the left-behind double space', () => {
  assert.strictEqual(stripTags('word #tag word'), 'word word');
});

// --- Phase 2: frontmatter tags ---
test('empties an inline-array frontmatter tags line', () => {
  const src = '---\ntitle: X\ntags: [a, b]\n---\nbody';
  assert.strictEqual(stripTags(src), '---\ntitle: X\ntags: []\n---\nbody');
});

test('empties a list-form frontmatter tags', () => {
  const src = '---\ntags:\n  - a\n  - b\n---\nbody';
  assert.strictEqual(stripTags(src), '---\ntags: []\n---\nbody');
});

test('leaves tag: and Tags: alone', () => {
  const src = '---\ntag: [a]\nTags: [b]\n---\nbody';
  assert.strictEqual(stripTags(src), src);
});
