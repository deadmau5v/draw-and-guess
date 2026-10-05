import { afterEach, expect, test, vi } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import type { Ack, ClientToServer, ServerToClient, RoomView } from '../../shared/protocol.js';
import { createApp } from '../../server/app.js';
import { fixture, bottom } from './fixture.js';
let app:ReturnType<typeof createApp>;
const clients:Socket<ServerToClient,ClientToServer>[]=[];
afterEach(async()=>{clients.splice(0).forEach(s=>s.disconnect());if(app) await app.close();});
async function setup(deps=fixture()) {
 app=createApp(deps);
 await new Promise<void>(resolve=>app.httpServer.listen(0,'127.0.0.1',resolve));
 const address=app.httpServer.address();if(!address||typeof address==='string') throw Error('未监听');
 const result=deps.rooms.createRoom('甲','a');if(!result.ok) throw Error(result.msg);
 const connect=async()=>{const s:Socket<ServerToClient,ClientToServer>=io(`http://127.0.0.1:${address.port}`,{transports:['websocket'],reconnection:false});clients.push(s);await new Promise<void>(resolve=>s.once('connect',resolve));return s;};
 const a=await connect(),b=await connect();
 const join=(s:typeof a,key:string,avatar?:string)=>new Promise<Ack<RoomView>>(resolve=>s.emit('room:join',{code:result.value.code,name:key==='a'?'甲':'乙',playerKey:key,avatar},resolve));
 return {deps,a,b,join,connect,code:result.value.code};
}
function state(s:Socket<ServerToClient,ClientToServer>,predicate:(r:RoomView)=>boolean):Promise<RoomView> {
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{s.off('room:state',onState);reject(Error('等待状态超时'));},1500);const onState=(r:RoomView)=>{if(predicate(r)){clearTimeout(timer);s.off('room:state',onState);resolve(r);}};s.on('room:state',onState);});
}
test('玩家真实头像广播给其他玩家，提问记录与重连保持头像且无汤底泄漏',async()=>{
 const {a,b,join,connect}=await setup();
 const anime='/assets/avatars/player-anime.png', smile='/assets/avatars/player-smile.png';
 await join(a,'a',anime);
 const broadcast=state(a,r=>r.players.some(p=>p.key==='b'&&p.avatar===smile));
 const joined=await join(b,'b',smile);expect(joined.ok).toBe(true);
 const view=await broadcast;
 expect(view.players.find(p=>p.key==='a')?.avatar).toBe(anime);
 expect(JSON.stringify(joined).includes(bottom)).toBe(false);
 expect(JSON.stringify(view).includes(bottom)).toBe(false);
 await new Promise<Ack>(resolve=>a.emit('game:start',{},resolve));
 const question=state(a,r=>r.log[0]?.verdict==='是');
 await new Promise<Ack<{id:string}>>(resolve=>b.emit('q:ask',{text:'他活着吗'},resolve));
 const logged=await question;expect(logged.log[0].avatar).toBe(smile);
 expect(JSON.stringify(logged).includes(bottom)).toBe(false);
 const restored=await join(await connect(),'b');
 if(!restored.ok) throw Error(restored.msg);
 expect(restored.value.players.find(p=>p.key==='b')?.avatar).toBe(smile);
 expect(JSON.stringify(restored).includes(bottom)).toBe(false);
},5000);
test('两人开局、提问广播、成功还原揭晓，揭晓前所有事件与 ack 均不含汤底',async()=>{
 const {a,b,join,deps}=await setup();
 const payloads:unknown[]=[];
 for(const s of [a,b]) {let revealed=false;s.onAny((event,...args)=>{if(event==='game:revealed') revealed=true;if(!revealed) payloads.push(args);});}
 payloads.push(await join(a,'a'),await join(b,'b'));
 payloads.push(await new Promise<Ack>(r=>a.emit('game:start',{puzzleId:'test-1'},r)));
 const qaA=state(a,r=>r.log[0]?.verdict==='是'),qaB=state(b,r=>r.log[0]?.verdict==='是');
 const ask=await new Promise<Ack<{id:string}>>(r=>b.emit('q:ask',{text:'他活着吗'},r));payloads.push(ask);expect(ask.ok).toBe(true);
 await Promise.all([qaA,qaB]);
 const revealA=new Promise(r=>a.once('game:revealed',r)),revealB=new Promise(r=>b.once('game:revealed',r));
 const final=state(a,r=>r.phase==='revealed'&&!!r.reveal);
 const guess=await new Promise<Ack<{id:string}>>(r=>a.emit('guess:submit',{text:'他在打嗝'},r));payloads.push(guess);expect(guess.ok).toBe(true);
 for(const reveal of await Promise.all([revealA,revealB])) expect(reveal).toMatchObject({bottom,winnerName:'甲',reason:'solved'});
 expect((await final).reveal?.bottom).toBe(bottom);
 for(const p of payloads) expect(JSON.stringify(p)).not.toContain(bottom);
 expect(deps.repo.getPublic('test-1')).toMatchObject({plays:1,solves:1});
 expect(deps.db.prepare('SELECT count(*) AS n FROM games').get()?.n).toBe(1);
},5000);

