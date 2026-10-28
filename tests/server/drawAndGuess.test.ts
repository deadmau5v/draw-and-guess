import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { RoomManager } from '../../server/rooms/roomManager.js';
import { createJevJudge } from '../../server/jev/judge.js';
import { openDb, seedIfEmpty } from '../../server/db.js';
import { PuzzleRepo } from '../../server/puzzles/repo.js';
import type { Ack, SeedPuzzle, StrokeInput } from '../../shared/protocol.js';
function value<T>(ack:Ack<T>):T {if(!ack.ok) throw Error(ack.msg);return ack.value;}
const sample:SeedPuzzle={id:'word',title:'动物词条',surface:'3个字 · 动物',bottom:'大熊猫',hints:[],difficulty:1,tags:['动物'],nsfl:false,source:{key:'draw-bank',repo:'test',url:'test',license:'MIT'},alsoIn:[]};
const stroke:StrokeInput={round:1,tool:'pen',color:'#ff3b30',size:12,points:[{x:100,y:120,p:0.7},{x:240,y:260,p:0.8}]};
function setup(){const rooms=new RoomManager(),code=value(rooms.createRoom('甲','a')).code;value(rooms.join(code,'甲','a','sa'));value(rooms.join(code,'乙','b','sb'));value(rooms.start(code,'a','word'));return {rooms,code};}
describe('classic Pictionary canvas and ordinary words',()=>{
 it('preserves device, avatar and strokes across reconnect',()=>{
  const {rooms,code}=setup();value(rooms.join(code,'甲','a','stylus',undefined,{kind:'stylus',os:'iPadOS',browser:'Safari',label:'iPad · Pencil'}));value(rooms.addStroke(code,'a',stroke));
  value(rooms.disconnect('stylus'));const restored=value(rooms.join(code,'甲','a','replacement'));
  expect(restored.players[0]).toMatchObject({online:true,device:{kind:'stylus',label:'iPad · Pencil'}});expect(restored.strokes?.[0]?.points).toEqual(stroke.points);
 });
 it('only the drawer writes, undo removes own strokes only, drawer/host can clear; stale or missing round fails',()=>{
  const {rooms,code}=setup();expect(rooms.addStroke(code,'b',stroke)).toMatchObject({ok:false,code:'NOT_YOUR_TURN'});
  expect(rooms.addStroke(code,'a',{...stroke,round:undefined})).toMatchObject({ok:false,code:'INVALID'});
  value(rooms.addStroke(code,'a',stroke));expect(rooms.undoStroke(code,'b',1).ok).toBe(false);expect(rooms.clearCanvas(code,'b',1).ok).toBe(false);
  const snapshot=value(rooms.getRoom(code));snapshot.strokes.push({...snapshot.strokes[0]!,id:'foreign',playerKey:'b'});rooms.restoreSnapshots([snapshot]);value(rooms.join(code,'甲','a','sa'));
  value(rooms.undoStroke(code,'a',1));expect(value(rooms.toPublicView(code)).strokes?.map(s=>s.id)).toEqual(['foreign']);
  expect(rooms.undoStroke(code,'a',1).ok).toBe(false);value(rooms.clearCanvas(code,'a',1));expect(value(rooms.toPublicView(code)).strokes).toEqual([]);
 });
 it('drawer stays secret-holder after leaving/rejoining and cannot score own word',()=>{
  const {rooms,code}=setup();value(rooms.leave(code,'a'));value(rooms.join(code,'甲','a','new'));
  expect(rooms.beginGuess(code,'a','word',1)).toMatchObject({ok:false,code:'NOT_YOUR_TURN'});
  expect(rooms.beginGuess(code,'b','word',1)).toMatchObject({ok:false,code:'NOT_YOUR_TURN'});
 });
 it('exact ordinary word judging is local and never consumes a remote request',async()=>{
  const database=openDb(':memory:');try {
   seedIfEmpty(database,[sample]);const secret=new PuzzleRepo(database).getSecret(sample.id)!,fetchMock=vi.fn<typeof fetch>();
   const judge=createJevJudge({apiKey:'',judgeConfigured:false,model:'test',judgeThreshold:0.4,solveThreshold:0.55,port:3001,dbPath:':memory:'},database,fetchMock);
   expect(await judge.judgeSolution(secret,' 大熊猫！ ')).toEqual({outcome:'破解成功',confidence:1});expect(fetchMock).not.toHaveBeenCalled();
  } finally {database.close();}
 });
 it('bundled vocabulary has no story mysteries and public descriptions exclude target words',()=>{
  const bank=JSON.parse(readFileSync(new URL('../../data/puzzles.json',import.meta.url),'utf8')) as SeedPuzzle[];
  expect(bank.length).toBeGreaterThanOrEqual(100);
  for(const item of bank) {expect(item.bottom.trim()).not.toBe('');expect(item.title).not.toContain(item.bottom);expect(item.surface).not.toContain(item.bottom);expect(`${item.title} ${item.surface}`).not.toMatch(/酒保|尸体|半根火柴|海龟汤/);}
 });
});
