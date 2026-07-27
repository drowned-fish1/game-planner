import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { StorageGuard, isParsableStore } = require('../electron/storage-guard.js');

let root;
let dataFile;
let backupDir;
let clock;

function makeGuard(overrides = {}) {
  return new StorageGuard({
    dataFile,
    backupDir,
    rollingLimit: 3,
    dailyLimit: 2,
    manualLimit: 2,
    prerestoreLimit: 2,
    corruptLimit: 2,
    rollingEveryNSaves: 3,
    rollingMinIntervalMs: 60_000,
    now: () => clock,
    ...overrides,
  });
}

const VALID = JSON.stringify({ projects: [{ id: 'p1' }], contents: {}, configs: {} });
const VALID2 = JSON.stringify({ projects: [{ id: 'p1' }, { id: 'p2' }], contents: {}, configs: {} });

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-guard-'));
  dataFile = path.join(root, 'gp_data.json');
  backupDir = path.join(root, 'backups');
  clock = 1_700_000_000_000;
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('isParsableStore', () => {
  test('accepts store-shaped objects and rejects malformed shapes', () => {
    assert.equal(isParsableStore(VALID), true);
    assert.equal(isParsableStore('{broken'), false);
    assert.equal(isParsableStore(''), false);
    assert.equal(isParsableStore('null'), false);
    assert.equal(isParsableStore('42'), false);
    assert.equal(isParsableStore('[]'), false);
    assert.equal(isParsableStore('{}'), false);
    assert.equal(isParsableStore('{"projects":[],"contents":[]}'), false);
    assert.equal(isParsableStore(undefined), false);
  });
});

describe('atomic save', () => {
  test('writes content and leaves no tmp file behind', () => {
    const guard = makeGuard();
    const result = guard.save(VALID);
    assert.equal(result.ok, true);
    assert.equal(fs.readFileSync(dataFile, 'utf-8'), VALID);
    assert.equal(fs.existsSync(`${dataFile}.tmp`), false);
  });

  test('refuses unparsable payload and keeps existing file intact', () => {
    const guard = makeGuard();
    guard.save(VALID);
    const refused = guard.save('{definitely broken');
    assert.equal(refused.ok, false);
    assert.equal(fs.readFileSync(dataFile, 'utf-8'), VALID);
  });

  test('rename failure preserves both the old main file and the complete temp file', () => {
    const guard = makeGuard();
    assert.equal(guard.save(VALID).ok, true);

    const originalRename = fs.renameSync;
    fs.renameSync = () => {
      throw new Error('target locked');
    };
    try {
      const result = guard.save(VALID2);
      assert.equal(result.ok, false);
      assert.equal(fs.readFileSync(dataFile, 'utf-8'), VALID);
      assert.equal(fs.readFileSync(`${dataFile}.tmp`, 'utf-8'), VALID2);
    } finally {
      fs.renameSync = originalRename;
    }
  });
});

describe('load & corruption recovery', () => {
  test('missing file → null without recovery', () => {
    const guard = makeGuard();
    assert.deepEqual(guard.load(), { raw: null, recoveredFrom: null });
  });

  test('healthy file loads as-is', () => {
    const guard = makeGuard();
    guard.save(VALID);
    assert.deepEqual(guard.load(), { raw: VALID, recoveredFrom: null });
  });

  test('corrupt file falls back to newest valid backup and rewrites main file', () => {
    const guard = makeGuard();
    fs.mkdirSync(backupDir, { recursive: true });
    // 旧备份（有效）与更新的备份（也有效）——应选新的
    fs.writeFileSync(path.join(backupDir, 'gp_data.rolling-old.json'), VALID, 'utf-8');
    fs.utimesSync(path.join(backupDir, 'gp_data.rolling-old.json'), new Date(clock - 9000), new Date(clock - 9000));
    fs.writeFileSync(path.join(backupDir, 'gp_data.daily-new.json'), VALID2, 'utf-8');
    fs.utimesSync(path.join(backupDir, 'gp_data.daily-new.json'), new Date(clock - 1000), new Date(clock - 1000));

    fs.writeFileSync(dataFile, '{corrupted!!!', 'utf-8');
    const result = guard.load();

    assert.equal(result.raw, VALID2);
    assert.equal(result.recoveredFrom, 'gp_data.daily-new.json');
    // 主文件被修复回写
    assert.equal(fs.readFileSync(dataFile, 'utf-8'), VALID2);
    // 损坏现场被保留
    const corpses = fs.readdirSync(backupDir).filter((f) => f.startsWith('gp_data.corrupt-'));
    assert.equal(corpses.length, 1);
    assert.equal(fs.readFileSync(path.join(backupDir, corpses[0]), 'utf-8'), '{corrupted!!!');
  });

  test('corrupt backups are skipped in favor of older valid ones', () => {
    const guard = makeGuard();
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(path.join(backupDir, 'gp_data.rolling-good.json'), VALID, 'utf-8');
    fs.utimesSync(path.join(backupDir, 'gp_data.rolling-good.json'), new Date(clock - 9000), new Date(clock - 9000));
    fs.writeFileSync(path.join(backupDir, 'gp_data.rolling-bad.json'), '{also broken', 'utf-8');
    fs.utimesSync(path.join(backupDir, 'gp_data.rolling-bad.json'), new Date(clock - 1000), new Date(clock - 1000));

    fs.writeFileSync(dataFile, 'garbage', 'utf-8');
    const result = guard.load();
    assert.equal(result.raw, VALID);
    assert.equal(result.recoveredFrom, 'gp_data.rolling-good.json');
  });

  test('corrupt file with no usable backup → null, evidence preserved, next save recreates', () => {
    const guard = makeGuard();
    fs.writeFileSync(dataFile, 'oops not json', 'utf-8');
    const result = guard.load();
    assert.equal(result.raw, null);
    const corpses = fs.readdirSync(backupDir).filter((f) => f.startsWith('gp_data.corrupt-'));
    assert.equal(corpses.length, 1);

    assert.equal(guard.save(VALID).ok, true);
    assert.equal(fs.readFileSync(dataFile, 'utf-8'), VALID);
  });
});

