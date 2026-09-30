// isWatched + filterFolders tests.
//
// Run: node --test test/watcher.test.mjs

import { test } from 'node:test';
import assert from 'node:assert';
import { loadPlugin } from './harness.mjs';

const { isWatched, filterFolders } = loadPlugin();

const DIRS = [
  { path: '00 Inbox', enabled: true },
  { path: 'Clippings', enabled: true },
  { path: 'Paused', enabled: false },
];

// --- isWatched ---
test('isWatched: matches a file directly in the directory', () => {
  assert.ok(isWatched('00 Inbox/clip.md', DIRS));
});

test('isWatched: matches a file in a subfolder (recursive)', () => {
  assert.ok(isWatched('00 Inbox/sub/clip.md', DIRS));
});

test('isWatched: no match returns null', () => {
  assert.strictEqual(isWatched('Other/clip.md', DIRS), null);
});

test('isWatched: a disabled directory is not watched', () => {
  assert.strictEqual(isWatched('Paused/clip.md', DIRS), null);
});

test('isWatched: a prefix collision does not match', () => {
  assert.strictEqual(isWatched('00 Inbox-old/clip.md', DIRS), null);
});

test('isWatched: tolerates a trailing slash on the directory', () => {
  assert.ok(isWatched('Clippings/x.md', [{ path: 'Clippings/', enabled: true }]));
});

// --- filterFolders ---
const FOLDERS = ['00 Inbox', 'Clippings', 'Projects', 'project-notes', 'archive'];

test('filterFolders: empty query returns all', () => {
  assert.deepStrictEqual(filterFolders(FOLDERS, ''), FOLDERS);
});

test('filterFolders: case-insensitive substring', () => {
  assert.deepStrictEqual(filterFolders(FOLDERS, 'proj'), ['Projects', 'project-notes']);
});

test('filterFolders: no match returns empty', () => {
  assert.deepStrictEqual(filterFolders(FOLDERS, 'zzz'), []);
});
