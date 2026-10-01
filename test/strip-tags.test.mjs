// stripTags tests.
//
// Run: node --test test/strip-tags.test.mjs

import { test } from 'node:test';
import assert from 'node:assert';
import { loadPlugin } from './harness.mjs';

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

// --- Phase 3: bug fixes + features ---
test('removes a non-ASCII tag (Arabic)', () => {
  assert.strictEqual(stripTags('hello #موزريلا world'), 'hello world');
});

test('removes a non-ASCII tag (CJK)', () => {
  assert.strictEqual(stripTags('see #オープンまで now'), 'see now');
});

test('removes an emoji tag', () => {
  assert.strictEqual(stripTags('fun #🥰🥰🥰 times'), 'fun times');
});

test('does not collapse pre-existing double spaces when no tag is removed', () => {
  assert.strictEqual(stripTags('no tags  here'), 'no tags  here');
});

test('inline-only mode leaves frontmatter tags alone', () => {
  const src = '---\ntags: [keep, me]\n---\nhello #tag world';
  assert.strictEqual(stripTags(src, { inlineOnly: true }), '---\ntags: [keep, me]\n---\nhello world');
});
