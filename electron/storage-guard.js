// 存储守卫：原子写入 + 备份轮换 + 损坏回退。
// 纯 Node 模块（不依赖 electron），路径与时钟均注入，便于单测（tests/storageGuard.test.mjs）。
//
// 防护目标（迭代 32）：
// 1. 裸 writeFileSync 写一半崩溃/断电 → 整库损坏     ⇒ 临时文件 + rename 原子替换
// 2. 损坏后 load 返回空库、下次保存覆盖清零（整库蒸发）⇒ 损坏时保留证据并回退最近可用备份
// 3. 无任何备份                                        ⇒ 滚动/每日/手动三类备份自动轮换

const fs = require('fs');
const path = require('path');

const ROLLING_PREFIX = 'gp_data.rolling-';
const DAILY_PREFIX = 'gp_data.daily-';
const MANUAL_PREFIX = 'gp_data.manual-';
const PRERESTORE_PREFIX = 'gp_data.prerestore-';
const CORRUPT_PREFIX = 'gp_data.corrupt-';
const BACKUP_SUFFIX = '.json';

const BACKUP_KINDS = [
  { kind: 'rolling', prefix: ROLLING_PREFIX },
  { kind: 'daily', prefix: DAILY_PREFIX },
  { kind: 'manual', prefix: MANUAL_PREFIX },
  { kind: 'prerestore', prefix: PRERESTORE_PREFIX },
];

function isParsableStore(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return false;
  try {
    const parsed = JSON.parse(raw);
    return Boolean(parsed)
      && typeof parsed === 'object'
      && !Array.isArray(parsed)
      && Array.isArray(parsed.projects)
      && Boolean(parsed.contents)
      && typeof parsed.contents === 'object'
      && !Array.isArray(parsed.contents)
      && (
        parsed.configs === undefined
        || (
          Boolean(parsed.configs)
          && typeof parsed.configs === 'object'
          && !Array.isArray(parsed.configs)
        )
      );
  } catch {
    return false;
  }
}

function isRestorableBackupName(fileName) {
  return typeof fileName === 'string'
    && !fileName.includes('/')
    && !fileName.includes('\\')
    && !fileName.includes('..')
    && fileName.endsWith(BACKUP_SUFFIX)
    && BACKUP_KINDS.some(({ prefix }) => fileName.startsWith(prefix));
}

