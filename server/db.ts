import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import type { SeedPuzzle } from '../shared/protocol.js';
export function openDb(path: string): DatabaseSync {
 const db = new DatabaseSync(path);
 db.exec(`CREATE TABLE IF NOT EXISTS puzzles(id TEXT PRIMARY KEY, title TEXT NOT NULL, surface TEXT NOT NULL, bottom TEXT NOT NULL,
 hints TEXT NOT NULL DEFAULT '[]', difficulty INTEGER, tags TEXT NOT NULL DEFAULT '[]', nsfl INTEGER NOT NULL DEFAULT 0,
 source TEXT NOT NULL, also_in TEXT NOT NULL DEFAULT '[]', plays INTEGER NOT NULL DEFAULT 0, solves INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS ratings(puzzle_id TEXT NOT NULL, player_key TEXT NOT NULL, score INTEGER NOT NULL CHECK(score IN (1,0,-1)), funny INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, PRIMARY KEY(puzzle_id, player_key));
 CREATE TABLE IF NOT EXISTS judge_cache(puzzle_id TEXT NOT NULL, kind TEXT NOT NULL, norm_text TEXT NOT NULL, choice TEXT NOT NULL, confidence REAL NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(puzzle_id, kind, norm_text));
 CREATE TABLE IF NOT EXISTS games(id TEXT PRIMARY KEY, room_code TEXT NOT NULL, puzzle_id TEXT NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER, outcome TEXT, winner_name TEXT, log TEXT NOT NULL DEFAULT '[]');`);
 return db;
}
export function seedIfEmpty(db: DatabaseSync, seedPuzzles: SeedPuzzle[]): void {
 db.exec('BEGIN IMMEDIATE');
 try {
  if (Number(db.prepare('SELECT count(*) AS n FROM puzzles').get()?.n) === 0) {
   const insert=db.prepare('INSERT INTO puzzles(id,title,surface,bottom,hints,difficulty,tags,nsfl,source,also_in,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
   for(const p of seedPuzzles) insert.run(p.id,p.title,p.surface,p.bottom,JSON.stringify(p.hints),p.difficulty,JSON.stringify(p.tags),Number(p.nsfl),JSON.stringify(p.source),JSON.stringify(p.alsoIn),Date.now());
  }
  db.exec('COMMIT');
 } catch(e) { db.exec('ROLLBACK'); throw e; }
}
export function loadSeedFile(path='data/puzzles.json'): SeedPuzzle[] {
 try { return JSON.parse(readFileSync(path,'utf8')) as SeedPuzzle[]; }
 catch(e) { if ((e as NodeJS.ErrnoException).code==='ENOENT') return []; throw e; }
}
