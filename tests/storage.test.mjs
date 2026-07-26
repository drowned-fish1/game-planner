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

  test('imported content is deep-copied and edge fields are sanitized', () => {
    const source = {
      format: 'game-planner-project',
      version: 1,
      exportedAt: 1,
      meta: { id: 'orig', name: '   ', cover: 12345, lastModified: 1 },
      content: storage.loadProjectContent('missing'),
    };
    const imported = storage.importProject(JSON.stringify(source));
    // 空白名/非法封面回退
    assert.equal(imported.name, '导入的项目');
    assert.equal(imported.cover, '');

    // 深拷贝：改导入后的内容不影响再次导入
    const stored = readStore();
    stored.contents[imported.id].docs.push({ id: 'x', title: 't', content: '', parentId: null });
    memory.set(STORE_KEY, JSON.stringify(stored));
    const imported2 = storage.importProject(JSON.stringify(source));
    assert.deepEqual(readStore().contents[imported2.id].docs, []);
  });

  test('export of a missing project returns null', () => {
    assert.equal(storage.exportProject('ghost'), null);
  });

  test('localStorage read failures fall back to safe defaults', () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      globalThis.localStorage.getItem = () => { throw new Error('privacy mode'); };
      assert.deepEqual(storage.getProjectsList(), []);
    } finally {
      console.error = originalError;
    }
  });

  test('localStorage write failures do not crash the save call', () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      globalThis.localStorage.setItem = () => { throw new Error('quota exceeded'); };
      assert.doesNotThrow(() => storage.saveProjectsList([{ id: 'p', name: 'n', cover: '', lastModified: 1 }]));
    } finally {
      console.error = originalError;
    }
  });
});

describe('storage electron IPC', () => {
  test('loads via sendSync and survives IPC read failures', () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      // 正常读取
      globalThis.window = {
        electronAPI: {
          sendSync: (channel) => (channel === 'load-data-sync'
            ? JSON.stringify({ projects: [{ id: 'e1', name: 'Electron 项目', cover: '', lastModified: 1 }], contents: {}, configs: {} })
            : null),
        },
      };
      assert.equal(storage.getProjectsList()[0].name, 'Electron 项目');

      // IPC 抛错 → 安全默认值
      globalThis.window = {
        electronAPI: { sendSync: () => { throw new Error('ipc dead'); } },
      };
      assert.deepEqual(storage.getProjectsList(), []);
    } finally {
      console.error = originalError;
    }
  });

  test('IPC write failures do not crash the save call', () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      let loadCalls = 0;
      globalThis.window = {
        electronAPI: {
          sendSync: (channel) => {
            if (channel === 'load-data-sync') { loadCalls += 1; return null; }
            throw new Error('disk full');
          },
        },
      };
      assert.doesNotThrow(() => storage.saveProjectsList([{ id: 'p', name: 'n', cover: '', lastModified: 1 }]));
      assert.ok(loadCalls > 0);
    } finally {
      console.error = originalError;
    }
  });
});

describe('storage legacy archives', () => {
  test('page without type/components gets defaults without touching valid data', () => {
    memory.set(STORE_KEY, JSON.stringify({
      projects: [],
      configs: {},
      contents: {
        old: {
          brainstorm: { items: [{ id: 'n1', type: 'text', content: 'hi', x: 1, y: 2 }], connections: [] },
          members: [],
          todos: [],
          docs: [],
          ui: { pages: [{ id: 'p1', name: '旧页面', width: 100, height: 100, backgroundColor: '#000' }] },
        },
      },
    }));

    const content = storage.loadProjectContent('old');
    assert.equal(content.ui.pages[0].type, 'screen');
    assert.deepEqual(content.ui.pages[0].components, []);
    assert.deepEqual(content.assets, []);
    // 原有数据原样保留
    assert.equal(content.brainstorm.items[0].content, 'hi');
  });
});