function timestampSlug(ms) {
  const d = new Date(ms);
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${pad(d.getMilliseconds(), 3)}`;
}

function dateSlug(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

class StorageGuard {
  /**
   * @param {object} options
   * @param {string} options.dataFile 主数据文件绝对路径
   * @param {string} options.backupDir 备份目录绝对路径
   * @param {number} [options.rollingLimit=5] 滚动备份保留份数
   * @param {number} [options.dailyLimit=7] 每日备份保留份数
   * @param {number} [options.manualLimit=10] 手动备份保留份数
   * @param {number} [options.prerestoreLimit=3] 恢复前自动快照保留份数
   * @param {number} [options.corruptLimit=3] 损坏现场保留份数
   * @param {number} [options.rollingEveryNSaves=25] 每 N 次保存做一次滚动备份
   * @param {number} [options.rollingMinIntervalMs=300000] 距上次滚动备份至少间隔（毫秒）
   * @param {() => number} [options.now] 时钟注入（测试用）
   */
  constructor(options) {
    this.dataFile = options.dataFile;
    this.backupDir = options.backupDir;
    this.rollingLimit = options.rollingLimit ?? 5;
    this.dailyLimit = options.dailyLimit ?? 7;
    this.manualLimit = options.manualLimit ?? 10;
    this.prerestoreLimit = options.prerestoreLimit ?? 3;
    this.corruptLimit = options.corruptLimit ?? 3;
    this.rollingEveryNSaves = options.rollingEveryNSaves ?? 25;
    this.rollingMinIntervalMs = options.rollingMinIntervalMs ?? 5 * 60 * 1000;
    this.now = options.now ?? (() => Date.now());

    this.savesSinceRolling = 0;
    this.lastRollingAt = 0;
    this.lastRecoveredFrom = null;
  }

  ensureBackupDir() {
    fs.mkdirSync(this.backupDir, { recursive: true });
  }

  /**
   * 读取主数据。损坏时：保留 .corrupt- 现场 → 依次尝试备份（新到旧）→
   * 用第一份可解析备份原子回写主文件并返回其内容。
   * @returns {{ raw: string | null, recoveredFrom: string | null }}
   */
  load() {
    this.lastRecoveredFrom = null;

    if (!fs.existsSync(this.dataFile)) {
      return { raw: null, recoveredFrom: null };
    }

    let raw = null;
    try {
      raw = fs.readFileSync(this.dataFile, 'utf-8');
    } catch (err) {
      console.error('[storage-guard] read failed:', err);
      return { raw: null, recoveredFrom: null };
    }

    if (isParsableStore(raw)) {
      return { raw, recoveredFrom: null };
    }

    // 主文件损坏：保留现场（决不静默丢弃——这是「整库蒸发」链路的第一环）
    console.error('[storage-guard] data file corrupted, trying backups');
    try {
      this.ensureBackupDir();
      const corruptName = `${CORRUPT_PREFIX}${timestampSlug(this.now())}${BACKUP_SUFFIX}`;
      fs.copyFileSync(this.dataFile, path.join(this.backupDir, corruptName));
      this.prune(CORRUPT_PREFIX, this.corruptLimit);
    } catch (err) {
      console.error('[storage-guard] failed to preserve corrupt file:', err);
    }

    for (const backup of this.listBackups()) {
      try {
        const candidate = fs.readFileSync(path.join(this.backupDir, backup.file), 'utf-8');
        if (!isParsableStore(candidate)) continue;
        // 回写主文件，让后续保存路径回到正轨
        this.atomicWrite(candidate);
        this.lastRecoveredFrom = backup.file;
        return { raw: candidate, recoveredFrom: backup.file };
      } catch (err) {
        console.error(`[storage-guard] backup ${backup.file} unusable:`, err);
      }
    }

    // 没有可用备份：返回 null（调用方给空库），但损坏现场已保留可人工抢救
    return { raw: null, recoveredFrom: null };
  }

  /**
   * 原子保存。拒绝不可解析内容（防止渲染端 bug 把垃圾写穿磁盘）。
   * @param {string} raw
   * @returns {{ ok: boolean, error?: string }}
   */
  save(raw) {
    if (!isParsableStore(raw)) {
      return { ok: false, error: 'refused: payload is not parsable JSON object' };
    }

    try {
      this.atomicWrite(raw);
    } catch (err) {
      console.error('[storage-guard] save failed:', err);
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }

    this.maybeRollingBackup(raw);
    return { ok: true };
  }

  /** 临时文件 + rename 原子替换；Windows 上目标被短暂占用（如杀软扫描）时重试 */
  atomicWrite(raw) {
    const tmpFile = `${this.dataFile}.tmp`;
    fs.mkdirSync(path.dirname(this.dataFile), { recursive: true });
    fs.writeFileSync(tmpFile, raw, 'utf-8');

    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        fs.renameSync(tmpFile, this.dataFile);
        return;
      } catch (err) {
        lastError = err;
        // 短忙等后重试（同步 IPC 语境下无法 await）
        const until = Date.now() + 15;
        while (Date.now() < until) { /* busy wait */ }
      }
    }

    // 绝不退化为直接覆盖主文件：旧主文件保持完整，tmp 也保留以便下次保存或人工恢复。
    // 上层收到失败后仍保有会话内数据，可重试保存。
    throw lastError ?? new Error('atomic rename failed');
  }

  maybeRollingBackup(raw) {
    this.savesSinceRolling += 1;
    const due = this.savesSinceRolling >= this.rollingEveryNSaves
      || (this.now() - this.lastRollingAt) >= this.rollingMinIntervalMs;
    if (!due) return;

    try {
      this.ensureBackupDir();
      const name = `${ROLLING_PREFIX}${timestampSlug(this.now())}${BACKUP_SUFFIX}`;
      fs.writeFileSync(path.join(this.backupDir, name), raw, 'utf-8');
      this.prune(ROLLING_PREFIX, this.rollingLimit);
      this.savesSinceRolling = 0;
      this.lastRollingAt = this.now();
    } catch (err) {
      console.error('[storage-guard] rolling backup failed:', err);
    }
  }

  /** 启动时的每日备份：同一天只做一次 */
  makeStartupBackup() {
    try {
      if (!fs.existsSync(this.dataFile)) return;
      const raw = fs.readFileSync(this.dataFile, 'utf-8');
      if (!isParsableStore(raw)) return; // 损坏文件交给 load() 的回退流程处理

      this.ensureBackupDir();
      const name = `${DAILY_PREFIX}${dateSlug(this.now())}${BACKUP_SUFFIX}`;
      const target = path.join(this.backupDir, name);
      if (fs.existsSync(target)) return;
      fs.writeFileSync(target, raw, 'utf-8');
      this.prune(DAILY_PREFIX, this.dailyLimit);
    } catch (err) {
      console.error('[storage-guard] startup backup failed:', err);
    }
  }

  /** 手动快照 */
  snapshotNow() {
    if (!fs.existsSync(this.dataFile)) {
      return { ok: false, error: 'no data file yet' };
    }
    try {
      const raw = fs.readFileSync(this.dataFile, 'utf-8');
      if (!isParsableStore(raw)) return { ok: false, error: 'data file is corrupted' };
      this.ensureBackupDir();
      const name = `${MANUAL_PREFIX}${timestampSlug(this.now())}${BACKUP_SUFFIX}`;
      fs.writeFileSync(path.join(this.backupDir, name), raw, 'utf-8');
      this.prune(MANUAL_PREFIX, this.manualLimit);
      return { ok: true, file: name };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** 全部备份，按修改时间新到旧（不含损坏现场文件） */
  listBackups() {
    if (!fs.existsSync(this.backupDir)) return [];
    const entries = [];
    for (const file of fs.readdirSync(this.backupDir)) {
      const kindEntry = BACKUP_KINDS.find((k) => file.startsWith(k.prefix));
      if (!kindEntry || !file.endsWith(BACKUP_SUFFIX)) continue;
      try {
        const stat = fs.lstatSync(path.join(this.backupDir, file));
        if (!stat.isFile()) continue;
        entries.push({ file, kind: kindEntry.kind, mtimeMs: stat.mtimeMs, size: stat.size });
      } catch { /* 备份列举途中被删除等竞态可忽略 */ }
    }
    return entries.sort((a, b) => b.mtimeMs - a.mtimeMs);
  }

  /**
   * 从指定备份恢复：先把当前主文件快照为 prerestore-，再原子覆盖。
   * @param {string} fileName listBackups() 返回的文件名（仅文件名，防路径穿越）
   */
  restoreBackup(fileName) {
    if (!isRestorableBackupName(fileName)) {
      return { ok: false, error: 'invalid backup file name' };
    }
    const source = path.join(this.backupDir, fileName);
    if (!fs.existsSync(source) || !fs.lstatSync(source).isFile()) {
      return { ok: false, error: 'backup not found' };
    }

    let raw;
    try {
      raw = fs.readFileSync(source, 'utf-8');
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    if (!isParsableStore(raw)) {
      return { ok: false, error: 'backup file is corrupted' };
    }

    try {
      if (fs.existsSync(this.dataFile)) {
        const current = fs.readFileSync(this.dataFile, 'utf-8');
        if (isParsableStore(current)) {
          this.ensureBackupDir();
          const name = `${PRERESTORE_PREFIX}${timestampSlug(this.now())}${BACKUP_SUFFIX}`;
          fs.writeFileSync(path.join(this.backupDir, name), current, 'utf-8');
          this.prune(PRERESTORE_PREFIX, this.prerestoreLimit);
        }
      }
      this.atomicWrite(raw);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** 按前缀清理旧备份，保留最新 limit 份 */
  prune(prefix, limit) {
    try {
      if (!fs.existsSync(this.backupDir)) return;
      const files = fs.readdirSync(this.backupDir)
        .filter((f) => f.startsWith(prefix) && f.endsWith(BACKUP_SUFFIX))
        .map((f) => ({ f, mtimeMs: fs.statSync(path.join(this.backupDir, f)).mtimeMs }))
        .sort((a, b) => b.mtimeMs - a.mtimeMs);
      for (const entry of files.slice(limit)) {
        try { fs.unlinkSync(path.join(this.backupDir, entry.f)); } catch { /* 清理失败不致命 */ }
      }
    } catch (err) {
      console.error('[storage-guard] prune failed:', err);
    }
  }
}

module.exports = { StorageGuard, isParsableStore };
