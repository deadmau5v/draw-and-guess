import { it, expect } from 'vitest';
import { openDb, seedIfEmpty } from '../../server/db.js';
import { PuzzleRepo } from '../../server/puzzles/repo.js';
import { seed } from './fixtures.js';
const word=(id:string,bottom:string)=>({...seed,id,title:'词条',surface:'日常作画词',bottom,hints:[],source:{...seed.source,key:'draw-bank'}});
it('主题筛选按完整标签匹配并保留安全过滤', () => {
 const db = openDb(':memory:');
 seedIfEmpty(db, [{ ...seed, tags: ['暖心反转与深情守护篇'] }, { ...seed, id: 'other', tags: ['暖心反转与深情守护篇'], nsfl: true }]);
 const repo = new PuzzleRepo(db);
 expect(repo.list({ tag: '暖心反转与深情守护篇', excludeNsfl: true }).map(p => p.id)).toEqual([seed.id]);
 expect(repo.list({ tag: '暖心反转' })).toEqual([]);
 expect(JSON.stringify(repo.list({ tag: '暖心反转与深情守护篇' })).includes(seed.bottom)).toBe(false);
 db.close();
});
it('评分 upsert、分档和游戏统计',()=>{ const db=openDb(':memory:'); seedIfEmpty(db,[seed]); const r=new PuzzleRepo(db); r.rate(seed.id,'a',1,true); expect(r.list({sort:'good'})[0]).toMatchObject({goodRate:1,funny:1,ratings:1}); r.rate(seed.id,'a',-1,false); expect(r.list({sort:'low'})[0]).toMatchObject({goodRate:0,funny:0,ratings:1}); r.rate(seed.id,'a',0,false); expect(r.list({sort:'mid'})).toHaveLength(1); r.recordGame({id:'g',roomCode:'ABC234',puzzleId:seed.id,startedAt:1,endedAt:2,outcome:'破解成功',winnerName:'玩家',log:[]}); expect(r.getPublic(seed.id)).toMatchObject({plays:1,solves:1}); expect(db.prepare('SELECT count(*) AS n FROM games').get()?.n).toBe(1); db.close(); });
it('只公开安全信息且支持查询与随机排除',()=>{ const db=openDb(':memory:'); seedIfEmpty(db,[seed,{...seed,id:'nsfl',nsfl:true}]); const r=new PuzzleRepo(db); expect(r.count()).toBe(2); for(const p of [...r.list({}),r.getPublic(seed.id)]) { expect(p).not.toHaveProperty('bottom'); expect(p).not.toHaveProperty('hints'); } expect(r.getSecret(seed.id)?.bottom).toBe(seed.bottom); expect(r.getPublic('missing')).toBeNull(); expect(r.list({q:'不存在'})).toEqual([]); expect(r.random({excludeNsfl:true,excludeIds:[]})).toBe(seed.id); expect(r.random({excludeNsfl:true,excludeIds:[seed.id]})).toBeNull(); db.close(); });

it('curated reconciliation preserves stats/history, updates ordinary words and hides archived rows without deleting them',()=>{
 const db=openDb(':memory:');try {
  seedIfEmpty(db,[word('current','旧词'),word('archive','旧派对词'),{...seed,id:'unrelated'}]);const repo=new PuzzleRepo(db);
  repo.rate('current','a',1,false);repo.recordGame({id:'history',roomCode:'ABCDEF',puzzleId:'current',startedAt:1,endedAt:2,outcome:'破解成功',winnerName:'a',log:[]});
  for(let i=0;i<2;i++) repo.reconcilePlayable([word('current','大熊猫'),word('new','雨伞'),{...seed,id:'unrelated',bottom:'不能覆盖'}]);
  expect(repo.list().map(p=>p.id).sort()).toEqual(['current','new']);expect(repo.count()).toBe(2);
  expect(repo.getSecret('current')).toMatchObject({bottom:'大熊猫',plays:1,solves:1,ratings:1});
  expect(repo.getPublic('archive')).toBeNull();expect(repo.getPublic('unrelated')).toBeNull();
  expect(repo.random({excludeNsfl:true,excludeIds:['current']})).toBe('new');
  expect(db.prepare('SELECT count(*) AS n FROM puzzles').get()?.n).toBe(4);expect(db.prepare('SELECT count(*) AS n FROM games').get()?.n).toBe(1);
  expect(db.prepare('SELECT bottom FROM puzzles WHERE id=?').get('unrelated')?.bottom).toBe(seed.bottom);
 } finally {db.close();}
});
