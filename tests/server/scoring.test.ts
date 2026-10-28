import { afterEach, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_AVATAR, extraAvatars } from '../../shared/avatars.js';
import { openDb } from '../../server/db.js';
import { ScoreRepo } from '../../server/scoring/repo.js';

const databases: DatabaseSync[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
function setup() {
  const db = openDb(':memory:');
  databases.push(db);
  return { db, repo: new ScoreRepo(db) };
}
const input = { id: 'award-1', playerKey: 'private-player', name: '玩家', puzzleId: 'private-puzzle', normText: 'private-normalized-question', proximity: 65 };

it('awards rounded proximity points and accumulates durable totals', () => {
  const { db, repo } = setup();
  expect(repo.playerPoints('missing')).toBe(0);
  expect(repo.award(input)).toBe(7);
  expect(repo.award({ ...input, id: 'award-2', normText: 'second-question', proximity: 24 })).toBe(2);
  expect(repo.playerPoints(input.playerKey)).toBe(9);
  expect(db.prepare('SELECT points, questions, best_proximity FROM player_scores').get()).toMatchObject({ points: 9, questions: 2, best_proximity: 65 });
});

it('deduplicates award ids and normalized questions without changing totals or profile', () => {
  const { db, repo } = setup();
  repo.award(input);
  const before = db.prepare('SELECT * FROM player_scores').get();
  expect(repo.award({ ...input, normText: 'different', name: 'changed', proximity: 100 })).toBe(0);
  expect(repo.award({ ...input, id: 'new-id', name: 'changed', proximity: 100 })).toBe(0);
  expect(db.prepare('SELECT * FROM player_scores').get()).toEqual(before);
  expect(db.prepare('SELECT count(*) AS n FROM score_awards').get()?.n).toBe(1);
  expect(repo.award({ ...input, id: 'other-puzzle', puzzleId: 'another' })).toBe(7);
  expect(repo.award({ ...input, id: 'other-player', playerKey: 'another' })).toBe(7);
});

it.each([NaN, Infinity, -Infinity, -0.1, 100.1, '65', null])('rejects invalid proximity %s even for duplicate awards', value => {
  const proximity = value as number;
  const { db, repo } = setup();
  repo.award(input);
  expect(() => repo.award({ ...input, proximity })).toThrow();
  expect(() => repo.award({ ...input, id: 'invalid', normText: 'invalid', proximity })).toThrow();
  expect(repo.playerPoints(input.playerKey)).toBe(7);
  expect(db.prepare('SELECT count(*) AS n FROM score_awards').get()?.n).toBe(1);
  expect(repo.award({ ...input, id: 'valid', normText: 'valid', proximity: 0 })).toBe(0);
  expect(db.prepare('SELECT questions FROM player_scores').get()?.questions).toBe(2);
});

it('rolls back the award when the totals update fails', () => {
  const { db, repo } = setup();
  db.exec("CREATE TRIGGER fail_totals BEFORE INSERT ON player_scores BEGIN SELECT RAISE(ABORT,'forced failure'); END");
  expect(() => repo.award(input)).toThrow('forced failure');
  expect(db.prepare('SELECT count(*) AS n FROM score_awards').get()?.n).toBe(0);
  db.exec('DROP TRIGGER fail_totals');
  expect(repo.award(input)).toBe(7);
});

it('returns safe deterministic row-number rankings with self outside the top list', () => {
  const { db, repo } = setup();
  const insert = db.prepare('INSERT INTO player_scores VALUES(?,?,?,?,?,?,?)');
  insert.run('private-e', 'points first', 'fox', 11, 2, 10, 100);
  insert.run('private-d', 'proximity second', 'panda', 10, 2, 99, 100);
  insert.run('private-c', 'time third', 'robot', 10, 2, 90, 1);
  insert.run('private-b', 'key fifth', 'https://evil.test/avatar', 10, 2, 90, 2);
  insert.run('private-a', 'key fourth', 'ghost', 10, 2, 90, 2);
  const result = repo.leaderboard('private-b', 2);
  expect(result.entries.map(entry => [entry.rank, entry.name])).toEqual([[1, 'points first'], [2, 'proximity second']]);
  expect(result.self).toEqual({ rank: 5, name: 'key fifth', avatar: '/assets/avatars/player-panda.png', points: 10, questions: 2, bestProximity: 90 });
  expect(repo.leaderboard().entries.map(entry => entry.name)).toEqual(['points first', 'proximity second', 'time third', 'key fourth', 'key fifth']);
  expect(repo.leaderboard('missing').self).toBeNull();
  expect(repo.leaderboard().self).toBeNull();
  expect(Object.keys(result.entries[0]).sort()).toEqual(['avatar', 'bestProximity', 'name', 'points', 'questions', 'rank']);
  expect(JSON.stringify(result)).not.toContain('private-');
});

it('caps leaderboard entries at 100 and applies safe finite integer limits', () => {
  const { db, repo } = setup();
  const insert = db.prepare('INSERT INTO player_scores VALUES(?,?,?,?,?,?,?)');
  for (let i = 0; i < 105; i++) insert.run(`private-${i}`, `player-${i}`, 'panda', 105 - i, 1, 100, i);
  expect(repo.leaderboard().entries).toHaveLength(50);
  expect(repo.leaderboard('private-104', 1000).entries).toHaveLength(100);
  expect(repo.leaderboard('private-104', 1000).self?.rank).toBe(105);
  expect(repo.leaderboard(undefined, -1).entries).toHaveLength(0);
  expect(repo.leaderboard(undefined, 0).entries).toHaveLength(0);
  expect(repo.leaderboard(undefined, 2.9).entries).toHaveLength(2);
  expect(repo.leaderboard(undefined, NaN).entries).toHaveLength(50);
  expect(repo.leaderboard(undefined, Infinity).entries).toHaveLength(50);
});

it.each([[0, 0], [4.9, 0], [5, 1], [95, 10], [100, 10]])('rounds proximity %s to %s points', (proximity, points) => {
  const { repo } = setup();
  expect(repo.award({ ...input, proximity })).toBe(points);
  expect(repo.leaderboard(input.playerKey).self).toMatchObject({ points, questions: 1, bestProximity: proximity });
});

it('treats hostile identity strings as literal parameters and resolves only local avatars', () => {
  const { db, repo } = setup();
  const hostile = "'); DROP TABLE player_scores; --";
  repo.award({ ...input, playerKey: hostile, name: hostile, puzzleId: hostile, normText: hostile, avatar: 'https://evil.test/track.png' });
  expect(repo.playerPoints(hostile)).toBe(7);
  expect(repo.leaderboard(hostile).self).toMatchObject({ name: hostile, avatar: DEFAULT_AVATAR });
  repo.award({ ...input, playerKey: hostile, id: 'new', name: 'updated', avatar: extraAvatars[0].id });
  expect(repo.leaderboard(hostile).self).toMatchObject({ name: 'updated', avatar: extraAvatars[0].src, points: 14 });
  expect(db.prepare('SELECT avatar FROM player_scores WHERE player_key=?').get(hostile)?.avatar).toBe(extraAvatars[0].src);
  repo.award({ ...input, playerKey: hostile, id: 'third', normText: 'third', avatar: 'fox' });
  expect(repo.leaderboard(hostile).self?.avatar).toBe('/assets/avatars/player-fox.png');
});

it('persists totals and duplicate protection across file database reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'turtle-score-'));
  const path = join(directory, 'scores.sqlite');
  try {
    const initial = openDb(path);
    try { expect(new ScoreRepo(initial).award(input)).toBe(7); } finally { initial.close(); }
    const reopened = openDb(path);
    try {
      const repo = new ScoreRepo(reopened);
      expect(repo.playerPoints(input.playerKey)).toBe(7);
      expect(repo.award({ ...input, id: 'repeated-after-reopen' })).toBe(0);
      expect(repo.award({ ...input, id: 'new-after-reopen', normText: 'second', proximity: 100 })).toBe(10);
      expect(new ScoreRepo(reopened).leaderboard(input.playerKey).self).toMatchObject({ points: 17, questions: 2, bestProximity: 100 });
    } finally { reopened.close(); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it('serializes interleaved synchronous awards across separate database connections', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'turtle-score-shared-'));
  const path = join(directory, 'scores.sqlite');
  const firstDb = openDb(path);
  const secondDb = openDb(path);
  try {
    const repos = [new ScoreRepo(firstDb), new ScoreRepo(secondDb)];
    const earned = await Promise.all(Array.from({ length: 40 }, (_, i) => Promise.resolve().then(() => repos[i % 2].award({ ...input, id: `concurrent-${i}`, normText: `question-${Math.floor(i / 2)}`, proximity: 100 }))));
    expect(earned.reduce((total, points) => total + points, 0)).toBe(200);
    for (const repo of repos) expect(repo.leaderboard(input.playerKey).self).toMatchObject({ points: 200, questions: 20, bestProximity: 100 });
    expect(firstDb.prepare('SELECT count(*) AS n FROM score_awards').get()?.n).toBe(20);
  } finally {
    firstDb.close(); secondDb.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
