import { it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, seedIfEmpty, loadSeedFile } from '../../server/db.js';
import { seed } from './fixtures.js';
it('建立四张表并只在空表时灌入', () => { const db=openDb(':memory:'); seedIfEmpty(db,[seed]); seedIfEmpty(db,[{...seed,id:'test-2'}]); expect(db.prepare('SELECT count(*) AS n FROM puzzles').get()?.n).toBe(1); for(const table of ['ratings','games','judge_cache']) expect(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()?.n).toBe(0); db.close(); });
it('旧数据库无损增加接近程度缓存及永久积分表，迁移可重复执行',()=>{
 const dir=mkdtempSync(join(tmpdir(),'turtle-scores-')),path=join(dir,'db.sqlite');
 try {
  const old=new DatabaseSync(path);old.exec("CREATE TABLE judge_cache(puzzle_id TEXT NOT NULL,kind TEXT NOT NULL,norm_text TEXT NOT NULL,choice TEXT NOT NULL,confidence REAL NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(puzzle_id,kind,norm_text));INSERT INTO judge_cache VALUES('p','question','问','是',1,1)");old.close();
  for(let run=0;run<2;run++) {
   const db=openDb(path);
   try {expect(db.prepare('SELECT choice,proximity FROM judge_cache').get()).toMatchObject({choice:'是',proximity:null});for(const table of ['player_scores','score_awards']) expect(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()?.n).toBe(0);}finally{db.close();}
  }
 } finally {rmSync(dir,{recursive:true,force:true});}
});
it('缺失种子文件返回空数组',()=>expect(loadSeedFile('data/no-such-core-file.json')).toEqual([]));
