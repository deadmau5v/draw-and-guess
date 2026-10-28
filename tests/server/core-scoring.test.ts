import { afterEach, expect, test } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../../server/db.js';
import { ScoreRepo } from '../../server/scoring/repo.js';
import { correctGuessPoints } from '../../server/scoring/core.js';
import { RoomManager } from '../../server/rooms/roomManager.js';
import type { Ack } from '../../shared/protocol.js';
const dbs:DatabaseSync[]=[];afterEach(()=>{for(const db of dbs.splice(0)) db.close();});
function db(){const value=openDb(':memory:');dbs.push(value);return value;}
function value<T>(ack:Ack<T>):T {if(!ack.ok) throw Error(ack.msg);return ack.value;}
test.each([[0,0,150],[45000,0,125],[90000,0,100],[180000,0,100],[0,1,145],[90000,6,70],[90000,100,70],[45000,100,95]])('elapsed %d and wrong %d yields %d', (elapsed,wrong,points)=>{
 expect(correctGuessPoints(1000,1000+elapsed,90,wrong)).toBe(points);
});
test('speed baseline follows configured duration and clamps clock skew',()=>{
 expect(correctGuessPoints(1000,31000,60,0)).toBe(125);
 expect(correctGuessPoints(1000,0,90,0)).toBe(150);
 for(const duration of [NaN,Infinity,0,-1]) expect(()=>correctGuessPoints(0,1,duration,0)).toThrow();
});
const award={roomCode:'ABCDEF',gameId:'unique-game-uuid',round:1,solver:{key:'solver',name:'猜词人'},drawer:{key:'drawer',name:'画手'},points:125};
test('atomic persistent awards are per room + unique game + round, not word or answer text',()=>{
 const database=db(),scores=new ScoreRepo(database);
 expect(scores.awardRound(award)).toEqual({solverPoints:125,drawerPoints:40});
 expect(scores.awardRound({...award,solver:{key:'other',name:'另一个赢家'},points:150})).toEqual({solverPoints:0,drawerPoints:0});
 expect(scores.playerPoints('solver')).toBe(125);expect(scores.playerPoints('drawer')).toBe(40);expect(scores.playerPoints('other')).toBe(0);
 expect(new ScoreRepo(database).awardRound(award)).toEqual({solverPoints:0,drawerPoints:0});
 expect(scores.awardRound({...award,gameId:'new-uuid'}).solverPoints).toBe(125);
 expect(scores.awardRound({...award,roomCode:'ZYXWVU'}).solverPoints).toBe(125);
 expect(database.prepare('SELECT count(*) AS n FROM round_score_awards').get()?.n).toBe(6);
 expect(database.prepare('PRAGMA table_info(round_score_awards)').all().some(row=>String(row.name).includes('text'))).toBe(false);
});
test('drawer failure rolls back solver and all ledger rows, so safe retry awards once',()=>{
 const database=db(),scores=new ScoreRepo(database);
 database.exec("CREATE TRIGGER fail_drawer BEFORE INSERT ON player_scores WHEN NEW.player_key='drawer' BEGIN SELECT RAISE(ABORT,'forced'); END");
 expect(()=>scores.awardRound(award)).toThrow();expect(scores.playerPoints('solver')).toBe(0);
 expect(database.prepare('SELECT count(*) AS n FROM round_score_awards').get()?.n).toBe(0);
 database.exec('DROP TRIGGER fail_drawer');expect(scores.awardRound(award).solverPoints).toBe(125);
 expect(()=>scores.awardRound({...award,drawer:award.solver})).toThrow();
});
test('round uses submission timestamp not slow judge completion; uncertain/errors do not penalize, wrong guesses capped',()=>{
 let now=1000;const rooms=new RoomManager({now:()=>now}),code=value(rooms.createRoom('画手','a')).code;
 value(rooms.join(code,'画手','a','sa'));value(rooms.join(code,'猜词','b','sb'));value(rooms.start(code,'a','word'));
 expect(rooms.beginGuess(code,'a','self')).toMatchObject({ok:false,code:'NOT_YOUR_TURN'});
 for(const outcome of ['不确定','出错','还没猜对'] as const) {const guess=value(rooms.beginGuess(code,'b','try',1));value(rooms.applyOutcome(code,guess.id,outcome));}
 now=46000;const guess=value(rooms.beginGuess(code,'b','secret synonym',1));expect(rooms.guessPoints(code,guess.id)).toBe(120);
 expect(JSON.stringify(value(rooms.toPublicView(code)))).not.toContain('secret synonym');
 now=999999;value(rooms.applyOutcome(code,guess.id,'破解成功'));
 const view=value(rooms.toPublicView(code));expect(view.players.find(p=>p.key==='b')?.roundPoints).toBe(120);expect(view.players.find(p=>p.key==='a')?.roundPoints).toBe(40);
 expect(rooms.applyOutcome(code,guess.id,'破解成功').ok).toBe(false);
 const originalId=value(rooms.getRoom(code)).gameId,snapshots=rooms.exportSnapshots(),restored=new RoomManager();restored.restoreSnapshots(snapshots);
 expect(value(restored.getRoom(code)).gameId).toBe(originalId);
 value(rooms.start(code,'a','word'));expect(value(rooms.getRoom(code)).gameId).not.toBe(originalId);expect(value(rooms.toPublicView(code)).drawerKey).toBe('b');
});
test('unlimited attempts are rate limited at socket, never gated by maxGuesses; secret holders cannot score',()=>{
 const rooms=new RoomManager(),code=value(rooms.createRoom('a','a')).code;value(rooms.join(code,'a','a','sa'));value(rooms.join(code,'b','b','sb'));
 value(rooms.updateSettings(code,'a',{maxGuesses:1}));value(rooms.start(code,'a','word'));
 for(let n=0;n<20;n++) {const guess=value(rooms.beginGuess(code,'b','wrong'));value(rooms.applyOutcome(code,guess.id,'还没猜对'));}
 expect(value(rooms.toPublicView(code)).phase).toBe('playing');
 value(rooms.markSecretHolder(code,'b'));expect(rooms.beginGuess(code,'b','word')).toMatchObject({ok:false,code:'NOT_YOUR_TURN'});
});

test('additive migration/reopen preserves legacy scores and durable round idempotency',()=>{
 const directory=mkdtempSync(join(tmpdir(),'pictionary-scoring-')),path=join(directory,'scores.sqlite');
 try {
  const first=openDb(path);const legacy=new ScoreRepo(first);
  legacy.award({id:'legacy',playerKey:'solver',name:'旧玩家',puzzleId:'old',normText:'old',proximity:70});
  legacy.awardRound(award);first.close();
  for(let attempt=0;attempt<2;attempt++) {
   const reopened=openDb(path);try {
    const scores=new ScoreRepo(reopened);expect(scores.awardRound(award)).toEqual({solverPoints:0,drawerPoints:0});expect(scores.playerPoints('solver')).toBe(132);
    expect(reopened.prepare('SELECT points FROM score_awards WHERE id=?').get('legacy')?.points).toBe(7);
    expect(reopened.prepare('SELECT count(*) AS n FROM round_score_awards').get()?.n).toBe(2);
   } finally {reopened.close();}
  }
 } finally {rmSync(directory,{recursive:true,force:true});}
});
