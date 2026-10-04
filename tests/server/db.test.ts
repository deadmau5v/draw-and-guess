import { it, expect } from 'vitest';
import { openDb, seedIfEmpty, loadSeedFile } from '../../server/db.js';
import { seed } from './fixtures.js';
it('建立四张表并只在空表时灌入', () => { const db=openDb(':memory:'); seedIfEmpty(db,[seed]); seedIfEmpty(db,[{...seed,id:'test-2'}]); expect(db.prepare('SELECT count(*) AS n FROM puzzles').get()?.n).toBe(1); for(const table of ['ratings','games','judge_cache']) expect(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()?.n).toBe(0); db.close(); });
it('缺失种子文件返回空数组',()=>expect(loadSeedFile('data/no-such-core-file.json')).toEqual([]));
