// Shared test harness for strip-hashtags.
//
// Loads main.js in a sandbox with a stubbed `obsidian` module so the pure
// functions (stripTags, isWatched, filterFolders) can be tested without Obsidian.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const MAIN = path.join(__dirname, '..', 'main.js');

/** Load main.js with a stubbed obsidian module; return its exports. */
export function loadPlugin() {
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
          AbstractInputSuggest: class {},
        };
      }
      return require(name);
    },
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    document: { querySelectorAll: () => [] },
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.module.exports;
}
