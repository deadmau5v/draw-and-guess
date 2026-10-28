import type { DatabaseSync } from 'node:sqlite';
import type { PuzzleListQuery, PuzzlePublic, PuzzleSecret, PuzzleSummary, PuzzleSource } from '../../shared/protocol.js';
type Row = Record<string, unknown>;
export interface GameRecord { id:string; roomCode:string; puzzleId:string; startedAt:number; endedAt:number; outcome:string; winnerName:string|null; log:unknown[] }
export class PuzzleRepo {
 rate(puzzleId:string,playerKey:string,score:1|0|-1,funny:boolean):void {
  this.db.prepare(`INSERT INTO ratings(puzzle_id,player_key,score,funny,created_at) VALUES(?,?,?,?,?) ON CONFLICT(puzzle_id,player_key) DO UPDATE SET score=excluded.score,funny=excluded.funny,created_at=excluded.created_at`).run(puzzleId,playerKey,score,Number(funny),Date.now());
 }
 recordGame(g:GameRecord):void {
  this.db.exec('BEGIN IMMEDIATE');
  try {
   const result=this.db.prepare('INSERT OR IGNORE INTO games(id,room_code,puzzle_id,started_at,ended_at,outcome,winner_name,log) VALUES(?,?,?,?,?,?,?,?)').run(g.id,g.roomCode,g.puzzleId,g.startedAt,g.endedAt,g.outcome,g.winnerName,JSON.stringify(g.log));
   if(Number(result.changes)) this.db.prepare('UPDATE puzzles SET plays=plays+1,solves=solves+? WHERE id=?').run(Number(g.outcome==='破解成功'),g.puzzleId);
   this.db.exec('COMMIT');
  } catch(e) { this.db.exec('ROLLBACK'); throw e; }
 }
 private readonly db:DatabaseSync;
 constructor(db:DatabaseSync) {this.db=db;}
 count(): number { return Number(this.db.prepare('SELECT count(*) AS n FROM puzzles').get()?.n); }
 private rows(): Row[] { return this.db.prepare(`SELECT p.*, count(r.player_key) AS ratings, coalesce(sum(r.score),0) AS score_sum, coalesce(sum(r.funny),0) AS funny FROM puzzles p LEFT JOIN ratings r ON p.id=r.puzzle_id GROUP BY p.id`).all(); }
 private summary(r:Row): PuzzleSummary {
  const ratings=Number(r.ratings), goodRate=ratings ? Number(r.score_sum)/ratings*0.5+0.5 : null;
  const source=JSON.parse(String(r.source)) as PuzzleSource;
  return {id:String(r.id),title:String(r.title),surfacePreview:Array.from(String(r.surface)).slice(0,60).join(''),difficulty:r.difficulty===null?null:Number(r.difficulty),tags:JSON.parse(String(r.tags)),nsfl:!!r.nsfl,hintCount:JSON.parse(String(r.hints)).length, goodRate, tier:goodRate===null?'none':goodRate>=0.7?'high':goodRate>=0.4?'mid':'low',funny:Number(r.funny),ratings,plays:Number(r.plays),solves:Number(r.solves),sourceKey:source.key};
 }
 list(q: PuzzleListQuery={}): PuzzleSummary[] {
  let rows=this.rows().filter(r=>(!q.excludeNsfl || !r.nsfl) && (!q.tag || (JSON.parse(String(r.tags)) as string[]).includes(q.tag)) && (!q.q || `${r.title} ${r.surface} ${r.tags}`.toLowerCase().includes(q.q.toLowerCase())));
  if(q.sort==='new') rows.sort((a,b)=>Number(b.created_at)-Number(a.created_at));
  if(q.sort==='hot') rows.sort((a,b)=>Number(b.plays)-Number(a.plays));
  let summaries=rows.map(r=>this.summary(r));
  const tier=q.sort==='good'?'high':q.sort==='mid'?'mid':q.sort==='low'?'low':null;
  if(tier) summaries=summaries.filter(r=>r.tier===tier).sort((a,b)=>b.goodRate!-a.goodRate!);
  const offset=Math.max(0,Math.floor(q.offset??0)),limit=Math.max(0,Math.min(200,Math.floor(q.limit??60)));
  return summaries.slice(offset,offset+limit);
 }
 getPublic(id:string): PuzzlePublic|null {
  const r=this.rows().find(r=>r.id===id); if(!r) return null;
  const {surfacePreview:_,...summary}=this.summary(r);
  return {...summary,surface:String(r.surface),source:JSON.parse(String(r.source))};
 }
 getSecret(id:string): PuzzleSecret|null {
  const p=this.getPublic(id); if(!p) return null;
  const r=this.db.prepare('SELECT bottom,hints FROM puzzles WHERE id=?').get(id)!;
  return {...p,bottom:String(r.bottom),hints:JSON.parse(String(r.hints))};
 }
 random(opts:{excludeNsfl:boolean;excludeIds:string[]}):string|null {
  const ids=this.rows().filter(r=>(!opts.excludeNsfl||!r.nsfl)&&!opts.excludeIds.includes(String(r.id)));
  return ids.length?String(ids[Math.floor(Math.random()*ids.length)].id):null;
 }
}
