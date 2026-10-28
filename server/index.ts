import { existsSync } from 'node:fs';
import next from 'next';
import { loadConfig } from './config.js';
import { openDb, seedIfEmpty, loadSeedFile } from './db.js';
import { PuzzleRepo } from './puzzles/repo.js';
import { createJevJudge } from './jev/judge.js';
import { RoomManager } from './rooms/roomManager.js';
import { createApp } from './app.js';

const dev = process.env.NODE_ENV !== 'production';
const config = loadConfig();
const db = openDb(config.dbPath);
const seedPuzzles = loadSeedFile();
seedIfEmpty(db, seedPuzzles);
const repo = new PuzzleRepo(db);
repo.reconcilePlayable(seedPuzzles);
const rooms = new RoomManager();
try {
  const rows = db.prepare('SELECT state FROM room_snapshots WHERE updated_at >= ?').all(Date.now() - 600000) as { state: string }[];
  rooms.restoreSnapshots(rows.map(r => JSON.parse(r.state)));
} catch {}
const judge = createJevJudge(config, db);

function persistRoomSnapshots(): void {
  try {
    const snapshots = rooms.exportSnapshots();
    const now = Date.now();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec('DELETE FROM room_snapshots');
      const ins = db.prepare('INSERT INTO room_snapshots(code, state, updated_at) VALUES(?, ?, ?)');
      for (const room of snapshots) ins.run(room.code, JSON.stringify(room), now);
      db.exec('COMMIT');
    } catch {
      db.exec('ROLLBACK');
    }
  } catch {}
}

let nextHandler: any;
let nextApp: any;

try {
  nextApp = next({ dev, dir: '.' });
  await nextApp.prepare();
  nextHandler = nextApp.getRequestHandler();
} catch (err) {
  console.warn('Next.js 初始化跳过或降级:', err instanceof Error ? err.message : err);
}

const app = createApp({ config, db, repo, rooms, judge, nextHandler });

const sweep = setInterval(() => {
  const result = rooms.sweep(Date.now());
  if (result.ok) {
    result.value.changed.forEach(app.broadcast);
    for (const code of result.value.destroyed) app.io.in(code).socketsLeave(code);
  }
  persistRoomSnapshots();
}, 15000);
sweep.unref();

app.httpServer.listen(config.port, () => {
  console.log(`海龟汤已启动：http://localhost:${config.port} · 题库 ${repo.count()} 题 · 模型 ${config.model} · key ${config.judgeConfigured ? '已配置' : '未配置'}`);
  if (!config.judgeConfigured) console.warn('⚠⚠⚠ 未配置判题 key：游戏可正常开房，AI 判题会返回「出错」。');
});

let stopping = false;
async function stop(): Promise<void> {
  if (stopping) return;
  stopping = true;
  clearInterval(sweep);
  persistRoomSnapshots();
  await app.close();
  if (nextApp?.close) await nextApp.close();
}

process.once('SIGINT', () => { void stop(); });
process.once('SIGTERM', () => { void stop(); });
app.httpServer.once('error', error => {
  console.error('启动失败：', error.message);
  process.exitCode = 1;
  void stop();
});
