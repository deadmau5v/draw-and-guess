import { afterEach, expect, test, vi } from 'vitest';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import type { Ack, ClientToServer, ServerToClient, RoomView } from '../../shared/protocol';
import { createApp } from '../../server/app';
import { fixture, bottom } from './fixture';
const clients: Socket<ServerToClient,ClientToServer>[]=[];
let app:ReturnType<typeof createApp>|undefined;
afterEach(async()=>{clients.splice(0).forEach(s=>s.disconnect());await app?.close();app=undefined;vi.restoreAllMocks();});
function state(socket:Socket<ServerToClient,ClientToServer>,predicate:(r:RoomView)=>boolean):Promise<RoomView> {
 return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{socket.off('room:state',on);reject(Error('状态等待超时'));},2000);const on=(r:RoomView)=>{if(predicate(r)){clearTimeout(timeout);socket.off('room:state',on);resolve(r);}};socket.on('room:state',on);});
}
test('真实联机判题同步接近程度与积分，永久榜跨房间投影、重复问题与不确定不加分且不剧透',async()=>{
 let now=1000;vi.spyOn(Date,'now').mockImplementation(()=>now);
 const deps=fixture({judgeQuestion:async(_p,text)=>({verdict:text==='模糊'?'不确定':text==='无关'?'不相关':'是',confidence:1,proximity:75}),judgeSolution:async()=>({outcome:'还没猜对',confidence:1}),totalCost:()=>0});
 app=createApp(deps);await new Promise<void>(resolve=>app!.httpServer.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${(app.httpServer.address() as AddressInfo).port}`;
 const made=deps.rooms.createRoom('甲','a');if(!made.ok) throw Error(made.msg);const code=made.value.code;
 const a=io(url,{transports:['websocket']}),b=io(url,{transports:['websocket']});clients.push(a,b);
 await Promise.all([a,b].map(s=>new Promise<void>(r=>s.on('connect',r))));
 await new Promise<Ack<RoomView>>(r=>a.emit('room:join',{code,name:'甲',playerKey:'a'},r));await new Promise<Ack<RoomView>>(r=>b.emit('room:join',{code,name:'乙',playerKey:'b'},r));
 await new Promise<Ack>(r=>a.emit('game:start',{},r));
 const answered=state(b,r=>r.log[0]?.verdict==='是');await new Promise<Ack<{id:string}>>(r=>a.emit('q:ask',{text:'问？'},r));
 const scored=await answered;expect(scored.log[0]).toMatchObject({proximity:75,points:8});expect(scored.players[0]).toMatchObject({roundPoints:8,totalPoints:8});expect(JSON.stringify(scored)).not.toContain(bottom);
 // 同一局内重复提问被直接拦截（INVALID），不会重复判题或加分
 expect(await new Promise<Ack<{id:string}>>(r=>a.emit('q:ask',{text:'问'},r))).toMatchObject({ok:false,code:'INVALID'});
 const uncertain=state(a,r=>r.log[1]?.verdict==='不确定');await new Promise<Ack<{id:string}>>(r=>b.emit('q:ask',{text:'模糊'},r));expect((await uncertain).log[1].points).toBe(0);
 now+=3000;const unrelated=state(a,r=>r.log[2]?.verdict==='不相关');await new Promise<Ack<{id:string}>>(r=>b.emit('q:ask',{text:'无关'},r));expect((await unrelated).log[2]).toMatchObject({proximity:0,points:0});
 const ranking=await fetch(`${url}/api/leaderboard?playerKey=a`).then(r=>r.json());expect(ranking.self).toMatchObject({name:'甲',points:8,bestProximity:75});expect(JSON.stringify(ranking)).not.toContain(bottom);expect(JSON.stringify(ranking)).not.toContain('player_key');
 expect((await fetch(`${url}/api/leaderboard?limit=101`)).status).toBe(400);
 const hintOpened=state(a,r=>r.hints.length===1);expect(await new Promise<Ack>(r=>b.emit('hint:show',r))).toMatchObject({ok:true});expect(await hintOpened).toMatchObject({hintAnnouncement:{playerKey:'b',playerName:'乙',index:1}});
 await new Promise<Ack>(r=>a.emit('room:leave',r));const second=deps.rooms.createRoom('甲','a');if(!second.ok) throw Error(second.msg);
 const joined=await new Promise<Ack<RoomView>>(r=>a.emit('room:join',{code:second.value.code,name:'甲',playerKey:'a'},r));expect(joined).toMatchObject({ok:true,value:{players:[{totalPoints:8,roundPoints:0}]}});
 // 跨房间对同一道题重复提问同一问题时，永久榜去重不重复加分
 await new Promise<Ack>(r=>a.emit('game:start',{puzzleId:'test-1'},r));
 now+=3000;const duplicatedAcrossRooms=state(a,r=>r.log[0]?.verdict==='是');await new Promise<Ack<{id:string}>>(r=>a.emit('q:ask',{text:'问'},r));expect((await duplicatedAcrossRooms).log[0]).toMatchObject({proximity:75,points:0});
});
