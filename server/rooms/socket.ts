import { z } from 'zod';
import type { Server } from 'socket.io';
import type { Ack, ClientToServer, ServerToClient, RoomView, DrawerSecretView } from '../../shared/protocol.js';
import { LIMITS } from '../../shared/protocol.js';
import type { AppDeps } from '../app.js';
import { identitySchema } from '../http/routes.js';
import { RateLimiter } from '../util/rateLimit.js';
import { ScoreRepo } from '../scoring/repo.js';
import { normalize, extractTargetWord } from '../jev/judge.js';
const invalid:Ack<never>={ok:false,code:'INVALID',msg:'请求参数无效'};
const absent:Ack<never>={ok:false,code:'NOT_IN_ROOM',msg:'请先加入房间'};
const internal:Ack<never>={ok:false,code:'INTERNAL',msg:'服务暂时不可用'};
const disabled:Ack<never>={ok:false,code:'INVALID',msg:'经典你画我猜不支持此功能'};
const success:Ack={ok:true,value:undefined};
const roundSchema=z.object({round:z.number().int().positive()}).strict();
const textSchema=roundSchema.extend({text:z.string().trim().min(1).max(400)}).strict();
const strokeSchema=roundSchema.extend({
 tool:z.enum(['pen','eraser','fill','line','rect','circle']),
 color:z.string().regex(/^#[0-9a-fA-F]{3,8}$/),
 size:z.number().min(LIMITS.brushSizeMin).max(LIMITS.brushSizeMax),
 points:z.array(z.object({x:z.number().min(0).max(1000),y:z.number().min(0).max(1000),p:z.number().min(0).max(1).optional()}).strict()).min(1).max(LIMITS.pointsPerStrokeMax),
}).strict();

export function attachSockets(io:Server<ClientToServer,ServerToClient>,deps:AppDeps) {
 const {rooms,repo,judge}=deps;
 const scores=new ScoreRepo(deps.db);
 const limiter=new RateLimiter();
 const strokeLimiter=new RateLimiter({minIntervalMs:0,maxPerMinute:600});
 const queues=new Map<string,Promise<void>>();
 // Private retry keys never enter room snapshots, public logs, or score storage.
 const pending=new Map<string,{norm:string;id:string;gameId:string}>();
 let stopped=false;
 function publicView(code:string):Ack<RoomView> {
  const view=rooms.toPublicView(code),state=rooms.getRoom(code);
  if(!view.ok||!state.ok) return view;
  const room=state.value;
  view.value.puzzle=room.puzzleId?repo.getPublic(room.puzzleId):null;
  const secret=room.puzzleId?repo.getSecret(room.puzzleId):null;
  if(secret) {view.value.wordCategory=secret.tags[0]||'日常词语';view.value.wordLength=Array.from(extractTargetWord(secret.bottom)).length;}
  view.value.hints=[];view.value.hintCount=0;view.value.hintAnnouncement=null;
  view.value.log=[];view.value.highlights=[];view.value.progress=null;view.value.aiGuess=null;view.value.party=null;
  view.value.players=view.value.players.map(player=>({...player,
   roundPoints:room.solvedRankings.filter(item=>item.playerKey===player.key).reduce((sum,item)=>sum+item.points,0),
   totalPoints:scores.playerPoints(player.key),
  }));
  return view;
 }
 function broadcast(code:string):void {
  const result=rooms.getRoom(code);if(!result.ok) return;
  const room=result.value;
  if(room.phase==='revealed'&&!room.reveal&&room.puzzleId) {
   const secret=repo.getSecret(room.puzzleId);
   if(secret) {
    // Record with the room's stable round UUID, including after snapshot restore.
    repo.recordGame({id:room.gameId,roomCode:code,puzzleId:room.puzzleId,startedAt:room.startedAt!,endedAt:Date.now(),outcome:room.revealReason==='solved'?'破解成功':room.revealReason!,winnerName:room.winner,log:room.guesses});
    rooms.setReveal(code,{bottom:secret.bottom,hints:[],winnerName:room.winner,reason:room.revealReason!});
    const view=publicView(code);if(view.ok&&view.value.reveal) io.to(code).emit('game:revealed',view.value.reveal);
   }
  }
  const view=publicView(code);if(view.ok) io.to(code).emit('room:state',view.value);
 }
 function enqueue(code:string,task:()=>Promise<void>):void {
  const next=(queues.get(code)??Promise.resolve()).then(task).catch(()=>{if(!stopped) io.to(code).emit('toast',{level:'error',msg:'判题服务暂时不可用'});});
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
  function mutate(ack:((r:Ack)=>void)|undefined,action:(code:string,key:string)=>Ack):void {
   reply(ack,()=>{const m=member();if(!m.ok) return m;const result=action(m.value.code,m.value.key);if(result.ok) broadcast(m.value.code);return result;});
  }
  socket.on('room:join',(p,ack)=>reply(ack,()=>{
   const parsed=identitySchema.extend({code:z.string().regex(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)}).safeParse(p);if(!parsed.success) return invalid;
   const {code,name,playerKey,avatar,device}=parsed.data;
   if(identity&&(identity.code!==code||identity.key!==playerKey)) return invalid;
   const previous=rooms.getRoom(code),previousId=previous.ok?previous.value.players.find(p=>p.key===playerKey)?.socketId:null;
   const result=rooms.join(code,name,playerKey,socket.id,avatar,device);if(!result.ok) return result;
   if(previousId&&previousId!==socket.id) void io.sockets.sockets.get(previousId)?.leave(code);
   identity={code,key:playerKey};void socket.join(code);broadcast(code);return publicView(code);
  }));
  socket.on('game:start',(p,ack)=>reply(ack,()=>{
   const m=member();if(!m.ok) return m;
   const parsed=z.object({puzzleId:z.string().regex(/^[a-z0-9A-Z-]+$/).max(128).optional()}).strict().safeParse(p);if(!parsed.success) return invalid;
   const r=rooms.getRoom(m.value.code);if(!r.ok) return r;
   const id=parsed.data.puzzleId??repo.random({excludeNsfl:r.value.settings.excludeNsfl,excludeIds:r.value.playedIds})??repo.random({excludeNsfl:r.value.settings.excludeNsfl,excludeIds:[]});
   const puzzle=id?repo.getPublic(id):null;if(!puzzle) return {ok:false,code:'NOT_FOUND',msg:'没有可用词条'};
   const result=rooms.startClassic(m.value.code,m.value.key,puzzle.id);
   if(result.ok) broadcast(m.value.code);return result;
  }));
  socket.on('room:settings',(p,ack)=>mutate(ack,(code,key)=>{
   const parsed=z.object({turnSeconds:z.number().int().min(LIMITS.turnSecondsMin).max(LIMITS.turnSecondsMax).optional(),excludeNsfl:z.boolean().optional(),partyMode:z.literal('classic').optional()}).strict().safeParse(p);
   return parsed.success?rooms.updateSettings(code,key,{...parsed.data,partyMode:'classic',turnMode:'free'}):invalid;
  }));
  socket.on('canvas:stroke',(p,ack)=>reply(ack,()=>{
   const m=member();if(!m.ok) return m;
   const parsed=strokeSchema.safeParse(p);if(!parsed.success) return invalid;
   if(!strokeLimiter.check(m.value.key)) return {ok:false,code:'RATE_LIMITED',msg:'画笔同步过于频繁，请稍候'};
   const result=rooms.addStroke(m.value.code,m.value.key,parsed.data);
   if(result.ok) {strokeLimiter.commit(m.value.key);broadcast(m.value.code);}return result;
  }));
  socket.on('canvas:undo',(p,ack)=>mutate(ack,(code,key)=>{const parsed=roundSchema.safeParse(p);return parsed.success?rooms.undoStroke(code,key,parsed.data.round):invalid;}));
  socket.on('canvas:clear',(p,ack)=>mutate(ack,(code,key)=>{const parsed=roundSchema.safeParse(p);return parsed.success?rooms.clearCanvas(code,key,parsed.data.round):invalid;}));
  socket.on('drawer:word',ack=>reply(ack,():Ack<DrawerSecretView>=>{
   const m=member();if(!m.ok) return m;
   const r=rooms.getRoom(m.value.code);if(!r.ok) return r;
   if(r.value.phase!=='playing'||!r.value.puzzleId) return {ok:false,code:'BAD_PHASE',msg:'对局尚未开始'};
   if(r.value.drawerKey!==m.value.key) return {ok:false,code:'NOT_YOUR_TURN',msg:'仅当前画手可查看题词'};
   const secret=repo.getSecret(r.value.puzzleId);if(!secret) return {ok:false,code:'NOT_FOUND',msg:'词条不存在'};
   rooms.markSecretHolder(m.value.code,m.value.key);
   return {ok:true,value:{word:extractTargetWord(secret.bottom),category:secret.tags[0]||'日常词语',hints:[],role:'drawer',roleHint:'用画笔表达，不要直接写出答案。'}};
  }));
  // Retired endpoints fail explicitly; no fake compatibility or hidden judging.
  socket.on('q:ask',(_p,ack)=>reply(ack,()=>disabled));
  socket.on('hint:show',ack=>reply(ack,()=>disabled));
  socket.on('surface:highlight',(_p,ack)=>reply(ack,()=>disabled));
  socket.on('surface:unhighlight',(_p,ack)=>reply(ack,()=>disabled));
  socket.on('canvas:ai-guess',(_p,ack)=>reply(ack,()=>disabled));
  socket.on('canvas:next-frame',(_p,ack)=>reply(ack,()=>disabled));
  socket.on('party:bluff',(_p,ack)=>reply(ack,()=>disabled));
  socket.on('party:vote',(_p,ack)=>reply(ack,()=>disabled));
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
   const target=r.value.players.find(p=>p.key===parsed.data.playerKey),result=rooms.kick(code,key,parsed.data.playerKey);
   if(result.ok&&target?.socketId) {const kicked=io.sockets.sockets.get(target.socketId);kicked?.emit('room:kicked');void kicked?.leave(code);}return result;
  }));
  socket.on('room:leave',ack=>reply(ack,()=>{
   const m=member();if(!m.ok) return m;
   const result=rooms.leave(m.value.code,m.value.key);
   if(result.ok) {void socket.leave(m.value.code);identity=null;broadcast(m.value.code);}return result;
  }));
  socket.on('guess:submit',(p,ack)=>reply(ack,()=>{
   const m=member();if(!m.ok) return m;
   const parsed=textSchema.safeParse(p);if(!parsed.success) return invalid;
   const {code,key}=m.value,before=rooms.getRoom(code);if(!before.ok) return before;
   if(before.value.round!==parsed.data.round) return invalid;
   const retryKey=JSON.stringify([code,key]),norm=normalize(parsed.data.text),prior=pending.get(retryKey);
   if(prior&&prior.gameId===before.value.gameId&&prior.norm===norm) return {ok:true,value:{id:prior.id}};
   if(!limiter.check(key)) return {ok:false,code:'RATE_LIMITED',msg:'猜词过于频繁，请稍后再试'};
   const started=rooms.beginGuess(code,key,parsed.data.text,parsed.data.round);if(!started.ok) return started;
   limiter.commit(key);
   const {id}=started.value,{puzzleId,round,gameId}=before.value;
   pending.set(retryKey,{norm,id,gameId});broadcast(code);
   enqueue(code,async()=>{
    const currentPending=()=>{const current=rooms.getRoom(code);return current.ok&&current.value.phase==='playing'&&current.value.round===round&&current.value.gameId===gameId&&current.value.guesses.some(g=>g.id===id&&g.outcome==='判定中')?current.value:null;};
    try {
     if(stopped||!currentPending()) return;
     const secret=puzzleId?repo.getSecret(puzzleId):null;if(!secret) throw Error('Missing word');
     const result=await judge.judgeSolution(secret,parsed.data.text);
     // Mandatory post-await guard: reveal/start/leave/kick may invalidate the task.
     const latest=currentPending();if(stopped||!latest) return;
     const validConfidence=Number.isFinite(result.confidence)&&result.confidence>=deps.config.solveThreshold&&result.confidence<=1;
     const outcome=(!Number.isFinite(result.confidence)||result.confidence<deps.config.judgeThreshold||result.confidence>1||(result.outcome==='破解成功'&&!validConfidence))?'不确定':result.outcome;
     let credited={solverPoints:0,drawerPoints:0};
     if(outcome==='破解成功') {
      const points=rooms.guessPoints(code,id),solver=latest.players.find(player=>player.key===key),drawer=latest.players.find(player=>player.key===latest.drawerKey);
      if(points&&solver) {
       try {credited=scores.awardRound({roomCode:code,gameId,round,solver,drawer,points});}
       catch {io.to(code).emit('toast',{level:'error',msg:'本次积分保存失败，未计入积分'});}
      }
     }
     const applied=rooms.applyOutcome(code,id,outcome,credited);
     if(!applied.ok) rooms.applyOutcome(code,id,'出错');
    } catch {if(currentPending()) rooms.applyOutcome(code,id,'出错');}
    finally {if(pending.get(retryKey)?.id===id) pending.delete(retryKey);if(!stopped) broadcast(code);}
   });
   return {ok:true,value:{id}};
  }));
  socket.on('disconnect',()=>{const changed=rooms.disconnect(socket.id);if(changed.ok&&!stopped) changed.value.forEach(broadcast);});
 });
 return {broadcast,async close(){stopped=true;await Promise.all(queues.values());queues.clear();pending.clear();}};
}
