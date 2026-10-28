import { expect, it } from 'vitest';
import { RoomManager } from '../../server/rooms/roomManager.js';
import type { Ack } from '../../shared/protocol.js';
function value<T>(result:Ack<T>):T {if(!result.ok) throw Error(result.msg);return result.value;}
function setup(){let now=1000;const rooms=new RoomManager({now:()=>now}),code=value(rooms.createRoom('甲','a')).code;value(rooms.join(code,'甲','a','sa'));value(rooms.join(code,'乙','b','sb'));return {rooms,code,time:(next:number)=>{now=next;},view:()=>value(rooms.toPublicView(code))};}
it('default speed baseline is90 seconds and only host may configure15–600 integer seconds',()=>{
 const {rooms,code,view}=setup();expect(view().settings.turnSeconds).toBe(90);
 for(const turnSeconds of [0,14,601,30.5,NaN]) expect(rooms.updateSettings(code,'a',{turnSeconds})).toMatchObject({ok:false,code:'INVALID'});
 expect(rooms.updateSettings(code,'b',{turnSeconds:60})).toMatchObject({ok:false,code:'NOT_HOST'});
 value(rooms.updateSettings(code,'a',{turnSeconds:60}));value(rooms.start(code,'a','word'));expect(view().settings.turnSeconds).toBe(60);
});
it('round start survives reconnect; 1st solver gets 15 points on 15-player descending scale',()=>{
 const {rooms,code,time}=setup();value(rooms.start(code,'a','word'));
 const initial=value(rooms.getRoom(code));time(46000);value(rooms.disconnect('sb'));value(rooms.join(code,'乙','b','new-socket'));
 expect(value(rooms.getRoom(code))).toMatchObject({startedAt:1000,gameId:initial.gameId});
 const guess=value(rooms.beginGuess(code,'b','word',1));time(999999);expect(rooms.guessPoints(code,guess.id)).toBe(15);
 value(rooms.applyOutcome(code,guess.id,'破解成功'));expect(value(rooms.toPublicView(code)).players[1].roundPoints).toBe(15);
});
it('a new round resets server start time and rotates the drawer',()=>{
 const {rooms,code,time,view}=setup();value(rooms.start(code,'a','first'));value(rooms.reveal(code,'a'));time(500000);value(rooms.start(code,'a','second'));
 expect(value(rooms.getRoom(code)).startedAt).toBe(500000);expect(view()).toMatchObject({round:2,drawerKey:'b',guesses:[]});
 expect(rooms.beginGuess(code,'a','old round',1)).toMatchObject({ok:false,code:'INVALID'});
 const guess=value(rooms.beginGuess(code,'a','second',2));expect(rooms.guessPoints(code,guess.id)).toBe(15);
});
