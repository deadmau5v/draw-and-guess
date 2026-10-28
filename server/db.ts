import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import type { SeedPuzzle } from '../shared/protocol.js';
export function openDb(path: string): DatabaseSync {
 const db = new DatabaseSync(path);
 db.exec(`CREATE TABLE IF NOT EXISTS puzzles(id TEXT PRIMARY KEY, title TEXT NOT NULL, surface TEXT NOT NULL, bottom TEXT NOT NULL,
 hints TEXT NOT NULL DEFAULT '[]', difficulty INTEGER, tags TEXT NOT NULL DEFAULT '[]', nsfl INTEGER NOT NULL DEFAULT 0,
 source TEXT NOT NULL, also_in TEXT NOT NULL DEFAULT '[]', plays INTEGER NOT NULL DEFAULT 0, solves INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS ratings(puzzle_id TEXT NOT NULL, player_key TEXT NOT NULL, score INTEGER NOT NULL CHECK(score IN (1,0,-1)), funny INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, PRIMARY KEY(puzzle_id, player_key));
 CREATE TABLE IF NOT EXISTS judge_cache(puzzle_id TEXT NOT NULL, kind TEXT NOT NULL, norm_text TEXT NOT NULL, choice TEXT NOT NULL, confidence REAL NOT NULL, proximity INTEGER, created_at INTEGER NOT NULL, PRIMARY KEY(puzzle_id, kind, norm_text));
 CREATE TABLE IF NOT EXISTS games(id TEXT PRIMARY KEY, room_code TEXT NOT NULL, puzzle_id TEXT NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER, outcome TEXT, winner_name TEXT, log TEXT NOT NULL DEFAULT '[]');
 CREATE TABLE IF NOT EXISTS player_scores(player_key TEXT PRIMARY KEY, name TEXT NOT NULL, avatar TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 0 CHECK(points>=0), questions INTEGER NOT NULL DEFAULT 0 CHECK(questions>=0), best_proximity INTEGER NOT NULL DEFAULT 0 CHECK(best_proximity BETWEEN 0 AND 100), updated_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS score_awards(id TEXT PRIMARY KEY, player_key TEXT NOT NULL, puzzle_id TEXT NOT NULL, norm_text TEXT NOT NULL, points INTEGER NOT NULL CHECK(points BETWEEN 0 AND 10), proximity INTEGER NOT NULL CHECK(proximity BETWEEN 0 AND 100), created_at INTEGER NOT NULL, UNIQUE(player_key,puzzle_id,norm_text));
 CREATE TABLE IF NOT EXISTS room_snapshots(code TEXT PRIMARY KEY, state TEXT NOT NULL, updated_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS player_scores_ranking ON player_scores(points DESC,best_proximity DESC,updated_at ASC);`);
 // Additive migration preserves legacy 0..10 proximity awards and all history.
 // Separate table avoids rebuilding legacy CHECK constraints and unique indexes.
 db.exec(`CREATE TABLE IF NOT EXISTS round_score_awards(
  room_code TEXT NOT NULL, game_id TEXT NOT NULL, round INTEGER NOT NULL CHECK(round>0),
  role TEXT NOT NULL CHECK(role IN ('solver','drawer')), player_key TEXT NOT NULL,
  points INTEGER NOT NULL CHECK(points BETWEEN 0 AND 150), created_at INTEGER NOT NULL,
  PRIMARY KEY(room_code,game_id,round,role));`);
 if (!db.prepare('PRAGMA table_info(judge_cache)').all().some(column => column.name === 'proximity')) db.exec('ALTER TABLE judge_cache ADD COLUMN proximity INTEGER');
 db.exec(`UPDATE puzzles SET
  plays = MAX(plays, (SELECT count(*) FROM games WHERE games.puzzle_id = puzzles.id)),
  solves = MAX(solves, (SELECT count(*) FROM games WHERE games.puzzle_id = puzzles.id AND games.outcome = '破解成功'))`);
 return db;
}
export function seedIfEmpty(db: DatabaseSync, seedPuzzles: SeedPuzzle[]): void {
 db.exec('BEGIN IMMEDIATE');
 try {
  if (Number(db.prepare('SELECT count(*) AS n FROM puzzles').get()?.n) === 0) {
   const insert=db.prepare('INSERT INTO puzzles(id,title,surface,bottom,hints,difficulty,tags,nsfl,source,also_in,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
   const base=Date.now();
   seedPuzzles.forEach((p,idx)=>insert.run(p.id,p.title,p.surface,p.bottom,JSON.stringify(p.hints),p.difficulty,JSON.stringify(p.tags),Number(p.nsfl),JSON.stringify(p.source),JSON.stringify(p.alsoIn),base+idx));
  }
  db.exec('COMMIT');
 } catch(e) { db.exec('ROLLBACK'); throw e; }
}
export function loadSeedFile(path='data/puzzles.json'): SeedPuzzle[] {
 try { return JSON.parse(readFileSync(path,'utf8')) as SeedPuzzle[]; }
 catch(e) { if ((e as NodeJS.ErrnoException).code==='ENOENT') return []; throw e; }
}
