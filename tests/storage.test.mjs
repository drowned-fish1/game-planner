import assert from 'node:assert/strict';
import { before, beforeEach, describe, test } from 'node:test';
import { loadSourceModule } from './helpers/vite-loader.mjs';

const STORE_KEY = 'gp_all_data';
const memory = new Map();
let storage;

function installBrowserStorage() {
  globalThis.window = { electronAPI: undefined };
  globalThis.localStorage = {
    getItem(key) {
      return memory.has(key) ? memory.get(key) : null;
    },
    setItem(key, value) {
      memory.set(key, String(value));
    },
    removeItem(key) {
      memory.delete(key);
    },
    clear() {
      memory.clear();
    },
  };
}

function readStore() {
  return JSON.parse(memory.get(STORE_KEY));
}

before(async () => {
  storage = await loadSourceModule('/src/utils/storage.ts');
});

beforeEach(() => {
  memory.clear();
  installBrowserStorage();
});

describe('storage browser fallback', () => {
  test('returns safe defaults for missing or corrupted data', () => {
    assert.deepEqual(storage.getProjectsList(), []);
    assert.deepEqual(storage.loadProjectContent('missing'), {
      brainstorm: { items: [], connections: [] },
      members: [],
      todos: [],
      docs: [],
      assets: [],
      ui: { pages: [] },
    });

    const originalError = console.error;
    console.error = () => {};
    try {
      memory.set(STORE_KEY, '{not valid json');
      assert.deepEqual(storage.getProjectsList(), []);
    } finally {
      console.error = originalError;
    }
  });

  test('migrates legacy UI components when loading project content', () => {
    memory.set(STORE_KEY, JSON.stringify({
      projects: [],
      configs: {},
      contents: {
        legacy: {
          brainstorm: { items: [], connections: [] },
          members: [],
          todos: [],
          docs: [],
          ui: {
            pages: [{
              id: 'page-1',
              name: 'Legacy',
              width: 320,
              height: 480,
              backgroundColor: '#000',
              components: [{
                id: 'component-1',
                name: 'Old fixed component',
                type: 'fixed',
                x: 0,
                y: 0,
                width: 10,
                height: 10,
              }],
            }],
          },
        },
      },
    }));

    const content = storage.loadProjectContent('legacy');
    const page = content.ui.pages[0];
    const component = page.components[0];

    assert.deepEqual(content.assets, []);
    assert.equal(page.type, 'screen');
    assert.equal(component.type, 'sprite');
    assert.equal(component.zIndex, 1);
    assert.deepEqual(component.interaction, { type: 'none' });
    assert.deepEqual(component.state, {
      isVisible: true,
      isActive: false,
      isDisabled: false,
    });
  });

  test('persists content and updates the project modification time', () => {
    const originalNow = Date.now;
    Date.now = () => 123456;
    try {
      storage.saveProjectsList([{
        id: 'project-1',
        name: 'Test project',
        cover: '',
        lastModified: 1,
      }]);

      const content = storage.loadProjectContent('missing');
      storage.saveProjectContent('project-1', content);

      const store = readStore();
      assert.equal(store.projects[0].lastModified, 123456);
      assert.deepEqual(store.contents['project-1'], content);
    } finally {
      Date.now = originalNow;
    }
  });

  test('imports a valid export as a new project and rejects invalid files', () => {
    const content = storage.loadProjectContent('missing');
    const raw = JSON.stringify({
      format: 'game-planner-project',
      version: 1,
      exportedAt: 1,
      meta: {
        id: 'original-id',
        name: 'Imported project',
        cover: '#123456',
        lastModified: 1,
      },
      content,
    });

    const imported = storage.importProject(raw);
    assert.notEqual(imported.id, 'original-id');
    assert.equal(imported.name, 'Imported project');

    const exported = storage.exportProject(imported.id);
    assert.equal(exported.format, 'game-planner-project');
    assert.equal(exported.version, 1);
    assert.deepEqual(exported.content, content);

    assert.throws(() => storage.importProject('not-json'));
    assert.throws(() => storage.importProject('{"format":"other"}'));
    assert.throws(() => storage.importProject(JSON.stringify({
      format: 'game-planner-project',
      version: 2,
      meta: { name: 'Future project' },
      content,
    })));
  });
});