describe('rolling backups', () => {
  test('triggered by save count and pruned to limit', () => {
    const guard = makeGuard({ rollingMinIntervalMs: Number.MAX_SAFE_INTEGER });
    guard.lastRollingAt = clock; // 距上次备份间隔清零，只按次数触发
    for (let i = 0; i < 12; i += 1) {
      clock += 1000;
      assert.equal(guard.save(VALID).ok, true);
    }
    const rollings = fs.readdirSync(backupDir).filter((f) => f.startsWith('gp_data.rolling-'));
    // 12 次保存 / 每 3 次一份 = 4 份，prune 保留 3
    assert.equal(rollings.length, 3);
  });

  test('triggered by elapsed time even with few saves', () => {
    const guard = makeGuard({ rollingEveryNSaves: 999 });
    guard.lastRollingAt = clock;
    clock += 61_000; // 超过 rollingMinIntervalMs
    guard.save(VALID);
    const rollings = fs.readdirSync(backupDir).filter((f) => f.startsWith('gp_data.rolling-'));
    assert.equal(rollings.length, 1);
  });
});

describe('daily startup backup', () => {
  test('once per day, skipped for corrupt data, pruned to limit', () => {
    const guard = makeGuard();
    guard.save(VALID);

    guard.makeStartupBackup();
    guard.makeStartupBackup(); // 同一天第二次应为 no-op
    let dailies = fs.readdirSync(backupDir).filter((f) => f.startsWith('gp_data.daily-'));
    assert.equal(dailies.length, 1);

    clock += 24 * 60 * 60 * 1000;
    guard.makeStartupBackup();
    clock += 24 * 60 * 60 * 1000;
    guard.makeStartupBackup();
    dailies = fs.readdirSync(backupDir).filter((f) => f.startsWith('gp_data.daily-'));
    assert.equal(dailies.length, 2); // dailyLimit=2

    fs.writeFileSync(dataFile, 'corrupt now', 'utf-8');
    clock += 24 * 60 * 60 * 1000;
    guard.makeStartupBackup(); // 损坏数据不应进入每日备份
    dailies = fs.readdirSync(backupDir).filter((f) => f.startsWith('gp_data.daily-'));
    assert.equal(dailies.length, 2);
  });
});

describe('manual snapshot & restore', () => {
  test('snapshotNow creates a manual backup; restore replaces data with prerestore safety copy', () => {
    const guard = makeGuard();
    guard.save(VALID);

    const snap = guard.snapshotNow();
    assert.equal(snap.ok, true);
    assert.ok(snap.file.startsWith('gp_data.manual-'));

    // 数据继续演进
    clock += 1000;
    guard.save(VALID2);

    // 从手动快照恢复
    const restore = guard.restoreBackup(snap.file);
    assert.equal(restore.ok, true);
    assert.equal(fs.readFileSync(dataFile, 'utf-8'), VALID);

    // 恢复前的现状被自动快照
    const pre = fs.readdirSync(backupDir).filter((f) => f.startsWith('gp_data.prerestore-'));
    assert.equal(pre.length, 1);
    assert.equal(fs.readFileSync(path.join(backupDir, pre[0]), 'utf-8'), VALID2);
  });

  test('restore rejects path traversal and corrupted/missing backups', () => {
    const guard = makeGuard();
    guard.save(VALID);
    assert.equal(guard.restoreBackup('../gp_data.json').ok, false);
    assert.equal(guard.restoreBackup('gp_data.manual-nope.json').ok, false);

    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(path.join(backupDir, 'arbitrary.json'), VALID2, 'utf-8');
    assert.equal(guard.restoreBackup('arbitrary.json').ok, false);
    fs.writeFileSync(path.join(backupDir, 'gp_data.manual-bad.json'), '{nope', 'utf-8');
    assert.equal(guard.restoreBackup('gp_data.manual-bad.json').ok, false);
    // 主文件未被破坏
    assert.equal(fs.readFileSync(dataFile, 'utf-8'), VALID);
  });

  test('listBackups sorts newest first and excludes corpses', () => {
    const guard = makeGuard();
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(path.join(backupDir, 'gp_data.rolling-a.json'), VALID, 'utf-8');
    fs.utimesSync(path.join(backupDir, 'gp_data.rolling-a.json'), new Date(clock - 5000), new Date(clock - 5000));
    fs.writeFileSync(path.join(backupDir, 'gp_data.manual-b.json'), VALID, 'utf-8');
    fs.utimesSync(path.join(backupDir, 'gp_data.manual-b.json'), new Date(clock - 1000), new Date(clock - 1000));
    fs.writeFileSync(path.join(backupDir, 'gp_data.corrupt-x.json'), 'junk', 'utf-8');
    fs.writeFileSync(path.join(backupDir, 'unrelated.txt'), 'x', 'utf-8');

    const list = guard.listBackups();
    assert.deepEqual(list.map((b) => b.file), ['gp_data.manual-b.json', 'gp_data.rolling-a.json']);
    assert.deepEqual(list.map((b) => b.kind), ['manual', 'rolling']);
  });
});