test('断线重连保留身份、昵称和提问计数，旧连接失去操作权限',async()=>{
 const {a,b,join,connect}=await setup();await join(a,'a');await join(b,'b');
 await new Promise<Ack>(r=>a.emit('game:start',{},r));
 const judged=state(b,r=>r.log[0]?.verdict==='是');await new Promise(r=>b.emit('q:ask',{text:'他活着吗'},r));await judged;
 const replacement=await connect();const joined=await join(replacement,'b');expect(joined.ok).toBe(true);
 if(joined.ok) expect(joined.value.players.find(p=>p.key==='b')).toMatchObject({name:'乙',asked:1,online:true});
 expect(await new Promise(r=>b.emit('game:start',{},r))).toMatchObject({ok:false,code:'NOT_IN_ROOM'});
 const oldServerSocket=app.io.sockets.sockets.get(b.id!);
 expect(oldServerSocket?.rooms.has(joined.ok?joined.value.code:'')).toBe(false);
 const offline=state(a,r=>r.players.some(p=>p.key==='b'&&!p.online));replacement.disconnect();await offline;
 const reconnect=await connect();const restored=await join(reconnect,'b');if(!restored.ok) throw Error(restored.msg);
 expect(restored.value.players.filter(p=>p.key==='b')).toHaveLength(1);
 expect(restored.value.players.find(p=>p.key==='b')).toMatchObject({asked:1,online:true});
});

test('重连 ack 投影公开题面与已公开提示，状态机不保存题面或提示文本',async()=>{
 const {a,b,join,connect,deps,code}=await setup();await join(a,'a');await join(b,'b');
 expect(await new Promise(r=>a.emit('game:start',{puzzleId:'test-1'},r))).toMatchObject({ok:true});
 expect(await new Promise(r=>a.emit('hint:show',r))).toMatchObject({ok:true});
 const replacement=await connect();const restored=await join(replacement,'b');
 expect(restored).toMatchObject({ok:true,value:{puzzle:{id:'test-1',hintCount:1},hints:['他没有受伤'],hintCount:1}});
 expect(JSON.stringify(restored)).not.toContain(bottom);
 if(restored.ok) {expect(restored.value.puzzle).not.toHaveProperty('bottom');expect(restored.value.puzzle).not.toHaveProperty('hints');}
 const internal=deps.rooms.getRoom(code);if(!internal.ok) throw Error(internal.msg);
 expect(internal.value).not.toHaveProperty('puzzle');expect(internal.value).not.toHaveProperty('hintTexts');
});

test('房主设置、公开提示、主动揭晓、评分 upsert、踢人及离房',async()=>{
 const {a,b,join,deps,code}=await setup();await join(a,'a');await join(b,'b');
 expect(await new Promise(r=>b.emit('room:settings',{quota:1},r))).toMatchObject({ok:false,code:'NOT_HOST'});
 expect(await new Promise(r=>a.emit('room:settings',{quota:1,maxGuesses:1},r))).toMatchObject({ok:true});
 await new Promise(r=>a.emit('game:start',{},r));
 expect(await new Promise(r=>b.emit('rate',{score:1,funny:true},r))).toMatchObject({ok:false,code:'BAD_PHASE'});
 expect(await new Promise(r=>b.emit('hint:show',r))).toMatchObject({ok:false,code:'NOT_HOST'});
 const hinted=state(b,r=>r.hints.length===1);expect(await new Promise(r=>a.emit('hint:show',r))).toMatchObject({ok:true});
 expect((await hinted).hints).toEqual(['他没有受伤']);
 expect(await new Promise(r=>a.emit('hint:show',r))).toMatchObject({ok:false,code:'INVALID'});
 const revealed=state(b,r=>!!r.reveal);expect(await new Promise(r=>a.emit('game:reveal',r))).toMatchObject({ok:true});expect((await revealed).reveal?.reason).toBe('host');
 for(const score of [1,-1] as const) expect(await new Promise(r=>b.emit('rate',{score,funny:true},r))).toMatchObject({ok:true});
 expect(deps.repo.getPublic('test-1')).toMatchObject({ratings:1,goodRate:0,funny:1,plays:1,solves:0});
 const kicked=new Promise<void>(r=>b.once('room:kicked',r));expect(await new Promise(r=>a.emit('room:kick',{playerKey:'b'},r))).toMatchObject({ok:true});await kicked;
 expect(await new Promise(r=>b.emit('rate',{score:1,funny:false},r))).toMatchObject({ok:false,code:'NOT_IN_ROOM'});
 expect(await new Promise(r=>a.emit('room:leave',r))).toMatchObject({ok:true});expect(deps.rooms.getRoom(code).ok).toBe(false);
},5000);

