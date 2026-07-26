import assert from 'node:assert/strict';
import { before, beforeEach, describe, test } from 'node:test';
import { loadSourceModule } from './helpers/vite-loader.mjs';

let theme;
const memory = new Map();
let storageThrows = false;
const rootClasses = new Set();

function installDom() {
  globalThis.window = { electronAPI: undefined, location: { protocol: 'http:' } };
  globalThis.localStorage = {
    getItem(key) {
      if (storageThrows) throw new Error('storage disabled');
      return memory.has(key) ? memory.get(key) : null;
    },
    setItem(key, value) {
      if (storageThrows) throw new Error('storage disabled');
      memory.set(key, String(value));
    },
    removeItem(key) { memory.delete(key); },
    clear() { memory.clear(); },
  };
  globalThis.document = {
    documentElement: {
      classList: {
        add: (c) => rootClasses.add(c),
        remove: (c) => rootClasses.delete(c),
        contains: (c) => rootClasses.has(c),
        toggle: (c, force) => {
          const next = force === undefined ? !rootClasses.has(c) : force;
          if (next) rootClasses.add(c); else rootClasses.delete(c);
          return next;
        },
      },
    },
    body: { offsetWidth: 0 },
  };
}

before(async () => {
  installDom();
  theme = await loadSourceModule('/src/utils/theme.ts');
});

beforeEach(() => {
  memory.clear();
  rootClasses.clear();
  storageThrows = false;
  installDom();
});

describe('theme', () => {
  test('defaults to dark when nothing is stored', () => {
    assert.equal(theme.getTheme(), 'dark');
  });

  test('reads persisted light preference', () => {
    memory.set('gp_theme', 'light');
    assert.equal(theme.getTheme(), 'light');
  });

  test('unknown stored value falls back to dark', () => {
    memory.set('gp_theme', 'hotdog');
    assert.equal(theme.getTheme(), 'dark');
  });

  test('setTheme("light") applies the class and persists', () => {
    theme.setTheme('light');
    assert.ok(rootClasses.has('light'));
    assert.equal(memory.get('gp_theme'), 'light');

    theme.setTheme('dark');
    assert.ok(!rootClasses.has('light'));
    assert.equal(memory.get('gp_theme'), 'dark');
  });

  test('transition-suppression class never lingers after applyTheme', () => {
    theme.applyTheme('light');
    assert.ok(!rootClasses.has('theme-switching'));
    theme.applyTheme('dark');
    assert.ok(!rootClasses.has('theme-switching'));
  });

  test('getTheme survives a throwing localStorage (privacy mode)', () => {
    storageThrows = true;
    assert.equal(theme.getTheme(), 'dark');
  });

  test('setTheme still applies the class when persistence fails', () => {
    storageThrows = true;
    assert.doesNotThrow(() => theme.setTheme('light'));
    assert.ok(rootClasses.has('light'));
  });

  test('initTheme applies the stored preference on startup', () => {
    memory.set('gp_theme', 'light');
    theme.initTheme();
    assert.ok(rootClasses.has('light'));
  });
});
