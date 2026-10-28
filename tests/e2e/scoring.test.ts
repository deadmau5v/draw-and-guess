import { afterEach, expect, test, vi } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import type { Ack, ClientToServer, ServerToClient, RoomView } from '../../shared/protocol';
import { createApp } from '../../server/app';
import { fixture, bottom } from './fixture';
import { RoomManager } from '../../server/rooms/roomManager';
const clients:Socket<ServerToClient,ClientToServer>[]=[];
let app:ReturnType<typeof createApp>|undefined;
afterEach(async()=>{clients.splice(0).forEach(s=>s.disconnect());await app?.close();app=undefined;vi.restoreAllMocks();});
function state(socket:Socket<ServerToClient,ClientToServer>,predicate:(r:RoomView)=>boolean):Promise<RoomView> {
 return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{socket.off('room:state',on);reject(Error('State timeout'));},2000);const on=(r:RoomView)=>{if(predicate(r)){clearTimeout(timeout);socket.off('room:state',on);resolve(r);}};socket.on('room:state',on);});
}
test('correct guess earns elapsed-time points minus wrong penalties, drawer +40; reconnect and next game retain totals',async()=>{
 let now=1000;
 const deps=fixture({judgeQuestion:async()=>({verdict:'出错',confidence:0}),judgeSolution:async(_p,text)=>({outcome:text==='wrong'?'还没猜对':'破解成功',confidence:1}),totalCost:()=>0});
 deps.rooms=new RoomManager({now:()=>now});vi.spyOn(Date,'now').mockImplementation(()=>now);
 app=createApp(deps);await new Promise<void>(r=>app!.httpServer.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${(app.httpServer.address() as AddressInfo).port}`;
 const made=deps.rooms.createRoom('甲','a');if(!made.ok) throw Error(made.msg);const code=made.value.code;
 const connect=async(key:string)=>{const s:Socket<ServerToClient,ClientToServer>=io(url,{transports:['websocket'],reconnection:false});clients.push(s);await new Promise<void>(r=>s.once('connect',r));const joined=await new Promise<Ack<RoomView>>(r=>s.emit('room:join',{code,name:key,playerKey:key},r));return {s,joined};};
 const {s:a}=await connect('a'),{s:b}=await connect('b');await new Promise(r=>a.emit('game:start',{},r));
 const wrong=state(a,r=>r.guesses[0]?.outcome==='还没猜对');await new Promise(r=>b.emit('guess:submit',{round:1,text:'wrong'},r));
 expect(JSON.stringify(await wrong)).not.toContain(bottom);now=46000;
 const solved=state(a,r=>r.phase==='revealed');await new Promise(r=>b.emit('guess:submit',{round:1,text:'synonym'},r));
 const scored=await solved;
 expect(scored.players.find(p=>p.key==='b')).toMatchObject({roundPoints:15,totalPoints:15});
 expect(scored.players.find(p=>p.key==='a')).toMatchObject({roundPoints:5,totalPoints:5});
 expect(scored.guesses[1]).toMatchObject({points:15,outcome:'破解成功'});
 expect(deps.db.prepare('SELECT count(*) AS n FROM round_score_awards').get()?.n).toBe(2);
 const ranking=await fetch(`${url}/api/leaderboard?playerKey=b`).then(r=>r.json());expect(ranking.self).toMatchObject({points:15});expect(JSON.stringify(ranking)).not.toContain(bottom);
 const {joined}=await connect('b');expect(joined).toMatchObject({ok:true,value:{players:expect.arrayContaining([expect.objectContaining({key:'b',totalPoints:15})])}});
 await new Promise(r=>a.emit('game:start',{},r));
 expect(await new Promise(r=>a.emit('room:join',{code,name:'a',playerKey:'a'},r))).toMatchObject({ok:true,value:{players:expect.arrayContaining([expect.objectContaining({key:'a',roundPoints:0,totalPoints:5})])}});
});
test('low confidence success is uncertain and never reports points',async()=>{
 const deps=fixture({judgeQuestion:async()=>({verdict:'出错',confidence:0}),judgeSolution:async()=>({outcome:'破解成功',confidence:0.1}),totalCost:()=>0});
 app=createApp(deps);await new Promise<void>(r=>app!.httpServer.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${(app.httpServer.address() as AddressInfo).port}`;
 const made=deps.rooms.createRoom('甲','a');if(!made.ok) throw Error(made.msg);
 const [a,b]=await Promise.all(['a','b'].map(async key=>{const s:Socket<ServerToClient,ClientToServer>=io(url,{transports:['websocket']});clients.push(s);await new Promise<void>(r=>s.once('connect',r));await new Promise(r=>s.emit('room:join',{code:made.value.code,name:key,playerKey:key},r));return s;}));
 await new Promise(r=>a.emit('game:start',{},r));const uncertain=state(a,r=>r.guesses[0]?.outcome==='不确定');await new Promise(r=>b.emit('guess:submit',{round:1,text:'maybe'},r));expect((await uncertain).players.every(p=>p.totalPoints===0)).toBe(true);
 expect(deps.db.prepare('SELECT count(*) AS n FROM round_score_awards').get()?.n).toBe(0);
});

test('atomic persistence failure credits neither player and does not claim earned points',async()=>{
 const deps=fixture();app=createApp(deps);await new Promise<void>(r=>app!.httpServer.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${(app.httpServer.address() as AddressInfo).port}`;
 const made=deps.rooms.createRoom('甲','a');if(!made.ok) throw Error(made.msg);
 const [a,b]=await Promise.all(['a','b'].map(async key=>{const s:Socket<ServerToClient,ClientToServer>=io(url,{transports:['websocket']});clients.push(s);await new Promise<void>(r=>s.once('connect',r));await new Promise(r=>s.emit('room:join',{code:made.value.code,name:key,playerKey:key},r));return s;}));
 deps.db.exec("CREATE TRIGGER fail_scores BEFORE INSERT ON player_scores BEGIN SELECT RAISE(ABORT,'forced'); END");
 await new Promise(r=>a.emit('game:start',{},r));const done=state(a,r=>r.phase==='revealed');await new Promise(r=>b.emit('guess:submit',{round:1,text:'correct'},r));
 const final=await done;expect(final.players.every(p=>p.totalPoints===0&&p.roundPoints===0)).toBe(true);expect(final.guesses[0]).toMatchObject({points:0,outcome:'破解成功'});
 expect(deps.db.prepare('SELECT count(*) AS n FROM round_score_awards').get()?.n).toBe(0);
});
