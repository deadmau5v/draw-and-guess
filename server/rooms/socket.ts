import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Server } from 'socket.io';
import type { Ack, ClientToServer, ServerToClient, RoomView } from '../../shared/protocol.js';
import type { AppDeps } from '../app.js';
import { identitySchema } from '../http/routes.js';
import { RateLimiter } from '../util/rateLimit.js';
const invalid:Ack<never>={ok:false,code:'INVALID',msg:'请求参数无效'};
const absent:Ack<never>={ok:false,code:'NOT_IN_ROOM',msg:'请先加入房间'};
const internal:Ack<never>={ok:false,code:'INTERNAL',msg:'服务暂时不可用'};
const success:Ack={ok:true,value:undefined};
const textSchema=z.object({text:z.string().trim().min(1).max(400)}).strict();
export function attachSockets(io:Server<ClientToServer,ServerToClient>,deps:AppDeps) {
 const {rooms,repo,judge}=deps;
 const limiter=new RateLimiter();
 const queues=new Map<string,Promise<void>>();
 const gameIds=new Map<string,{round:number;id:string}>();
 let stopped=false;
 function publicView(code:string):Ack<RoomView> {
  const view=rooms.toPublicView(code), state=rooms.getRoom(code);
  if(!view.ok||!state.ok) return view;
  const room=state.value;
  view.value.puzzle=room.puzzleId?repo.getPublic(room.puzzleId):null;
  if(room.puzzleId&&room.hintsShown>0) view.value.hints=(repo.getSecret(room.puzzleId)?.hints??[]).slice(0,room.hintsShown);
  return view;
 }
 function broadcast(code:string):void {
  const result=rooms.getRoom(code);if(!result.ok) return;
  const room=result.value;
  if(room.phase==='revealed'&&!room.reveal&&room.puzzleId) {
   const secret=repo.getSecret(room.puzzleId);
   if(secret) {
    rooms.setReveal(code,{bottom:secret.bottom,hints:secret.hints,winnerName:room.winner,reason:room.revealReason!});
    const id=gameIds.get(code);
    repo.recordGame({id:id?.round===room.round?id.id:randomUUID(),roomCode:code,puzzleId:room.puzzleId,startedAt:room.startedAt!,endedAt:Date.now(),outcome:room.revealReason==='solved'?'破解成功':room.revealReason!,winnerName:room.winner,log:[...room.log,...room.guesses]});
    const view=publicView(code);if(view.ok&&view.value.reveal) io.to(code).emit('game:revealed',view.value.reveal);
   }
  }
  const view=publicView(code);if(view.ok) io.to(code).emit('room:state',view.value);
 }
 function enqueue(code:string,task:()=>Promise<void>):void {
  const next=(queues.get(code)??Promise.resolve()).then(task).catch(()=>{io.to(code).emit('toast',{level:'error',msg:'判题服务暂时不可用'});});
  queues.set(code,next);
  void next.then(()=>{if(queues.get(code)===next) queues.delete(code);});
 }
 io.on('connection',socket=>{
  let identity:{code:string;key:string}|null=null;
  function member():Ack<{code:string;key:string}> {
   if(!identity||stopped) return absent;
   const room=rooms.getRoom(identity.code);
   if(!room.ok||!room.value.players.some(p=>p.key===identity!.key&&p.socketId===socket.id&&p.online)) return absent;
   return {ok:true,value:identity};
  }
  function reply<T>(ack:((r:Ack<T>)=>void)|undefined,action:()=>Ack<T>):void {
   let result:Ack<T>;try {result=action();} catch {result=internal;}
   if(typeof ack==='function') ack(result);
  }
  socket.on('room:join',(p,ack)=>reply(ack,()=>{
   const parsed=identitySchema.extend({code:z.string().regex(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)}).safeParse(p);if(!parsed.success) return invalid;
   const {code,name,playerKey}=parsed.data;
   if(identity&&(identity.code!==code||identity.key!==playerKey)) return invalid;
   const previous=rooms.getRoom(code);
   const previousId=previous.ok?previous.value.players.find(p=>p.key===playerKey)?.socketId:null;
   const result=rooms.join(code,name,playerKey,socket.id);if(!result.ok) return result;
   if(previousId&&previousId!==socket.id) void io.sockets.sockets.get(previousId)?.leave(code);
   identity={code,key:playerKey};void socket.join(code);broadcast(code);return publicView(code);
  }));
  socket.on('game:start',(p,ack)=>reply(ack,()=>{
   const m=member();if(!m.ok) return m;
   const parsed=z.object({puzzleId:z.string().regex(/^[a-z0-9-]+$/).max(128).optional()}).strict().safeParse(p);if(!parsed.success) return invalid;
   const r=rooms.getRoom(m.value.code);if(!r.ok) return r;
   const id=parsed.data.puzzleId??repo.random({excludeNsfl:r.value.settings.excludeNsfl,excludeIds:r.value.playedIds});
   const puzzle=id?repo.getPublic(id):null;if(!puzzle) return {ok:false,code:'NOT_FOUND',msg:'没有可用题目'};
   const result=rooms.start(m.value.code,m.value.key,puzzle.id,puzzle.hintCount);
   if(result.ok) {gameIds.set(m.value.code,{round:r.value.round+1,id:randomUUID()});broadcast(m.value.code);}
   return result;
  }));
  function mutate(ack:((r:Ack)=>void)|undefined,action:(code:string,key:string)=>Ack):void {
   reply(ack,()=>{const m=member();if(!m.ok) return m;const result=action(m.value.code,m.value.key);if(result.ok) broadcast(m.value.code);return result;});
  }
  socket.on('room:settings',(p,ack)=>mutate(ack,(code,key)=>{
   const parsed=z.object({quotaMode:z.enum(['perPlayer','shared','unlimited']).optional(),quota:z.number().int().min(1).max(50).optional(),turnMode:z.enum(['free','turns']).optional(),maxGuesses:z.number().int().min(1).max(10).optional(),excludeNsfl:z.boolean().optional()}).strict().safeParse(p);
   return parsed.success?rooms.updateSettings(code,key,parsed.data):invalid;
  }));
  socket.on('hint:show',ack=>mutate(ack,(code,key)=>{
   const r=rooms.getRoom(code);if(!r.ok) return r;
   if(r.value.hostKey!==key) return {ok:false,code:'NOT_HOST',msg:'仅房主可操作'};
   if(r.value.phase!=='playing') return {ok:false,code:'BAD_PHASE',msg:'游戏尚未进行'};
   const secret=r.value.puzzleId?repo.getSecret(r.value.puzzleId):null;
   return secret?rooms.showHint(code,key,secret.hints.length):invalid;
  }));
  socket.on('game:reveal',ack=>mutate(ack,(code,key)=>rooms.reveal(code,key)));
  socket.on('rate',(p,ack)=>reply(ack,()=>{
   const m=member();if(!m.ok) return m;
   const parsed=z.object({score:z.union([z.literal(1),z.literal(0),z.literal(-1)]),funny:z.boolean()}).strict().safeParse(p);if(!parsed.success) return invalid;
   const r=rooms.getRoom(m.value.code);if(!r.ok) return r;
   if(r.value.phase!=='revealed'||!r.value.puzzleId) return {ok:false,code:'BAD_PHASE',msg:'揭晓后才能评价'};
   repo.rate(r.value.puzzleId,m.value.key,parsed.data.score,parsed.data.funny);return success;
  }));
  socket.on('room:kick',(p,ack)=>mutate(ack,(code,key)=>{
   const parsed=z.object({playerKey:z.string().min(1).max(128)}).strict().safeParse(p);if(!parsed.success) return invalid;
   const r=rooms.getRoom(code);if(!r.ok) return r;
   const target=r.value.players.find(p=>p.key===parsed.data.playerKey);
   const result=rooms.kick(code,key,parsed.data.playerKey);
   if(result.ok&&target?.socketId) {const kicked=io.sockets.sockets.get(target.socketId);kicked?.emit('room:kicked');void kicked?.leave(code);}
   return result;
  }));
  socket.on('room:leave',ack=>reply(ack,()=>{
   const m=member();if(!m.ok) return m;
   const result=rooms.leave(m.value.code,m.value.key);
   if(result.ok) {void socket.leave(m.value.code);identity=null;broadcast(m.value.code);}
   return result;
  }));
  socket.on('q:ask',(p,ack)=>reply(ack,()=>submit('question',p)));
  socket.on('guess:submit',(p,ack)=>reply(ack,()=>submit('solution',p)));
  function submit(kind:'question'|'solution',p:unknown):Ack<{id:string}> {
   const m=member();if(!m.ok) return m;
   const parsed=textSchema.safeParse(p);if(!parsed.success) return invalid;
   const {code,key}=m.value;
   if(!limiter.check(key)) return {ok:false,code:'RATE_LIMITED',msg:'判题过于频繁，请稍后再试'};
   const started=kind==='question'?rooms.beginAsk(code,key,parsed.data.text):rooms.beginGuess(code,key,parsed.data.text);
   if(!started.ok) return started;
    limiter.commit(key);
   const snapshot=rooms.getRoom(code);if(!snapshot.ok) return snapshot;
   const puzzleId=snapshot.value.puzzleId!,round=snapshot.value.round,id=started.value.id;
   broadcast(code);
   enqueue(code,async()=>{
    const current=rooms.getRoom(code);
    if(stopped||!current.ok||current.value.phase!=='playing'||current.value.round!==round) return;
    try {
     const secret=repo.getSecret(puzzleId);if(!secret) throw Error('题目不存在');
     if(kind==='question') {
      const result=await judge.judgeQuestion(secret,parsed.data.text);
      const applied=rooms.applyVerdict(code,id,result.verdict,result.confidence);
      if(!applied.ok) {
       rooms.applyVerdict(code,id,'出错',0);
      } else if(result.verdict!=='出错') {
       const latest=rooms.getRoom(code);
       if(latest.ok&&latest.value.phase==='playing'&&typeof judge.evaluateProgress==='function') {
        try {
         const progress=await judge.evaluateProgress(secret,latest.value.log);
         const check=rooms.getRoom(code);
         if(check.ok&&check.value.phase==='playing') {
          rooms.setProgress(code,progress);
         }
        } catch {}
       }
      }
     } else {
      const result=await judge.judgeSolution(secret,parsed.data.text);
      const applied=rooms.applyOutcome(code,id,result.outcome);if(!applied.ok) rooms.applyOutcome(code,id,'出错');
     }
    } catch {
     if(kind==='question') rooms.applyVerdict(code,id,'出错',0);else rooms.applyOutcome(code,id,'出错');
    }
    if(!stopped) broadcast(code);
   });
   return {ok:true,value:{id}};
  }
  socket.on('disconnect',()=>{const changed=rooms.disconnect(socket.id);if(changed.ok&&!stopped) changed.value.forEach(broadcast);});
 });
 return {broadcast,async close(){stopped=true;await Promise.all(queues.values());queues.clear();gameIds.clear();}};
}
