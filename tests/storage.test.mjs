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
  // 迭代 32 引入进程内原始串缓存：每个用例都要从后端重新读
  storage.resetStorageCacheForTests();
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

      // IPC 抛错 → 安全默认值（切换后端需重置缓存，模拟另一次冷启动）
      globalThis.window = {
        electronAPI: { sendSync: () => { throw new Error('ipc dead'); } },
      };
      storage.resetStorageCacheForTests();
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

describe('storage cache & browser backup (迭代 32)', () => {
  test('raw cache skips repeated backend reads after first load/save', () => {
    let ipcReads = 0;
    globalThis.window = {
      electronAPI: {
        sendSync: (channel, data) => {
          if (channel === 'load-data-sync') { ipcReads += 1; return null; }
          if (channel === 'save-data-sync') { void data; return true; }
          return null;
        },
      },
    };
    storage.resetStorageCacheForTests();

    storage.getProjectsList();
    storage.getProjectsList();
    assert.equal(ipcReads, 1); // 第二次命中缓存

    storage.saveProjectsList([{ id: 'p', name: 'n', cover: '', lastModified: 1 }]);
    const after = storage.getProjectsList();
    assert.equal(after[0].id, 'p');
    assert.equal(ipcReads, 1); // 保存后仍走缓存，不再回读

    // 每次 load 返回独立对象（无别名）：改返回值不影响下一次读取
    after.push({ id: 'ghost', name: 'x', cover: '', lastModified: 2 });
    assert.equal(storage.getProjectsList().length, 1);
  });

  test('corrupt main key recovers from browser backup key and rewrites it', () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      const backup = JSON.stringify({
        projects: [{ id: 'saved', name: '备份里的项目', cover: '', lastModified: 1 }],
        contents: {},
        configs: {},
      });
      memory.set(STORE_KEY, '{corrupted!!!');
      memory.set('gp_all_data_backup', backup);

      const projects = storage.getProjectsList();
      assert.equal(projects[0].id, 'saved');
      // 主键被备份内容修复
      assert.equal(memory.get(STORE_KEY), backup);
      // 一次性恢复通知可取用，且只能取一次
      const notice = storage.consumeStorageRecoveryNotice();
      assert.match(notice, /已从本地备份恢复/);
      assert.equal(storage.consumeStorageRecoveryNotice(), null);
    } finally {
      console.error = originalError;
    }
  });

  test('corrupt main key without backup keeps evidence and resets safely', () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      memory.set(STORE_KEY, '{corrupted!!!');
      assert.deepEqual(storage.getProjectsList(), []);
      // 损坏原文保留可人工抢救
      assert.equal(memory.get('gp_all_data_corrupt'), '{corrupted!!!');
      assert.match(storage.consumeStorageRecoveryNotice(), /无可用备份/);
    } finally {
      console.error = originalError;
    }
  });

  test('JSON with the wrong store shape is treated as corrupt and recovered', () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      const backup = JSON.stringify({ projects: [], contents: {}, configs: {} });
      memory.set(STORE_KEY, '[]');
      memory.set('gp_all_data_backup', backup);

      assert.deepEqual(storage.getProjectsList(), []);
      assert.equal(memory.get(STORE_KEY), backup);
      assert.match(storage.consumeStorageRecoveryNotice(), /已从本地备份恢复/);
    } finally {
      console.error = originalError;
    }
  });

  test('frozen writes are dropped until unfreeze (restore-in-progress guard)', () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      storage.saveProjectsList([{ id: 'keep', name: '恢复后的数据', cover: '', lastModified: 1 }]);
      storage.freezeStorageWrites();
      // 冻结期间的写入（如挂起的 autosave）必须被丢弃，不能覆盖磁盘
      storage.saveProjectsList([{ id: 'stale', name: '旧数据', cover: '', lastModified: 2 }]);
      assert.equal(readStore().projects[0].id, 'keep');

      storage.unfreezeStorageWrites();
      storage.saveProjectsList([{ id: 'fresh', name: '解除后可写', cover: '', lastModified: 3 }]);
      assert.equal(readStore().projects[0].id, 'fresh');
    } finally {
      console.warn = originalWarn;
    }
  });

  test('rolling browser backup lands every N saves; manual backup/restore round-trips', () => {
    // 手动备份 + 恢复
    storage.saveProjectsList([{ id: 'p1', name: 'v1', cover: '', lastModified: 1 }]);
    assert.equal(storage.backupNowInBrowser(), true);
    assert.ok(storage.getBrowserBackupInfo());

    storage.saveProjectsList([{ id: 'p1', name: 'v2', cover: '', lastModified: 2 }]);
    assert.equal(storage.getProjectsList()[0].name, 'v2');

    assert.equal(storage.restoreBrowserBackup(), true);
    assert.equal(storage.getProjectsList()[0].name, 'v1');

    // 滚动备份：20 次保存后自动落一份
    for (let i = 0; i < 20; i += 1) {
      storage.saveProjectsList([{ id: 'p1', name: `auto-${i}`, cover: '', lastModified: i }]);
    }
    const backup = JSON.parse(memory.get('gp_all_data_backup'));
    assert.match(backup.projects[0].name, /auto-/);
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