test('每房串行判题、按身份限流且异常退还额度',async()=>{
 let rejectQuestion!:(reason:Error)=>void;
 const question=vi.fn(()=>new Promise<{verdict:'是';confidence:number}>((_resolve,reject)=>{rejectQuestion=reject;}));
 const solution=vi.fn(async()=>({outcome:'破解成功' as const,confidence:1}));
 const {a,b,join}=await setup(fixture({judgeQuestion:question,judgeSolution:solution,totalCost:()=>0}));
 await join(a,'a');await join(b,'b');await new Promise(r=>a.emit('game:start',{},r));
 await new Promise(r=>b.emit('q:ask',{text:'他活着吗'},r));await vi.waitFor(()=>expect(question).toHaveBeenCalledOnce());
 expect(await new Promise(r=>b.emit('q:ask',{text:'重复问'},r))).toMatchObject({ok:false,code:'RATE_LIMITED'});
 await new Promise(r=>a.emit('guess:submit',{text:'打嗝'},r));expect(solution).not.toHaveBeenCalled();
 const failed=state(a,r=>r.log[0]?.verdict==='出错');const solved=state(b,r=>!!r.reveal);
 rejectQuestion(Error('网络不可用'));const errorState=await failed;
 expect(errorState.players.find(p=>p.key==='b')).toMatchObject({asked:0,pending:false});
 await solved;expect(solution).toHaveBeenCalledOnce();
});

test.each(['BAD_PHASE','INVALID','PENDING','NOT_YOUR_TURN'] as const)('%s 拒绝不消耗限流，随后合法判题可立即提交',async reason=>{
 const {a,b,join,deps,code}=await setup();await join(a,'a');await join(b,'b');
 const ask=(text:string)=>new Promise<Ack<{id:string}>>(r=>b.emit('q:ask',{text},r));
 if(reason==='NOT_YOUR_TURN') deps.rooms.updateSettings(code,'a',{turnMode:'turns'});
 if(reason!=='BAD_PHASE') await new Promise(r=>a.emit('game:start',{},r));
 const pending=reason==='PENDING'?deps.rooms.beginGuess(code,'b','此前的请求'):null;
 for(let i=0;i<21;i++) expect(await ask(reason==='INVALID'?'字'.repeat(121):'他活着吗')).toMatchObject({ok:false,code:reason});
 if(reason==='BAD_PHASE') await new Promise(r=>a.emit('game:start',{},r));
 if(pending?.ok) deps.rooms.applyOutcome(code,pending.value.id,'还没猜对');
 if(reason==='NOT_YOUR_TURN') {
  const q=deps.rooms.beginAsk(code,'a','轮到我');if(!q.ok) throw Error(q.msg);
  deps.rooms.applyVerdict(code,q.value.id,'是',1);
 }
 expect(await ask('他活着吗')).toMatchObject({ok:true});
});

test.each(['BAD_PHASE','PENDING'] as const)('猜测 %s 拒绝后合法猜测可立即提交',async reason=>{
 const {a,b,join,deps,code}=await setup();await join(a,'a');await join(b,'b');
 if(reason==='PENDING') await new Promise(r=>a.emit('game:start',{},r));
 const pending=reason==='PENDING'?deps.rooms.beginAsk(code,'b','此前的问题'):null;
 expect(await new Promise(r=>b.emit('guess:submit',{text:'打嗝'},r))).toMatchObject({ok:false,code:reason});
 if(reason==='BAD_PHASE') await new Promise(r=>a.emit('game:start',{},r));
 if(pending?.ok) deps.rooms.applyVerdict(code,pending.value.id,'是',1);
 expect(await new Promise(r=>b.emit('guess:submit',{text:'打嗝'},r))).toMatchObject({ok:true});
});

test('共享资源耗尽自动揭晓并记录失败局',async()=>{
 const {a,b,join,deps}=await setup(fixture({judgeQuestion:async()=>({verdict:'不是',confidence:1}),judgeSolution:async()=>({outcome:'还没猜对',confidence:1}),totalCost:()=>0}));
 await join(a,'a');await join(b,'b');await new Promise(r=>b.emit('room:leave',r));
 await new Promise(r=>a.emit('room:settings',{quotaMode:'shared',quota:1,maxGuesses:1},r));await new Promise(r=>a.emit('game:start',{},r));
 const judged=state(a,r=>r.log[0]?.verdict==='不是');await new Promise(r=>a.emit('q:ask',{text:'他死了吗'},r));await judged;
 // 判题共用限流，等待满足最小间隔。
 await new Promise(r=>setTimeout(r,2050));
 const revealed=state(a,r=>!!r.reveal);await new Promise(r=>a.emit('guess:submit',{text:'猜错的答案'},r));
 expect((await revealed).reveal?.reason).toBe('exhausted');expect(deps.repo.getPublic('test-1')).toMatchObject({plays:1,solves:0});
});
