import assert from 'node:assert/strict';
import { before, beforeEach, describe, test } from 'node:test';
import { loadSourceModule } from './helpers/vite-loader.mjs';

let ai;
const memory = new Map();

/** 每个用例注入的 fetch 行为；默认抛错（防止真的发起网络请求） */
let fetchImpl = async () => { throw new Error('fetch not stubbed'); };

function jsonResponse(body, { ok = true, status = 200, statusText = 'OK' } = {}) {
  return {
    ok,
    status,
    statusText,
    json: async () => body,
  };
}

function htmlResponse({ status = 404, statusText = 'Not Found' } = {}) {
  return {
    ok: false,
    status,
    statusText,
    json: async () => { throw new Error('not json'); },
  };
}

const CONFIG = { url: 'http://localhost:1/v1/chat/completions', key: 'k', model: 'm' };

before(async () => {
  globalThis.window = { electronAPI: undefined, location: { protocol: 'http:' } };
  globalThis.localStorage = {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
    clear: () => memory.clear(),
  };
  globalThis.fetch = (...args) => fetchImpl(...args);
  ai = await loadSourceModule('/src/utils/aiService.ts');
});

beforeEach(() => {
  memory.clear();
  fetchImpl = async () => { throw new Error('fetch not stubbed'); };
});

describe('testAIConnection', () => {
  test('rejects empty url / key / model with actionable messages', async () => {
    await assert.rejects(() => ai.testAIConnection({ url: ' ', key: 'k', model: 'm' }), /Endpoint URL/);
    await assert.rejects(() => ai.testAIConnection({ url: 'http://x', key: ' ', model: 'm' }), /API Key/);
    await assert.rejects(() => ai.testAIConnection({ url: 'http://x', key: 'k', model: ' ' }), /模型名称/);
  });

  test('network failure maps to a friendly error', async () => {
    fetchImpl = async () => { throw new TypeError('fetch failed'); };
    await assert.rejects(() => ai.testAIConnection(CONFIG), /网络错误/);
  });

  test('API-level error body takes priority', async () => {
    fetchImpl = async () => jsonResponse({ error: { message: 'Invalid API key' } }, { ok: false, status: 401 });
    await assert.rejects(() => ai.testAIConnection(CONFIG), /Invalid API key/);
  });

  test('non-JSON HTTP failure reports the status code', async () => {
    fetchImpl = async () => htmlResponse({ status: 404, statusText: 'Not Found' });
    await assert.rejects(() => ai.testAIConnection(CONFIG), /HTTP 404/);
  });

  test('missing choices means malformed response', async () => {
    fetchImpl = async () => jsonResponse({ id: 'x' });
    await assert.rejects(() => ai.testAIConnection(CONFIG), /choices/);
  });

  test('resolves on a well-formed completion', async () => {
    fetchImpl = async () => jsonResponse({ choices: [{ message: { content: 'pong' } }] });
    await assert.doesNotReject(() => ai.testAIConnection(CONFIG));
  });
});

describe('requestAI', () => {
  const saveConfigs = (configs, activeId) => {
    memory.set('gp_ai_configs', JSON.stringify(configs));
    if (activeId) memory.set('gp_ai_active_id', activeId);
  };

  test('fails fast when nothing is configured', async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      await assert.rejects(() => ai.requestAI('sys', 'user'), /请先在设置页配置 AI/);
    } finally {
      console.error = originalError;
    }
  });

  test('returns the completion content and toggles the loading callback', async () => {
    saveConfigs([{ id: 'c1', name: 'x', url: 'http://localhost:1/v1', key: 'k', model: 'm' }], 'c1');
    fetchImpl = async () => jsonResponse({ choices: [{ message: { content: '策划案内容' } }] });

    const loadingStates = [];
    const text = await ai.requestAI('sys', 'user', (loading) => loadingStates.push(loading));
    assert.equal(text, '策划案内容');
    assert.deepEqual(loadingStates, [true, false]);
  });

  test('falls back to the first config when the active id is stale', async () => {
    saveConfigs([{ id: 'c1', name: 'x', url: 'http://localhost:1/v1', key: 'k', model: 'm' }], 'ghost');
    let requestedUrl = null;
    fetchImpl = async (url) => { requestedUrl = url; return jsonResponse({ choices: [{ message: { content: 'ok' } }] }); };
    await ai.requestAI('sys', 'user');
    assert.equal(requestedUrl, 'http://localhost:1/v1');
  });

  test('surfaces API errors and empty responses, loading always reset', async () => {
    saveConfigs([{ id: 'c1', name: 'x', url: 'http://localhost:1/v1', key: 'k', model: 'm' }], 'c1');
    const originalError = console.error;
    console.error = () => {};
    try {
      fetchImpl = async () => jsonResponse({ error: { message: 'rate limited' } });
      const loadingStates = [];
      await assert.rejects(
        () => ai.requestAI('sys', 'user', (loading) => loadingStates.push(loading)),
        /rate limited/,
      );
      assert.deepEqual(loadingStates, [true, false]);

      fetchImpl = async () => jsonResponse({ choices: [] });
      await assert.rejects(() => ai.requestAI('sys', 'user'), /无响应数据/);
    } finally {
      console.error = originalError;
    }
  });
});
