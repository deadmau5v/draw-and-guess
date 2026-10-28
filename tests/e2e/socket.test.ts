import { afterEach, expect, test, vi } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import type { Ack, ClientToServer, ServerToClient, RoomView, StrokeInput } from '../../shared/protocol.js';
import { createApp } from '../../server/app.js';
import { fixture, bottom } from './fixture.js';
let app:ReturnType<typeof createApp>|undefined;
const clients:Socket<ServerToClient,ClientToServer>[]=[];
afterEach(async()=>{clients.splice(0).forEach(s=>s.disconnect());await app?.close();app=undefined;vi.restoreAllMocks();});
async function setup(deps=fixture()) {
 app=createApp(deps);await new Promise<void>(resolve=>app!.httpServer.listen(0,'127.0.0.1',resolve));
 const address=app.httpServer.address();if(!address||typeof address==='string') throw Error('Not listening');
 const result=deps.rooms.createRoom('甲','a');if(!result.ok) throw Error(result.msg);
 const connect=async()=>{const s:Socket<ServerToClient,ClientToServer>=io(`http://127.0.0.1:${address.port}`,{transports:['websocket'],reconnection:false});clients.push(s);await new Promise<void>(resolve=>s.once('connect',resolve));return s;};
 const a=await connect(),b=await connect();
 const join=(s:typeof a,key:string)=>new Promise<Ack<RoomView>>(resolve=>s.emit('room:join',{code:result.value.code,name:key==='a'?'甲':'乙',playerKey:key,avatar:'/assets/avatars/player-anime.png'},resolve));
 await join(a,'a');await join(b,'b');
 return {deps,a,b,join,connect,code:result.value.code};
}
function state(s:Socket<ServerToClient,ClientToServer>,predicate:(r:RoomView)=>boolean):Promise<RoomView> {
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{s.off('room:state',on);reject(Error('State timeout'));},2000);const on=(r:RoomView)=>{if(predicate(r)){clearTimeout(timer);s.off('room:state',on);resolve(r);}};s.on('room:state',on);});
}
const stroke:StrokeInput={round:1,tool:'pen',color:'#123456',size:8,points:[{x:20,y:30,p:0.5}]};
test('classic canvas enforces drawer authority, stale round checks and full reconnect sync',async()=>{
 const {a,b,join,connect}=await setup();await new Promise<Ack>(r=>a.emit('game:start',{},r));
 expect(await new Promise(r=>b.emit('canvas:stroke',stroke,r))).toMatchObject({ok:false,code:'NOT_YOUR_TURN'});
 expect(await new Promise(r=>a.emit('canvas:stroke',{...stroke,round:2},r))).toMatchObject({ok:false,code:'INVALID'});
 const drawn=state(b,r=>r.strokes?.length===1);
 expect(await new Promise(r=>a.emit('canvas:stroke',stroke,r))).toMatchObject({ok:true});
 const view=await drawn;expect(JSON.stringify(view)).not.toContain(bottom);
 expect(await new Promise(r=>b.emit('canvas:undo',{round:1},r))).toMatchObject({ok:false});
 expect(await new Promise(r=>b.emit('canvas:clear',{round:1},r))).toMatchObject({ok:false,code:'NOT_YOUR_TURN'});
 const replacement=await connect(),restored=await join(replacement,'b');
 expect(restored).toMatchObject({ok:true,value:{strokes:view.strokes,drawerKey:'a',hints:[],log:[],progress:null}});
 expect(JSON.stringify(restored)).not.toContain(bottom);
 expect(await new Promise(r=>b.emit('canvas:clear',{round:1},r))).toMatchObject({ok:false,code:'NOT_IN_ROOM'});
 expect(await new Promise(r=>a.emit('canvas:undo',{round:1},r))).toMatchObject({ok:true});
 expect(await new Promise(r=>a.emit('canvas:stroke',stroke,r))).toMatchObject({ok:true});
 expect(await new Promise(r=>a.emit('canvas:clear',{round:1},r))).toMatchObject({ok:true});
});
test('retired questions/hints/AI/modes fail explicitly and never call judge services',async()=>{
 const question=vi.fn(async()=>({verdict:'是' as const,confidence:1}));
 const {a,b}=await setup(fixture({judgeQuestion:question,judgeSolution:async()=>({outcome:'还没猜对',confidence:1}),totalCost:()=>0}));
 await new Promise(r=>a.emit('game:start',{},r));
 expect(await new Promise(r=>b.emit('q:ask',{text:'问题'},r))).toMatchObject({ok:false,code:'INVALID'});
 expect(await new Promise(r=>b.emit('hint:show',r))).toMatchObject({ok:false,code:'INVALID'});
 expect(await new Promise(r=>b.emit('canvas:ai-guess',{},r))).toMatchObject({ok:false,code:'INVALID'});
 expect(await new Promise(r=>a.emit('canvas:next-frame',{round:1},r))).toMatchObject({ok:false,code:'INVALID'});
 expect(await new Promise(r=>a.emit('party:bluff',{text:'答案'},r))).toMatchObject({ok:false,code:'INVALID'});
 expect(question).not.toHaveBeenCalled();
});
test('drawer secret is private, self guesses fail; first solve reveals, rotates drawer and host cannot read next word',async()=>{
 const {a,b,deps}=await setup();const payloads:unknown[]=[];
 for(const s of [a,b]) {let revealed=false;s.onAny((event,...args)=>{if(event==='game:revealed') revealed=true;if(!revealed) payloads.push(args);});}
 await new Promise(r=>a.emit('game:start',{},r));
 expect(await new Promise(r=>b.emit('drawer:word',r))).toMatchObject({ok:false,code:'NOT_YOUR_TURN'});
 expect(await new Promise(r=>a.emit('drawer:word',r))).toMatchObject({ok:true,value:{word:bottom,hints:[]}});
 expect(await new Promise(r=>a.emit('guess:submit',{round:1,text:bottom},r))).toMatchObject({ok:false,code:'NOT_YOUR_TURN'});
 const done=state(a,r=>r.phase==='revealed'&&!!r.reveal);
 expect(await new Promise(r=>b.emit('guess:submit',{round:1,text:'同义答案'},r))).toMatchObject({ok:true});
 const final=await done;expect(final.reveal).toMatchObject({bottom,winnerName:'乙',reason:'solved'});
 for(const payload of payloads) {expect(JSON.stringify(payload)).not.toContain(bottom);expect(JSON.stringify(payload)).not.toContain('同义答案');}
 expect(deps.db.prepare('SELECT count(*) AS n FROM games').get()?.n).toBe(1);
 const next=state(b,r=>r.round===2);await new Promise(r=>a.emit('game:start',{puzzleId:'test-1'},r));
 expect((await next).drawerKey).toBe('b');
 expect(await new Promise(r=>a.emit('drawer:word',r))).toMatchObject({ok:false,code:'NOT_YOUR_TURN'});
 expect(await new Promise(r=>a.emit('canvas:stroke',{...stroke,round:1},r))).toMatchObject({ok:false,code:'INVALID'});
 expect(await new Promise(r=>a.emit('guess:submit',{round:1,text:'旧猜词'},r))).toMatchObject({ok:false,code:'INVALID'});
});
test('pending requests are idempotent, uncertain/errors refund attempts and do not award; raw synonyms never broadcast',async()=>{
 let resolve!:(v:{outcome:'不确定';confidence:number})=>void;
 const solution=vi.fn(()=>new Promise<{outcome:'不确定';confidence:number}>(r=>{resolve=r;}));
 const {a,b,deps}=await setup(fixture({judgeQuestion:async()=>({verdict:'出错',confidence:0}),judgeSolution:solution,totalCost:()=>0}));
 await new Promise(r=>a.emit('game:start',{},r));
 const first=await new Promise(r=>b.emit('guess:submit',{round:1,text:'保密同义词'},r));
 await vi.waitFor(()=>expect(solution).toHaveBeenCalledOnce());
 expect(await new Promise(r=>b.emit('guess:submit',{round:1,text:'保密同义词！'},r))).toEqual(first);
 expect(await new Promise(r=>b.emit('guess:submit',{round:1,text:'另一猜词'},r))).toMatchObject({ok:false});
 const judged=state(a,r=>r.guesses[0]?.outcome==='不确定');resolve({outcome:'不确定',confidence:0.2});
 const view=await judged;expect(view.players.find(p=>p.key==='b')).toMatchObject({guesses:0,pending:false,totalPoints:0});
 expect(JSON.stringify(view)).not.toContain('保密同义词');expect(JSON.stringify(view)).not.toContain(bottom);
 expect(deps.db.prepare('SELECT count(*) AS n FROM round_score_awards').get()?.n).toBe(0);
});
test('late judge result after host reveal and next round cannot award or mutate the next round',async()=>{
 let resolve!:(v:{outcome:'破解成功';confidence:number})=>void;
 const solution=vi.fn(()=>new Promise<{outcome:'破解成功';confidence:number}>(r=>{resolve=r;}));
 const {a,b,deps,code}=await setup(fixture({judgeQuestion:async()=>({verdict:'出错',confidence:0}),judgeSolution:solution,totalCost:()=>0}));
 await new Promise(r=>a.emit('game:start',{},r));await new Promise(r=>b.emit('guess:submit',{round:1,text:'等待'},r));
 await vi.waitFor(()=>expect(solution).toHaveBeenCalledOnce());
 await new Promise(r=>a.emit('game:reveal',r));await new Promise(r=>a.emit('game:start',{},r));
 const unchanged=state(a,r=>r.round===2&&r.phase==='playing');resolve({outcome:'破解成功',confidence:1});
 await unchanged;const room=deps.rooms.getRoom(code);expect(room.ok&&room.value.guesses).toEqual([]);
 expect(deps.db.prepare('SELECT count(*) AS n FROM round_score_awards').get()?.n).toBe(0);
});
