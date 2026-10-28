import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Server } from 'socket.io';
import type { Ack, ClientToServer, ServerToClient, RoomView, AiCanvasGuess, DrawerSecretView } from '../../shared/protocol.js';
import { LIMITS, PARTY_MODES } from '../../shared/protocol.js';
import type { AppDeps } from '../app.js';
import { identitySchema } from '../http/routes.js';
import { RateLimiter } from '../util/rateLimit.js';
import { ScoreRepo } from '../scoring/repo.js';
import { normalize, extractTargetWord } from '../jev/judge.js';
const invalid:Ack<never>={ok:false,code:'INVALID',msg:'请求参数无效'};
const absent:Ack<never>={ok:false,code:'NOT_IN_ROOM',msg:'请先加入房间'};
const internal:Ack<never>={ok:false,code:'INTERNAL',msg:'服务暂时不可用'};
const success:Ack={ok:true,value:undefined};
const textSchema=z.object({text:z.string().trim().min(1).max(400)}).strict();
const strokeSchema=z.object({
 round:z.number().int().positive().optional(),
 tool:z.enum(['pen','eraser','fill','line','rect','circle']),
 color:z.string().regex(/^#[0-9a-fA-F]{3,8}$/),
 size:z.number().min(LIMITS.brushSizeMin).max(LIMITS.brushSizeMax),
 points:z.array(z.object({x:z.number().min(0).max(1000),y:z.number().min(0).max(1000),p:z.number().min(0).max(1).optional()}).strict()).min(1).max(LIMITS.pointsPerStrokeMax),
 frameIndex:z.number().int().min(0).max(20).optional(),
 quadrant:z.union([z.literal(0),z.literal(1),z.literal(2),z.literal(3)]).optional(),
 sabotage:z.boolean().optional(),
}).strict();
export function attachSockets(io:Server<ClientToServer,ServerToClient>,deps:AppDeps) {
 const {rooms,repo,judge}=deps;
 const scores=new ScoreRepo(deps.db);
 const limiter=new RateLimiter();
 const highlightLimiter=new RateLimiter({minIntervalMs:0,maxPerMinute:120});
 const strokeLimiter=new RateLimiter({minIntervalMs:0,maxPerMinute:600});
 const queues=new Map<string,Promise<void>>();
 const gameIds=new Map<string,{round:number;id:string}>();
 let stopped=false;
 function publicView(code:string):Ack<RoomView> {
  const view=rooms.toPublicView(code), state=rooms.getRoom(code);
  if(!view.ok||!state.ok) return view;
  const room=state.value;
  view.value.puzzle=room.puzzleId?repo.getPublic(room.puzzleId):null;
  if(room.puzzleId&&room.hintsShown>0) view.value.hints=(repo.getSecret(room.puzzleId)?.hints??[]).slice(0,room.hintsShown);
  view.value.players=view.value.players.map(player=>({
   ...player,
   roundPoints:room.log.filter(q=>q.playerKey===player.key).reduce((total,q)=>total+(q.points??0),0)
    + room.solvedRankings.filter(s=>s.playerKey===player.key).reduce((total,s)=>total+s.points,0)
    + room.bluffs.filter(b=>b.playerKey===player.key).reduce((total,b)=>total+b.votes.length*2,0)
    + room.accusedVotes.filter(v=>v.voterKey===player.key&&v.suspectKey===room.saboteurKey).length*3,
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
   const {code,name,playerKey,avatar,device}=parsed.data;
   if(identity&&(identity.code!==code||identity.key!==playerKey)) return invalid;
   const previous=rooms.getRoom(code);
   const previousId=previous.ok?previous.value.players.find(p=>p.key===playerKey)?.socketId:null;
   const result=rooms.join(code,name,playerKey,socket.id,avatar,device);if(!result.ok) return result;
   if(previousId&&previousId!==socket.id) void io.sockets.sockets.get(previousId)?.leave(code);
   identity={code,key:playerKey};void socket.join(code);broadcast(code);return publicView(code);
  }));
  socket.on('game:start',(p,ack)=>reply(ack,()=>{
   const m=member();if(!m.ok) return m;
   const parsed=z.object({puzzleId:z.string().regex(/^[a-z0-9A-Z-]+$/).max(128).optional()}).strict().safeParse(p);if(!parsed.success) return invalid;
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
   const parsed=z.object({
    quotaMode:z.enum(['perPlayer','shared','unlimited']).optional(),
    quota:z.number().int().min(1).max(50).optional(),
    turnMode:z.enum(['free','turns']).optional(),
    turnSeconds:z.number().int().min(LIMITS.turnSecondsMin).max(LIMITS.turnSecondsMax).optional(),
    maxGuesses:z.number().int().min(1).max(10).optional(),
    excludeNsfl:z.boolean().optional(),
    partyMode:z.enum(PARTY_MODES as unknown as [string,...string[]]).optional(),
   }).strict().safeParse(p);
   return parsed.success?rooms.updateSettings(code,key,parsed.data as Partial<RoomView['settings']>):invalid;
  }));
  socket.on('canvas:stroke',(p,ack)=>reply(ack,()=>{
   const m=member();if(!m.ok) return m;
   const parsed=strokeSchema.safeParse(p);if(!parsed.success) return invalid;
   if(!strokeLimiter.check(m.value.key)) return {ok:false,code:'RATE_LIMITED',msg:'画笔同步过于频繁，请稍候'};
   const result=rooms.addStroke(m.value.code,m.value.key,parsed.data);
   if(result.ok) {strokeLimiter.commit(m.value.key);broadcast(m.value.code);}
   return result;
  }));
  socket.on('canvas:undo',(p,ack)=>mutate(ack,(code,key)=>{
   const parsed=z.object({round:z.number().int().positive().optional()}).strict().safeParse(p??{});if(!parsed.success) return invalid;
   return rooms.undoStroke(code,key,parsed.data.round);
  }));
  socket.on('canvas:clear',(p,ack)=>mutate(ack,(code,key)=>{
   const parsed=z.object({round:z.number().int().positive().optional()}).strict().safeParse(p??{});if(!parsed.success) return invalid;
   return rooms.clearCanvas(code,key,parsed.data.round);
  }));
  socket.on('canvas:next-frame',(p,ack)=>mutate(ack,(code,key)=>{
   const parsed=z.object({round:z.number().int().positive().optional()}).strict().safeParse(p??{});if(!parsed.success) return invalid;
   return rooms.advanceFrame(code,key,parsed.data.round);
  }));
  socket.on('party:bluff',(p,ack)=>mutate(ack,(code,key)=>{
   const parsed=z.object({text:z.string().trim().min(1).max(40)}).strict().safeParse(p);if(!parsed.success) return invalid;
   return rooms.submitBluff(code,key,parsed.data.text);
  }));
  socket.on('party:vote',(p,ack)=>mutate(ack,(code,key)=>{
   const parsed=z.object({targetId:z.string().trim().min(1).max(128)}).strict().safeParse(p);if(!parsed.success) return invalid;
   return rooms.submitPartyVote(code,key,parsed.data.targetId);
  }));
  socket.on('drawer:word',ack=>reply(ack,():Ack<DrawerSecretView>=>{
   const m=member();if(!m.ok) return m;
   const r=rooms.getRoom(m.value.code);if(!r.ok) return r;
   if(r.value.phase!=='playing'||!r.value.puzzleId) return {ok:false,code:'BAD_PHASE',msg:'对局尚未开始'};
   const mode=r.value.settings.partyMode??'classic';
   const isDrawer=r.value.drawerKey===m.value.key;
   const isSaboteur=r.value.saboteurKey===m.value.key;
   const isWitness=r.value.witnessKey===m.value.key;
   const canSeeWord=isDrawer||isSaboteur||isWitness||mode==='doodle-puzzle'||mode==='pictomania';
   if(!canSeeWord&&r.value.hostKey!==m.value.key) return {ok:false,code:'NOT_YOUR_TURN',msg:'仅当前画手或特定身份可查看机密题词'};
   const secret=repo.getSecret(r.value.puzzleId);if(!secret) return {ok:false,code:'NOT_FOUND',msg:'题目不存在'};
   const role=isSaboteur?'saboteur':isWitness?'witness':isDrawer?'drawer':'guesser';
   const roleHint=isSaboteur
    ?'你是【坏坏（内鬼）】！请画局部并开启「内鬼破坏笔触」暗中添改误导线条，别被抓到！'
    :isWitness
     ?'你是【目击者】！请在20秒内记住下方异兽的3大特征并口述给全体画像师！'
     :mode==='doodle-puzzle'
      ?'你是【画画（好人）】！请只在你负责的象限画出物体局部，严禁画完整物体！'
      :'你是本轮【灵魂画手】！请用画笔勾勒特征，切勿直接写字！';
   return {
    ok:true,
    value:{
     word:extractTargetWord(secret.bottom),
     category:secret.tags[1]||secret.tags[0]||'综合词库',
     hints:secret.hints,
     role,
     roleHint,
    },
   };
  }));
  socket.on('canvas:ai-guess',(p,ack)=>{
   const m=member();if(!m.ok) {if(typeof ack==='function') ack(m);return;}
   const parsed=z.object({snapshotDataUrl:z.string().max(4_000_000).optional()}).strict().safeParse(p??{});
   if(!parsed.success) {if(typeof ack==='function') ack(invalid);return;}
   const {code}=m.value;
   const state=rooms.getRoom(code);
   if(!state.ok||state.value.phase!=='playing'||!state.value.puzzleId) {
    if(typeof ack==='function') ack({ok:false,code:'BAD_PHASE',msg:'对局尚未开始'});
    return;
   }
   const puzzleId=state.value.puzzleId,round=state.value.round,strokes=state.value.strokes;
   enqueue(code,async()=>{
    try {
     const secret=repo.getSecret(puzzleId);if(!secret) throw Error('题目不存在');
     const guess:AiCanvasGuess=typeof judge.recognizeCanvas==='function'
      ? await judge.recognizeCanvas(secret,strokes,parsed.data.snapshotDataUrl)
      : {guess:`疑似「${secret.tags[0]||'佳作'}」`,comment:'JEV 多模态鉴画官：线条很有神韵，继续保持！',confidence:0.8,similarity:68,multimodal:!!parsed.data.snapshotDataUrl,at:Date.now()};
     const latest=rooms.getRoom(code);
     if(latest.ok&&latest.value.phase==='playing'&&latest.value.round===round) {
      rooms.setAiGuess(code,guess);
      if(!stopped) broadcast(code);
     }
     if(typeof ack==='function') ack({ok:true,value:guess});
    } catch {
     if(typeof ack==='function') ack(internal);
    }
   });
  });
  socket.on('surface:highlight',(p,ack)=>mutate(ack,(code,key)=>{
   const parsed=z.object({round:z.number().int().positive(),start:z.number().int().nonnegative(),end:z.number().int().positive()}).strict().safeParse(p);if(!parsed.success) return invalid;
   if(!highlightLimiter.check(key)) return {ok:false,code:'RATE_LIMITED',msg:'标记过于频繁，请稍后再试'};
   const state=rooms.getRoom(code);if(!state.ok) return state;
   const surface=state.value.puzzleId?repo.getPublic(state.value.puzzleId)?.surface:undefined;if(surface===undefined) return invalid;
   const splitsPair=(offset:number)=>offset>0&&offset<surface.length&&/[\uD800-\uDBFF]/.test(surface[offset-1]!)&&/[\uDC00-\uDFFF]/.test(surface[offset]!);
   if(splitsPair(parsed.data.start)||splitsPair(parsed.data.end)) return invalid;
   const result=rooms.addHighlight(code,key,parsed.data,surface.length);if(result.ok) highlightLimiter.commit(key);return result;
  }));
  socket.on('surface:unhighlight',(p,ack)=>mutate(ack,(code,key)=>{
   const parsed=z.object({round:z.number().int().positive(),id:z.string().min(1).max(128)}).strict().safeParse(p);if(!parsed.success) return invalid;
   if(!highlightLimiter.check(key)) return {ok:false,code:'RATE_LIMITED',msg:'标记过于频繁，请稍后再试'};
   const result=rooms.removeHighlight(code,key,parsed.data);if(result.ok) highlightLimiter.commit(key);return result;
  }));
  socket.on('hint:show',ack=>mutate(ack,(code,key)=>{
   const r=rooms.getRoom(code);if(!r.ok) return r;
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
   rooms.expireTurns().forEach(broadcast);
   const norm=normalize(parsed.data.text);
   const before=rooms.getRoom(code);
   let submittedText=parsed.data.text;
   if(before.ok&&before.value.phase==='playing'&&before.value.puzzleId) {
    const secret=repo.getSecret(before.value.puzzleId);
    if(secret) {
     const targetNorm=normalize(extractTargetWord(secret.bottom));
     if(kind==='solution'&&targetNorm&&(norm===targetNorm||norm===normalize(secret.bottom))) {
      submittedText=`🎉 猜中了机密答案（${extractTargetWord(secret.bottom).length}个字）`;
     } else if(kind==='question'&&targetNorm&&norm.includes(targetNorm)&&targetNorm.length>=2) {
      submittedText=parsed.data.text.replace(new RegExp(extractTargetWord(secret.bottom),'gi'),'***');
     }
    }
    if(kind==='question') {
     const existingPending=before.value.log.find(item=>item.playerKey===key&&item.verdict==='判定中'&&normalize(item.text)===norm);
     if(existingPending) return {ok:true,value:{id:existingPending.id}};
     const duplicate=before.value.log.find(item=>item.verdict!=='不确定'&&item.verdict!=='出错'&&normalize(item.text)===norm);
     if(duplicate) return {ok:false,code:'INVALID',msg:duplicate.verdict==='判定中'?'该问题正在判定中，请勿重复发送':`该问题本局已提问过（判定：${duplicate.verdict}），请勿重复发送`};
    } else {
     const existingPending=before.value.guesses.find(item=>item.playerKey===key&&item.outcome==='判定中'&&normalize(item.text)===norm);
     if(existingPending) return {ok:true,value:{id:existingPending.id}};
     const duplicate=before.value.guesses.find(item=>item.outcome!=='不确定'&&item.outcome!=='出错'&&normalize(item.text)===norm);
     if(duplicate) return {ok:false,code:'INVALID',msg:duplicate.outcome==='判定中'?'该还原内容正在判定中，请勿重复发送':`该还原内容本局已提交过（结果：${duplicate.outcome}），请勿重复发送`};
    }
   }
   if(!limiter.check(key)) return {ok:false,code:'RATE_LIMITED',msg:'判题过于频繁，请稍后再试'};
   const started=kind==='question'?rooms.beginAsk(code,key,submittedText):rooms.beginGuess(code,key,submittedText);
   if(!started.ok) return started;
   limiter.commit(key);
   const snapshot=rooms.getRoom(code);if(!snapshot.ok) return snapshot;
   const puzzleId=snapshot.value.puzzleId!,round=snapshot.value.round,id=started.value.id;
   const awardId=`${gameIds.get(code)?.id??randomUUID()}:${id}`;
   broadcast(code);
   enqueue(code,async()=>{
    const current=rooms.getRoom(code);
    if(stopped||!current.ok||current.value.phase!=='playing'||current.value.round!==round) return;
    const stillPending=kind==='question'
     ?current.value.log.some(item=>item.id===id&&item.verdict==='判定中')
     :current.value.guesses.some(item=>item.id===id&&item.outcome==='判定中');
    if(!stillPending) return;
    try {
     const secret=repo.getSecret(puzzleId);if(!secret) throw Error('题目不存在');
     if(kind==='question') {
      const result=await judge.judgeQuestion(secret,parsed.data.text);
      const applied=rooms.applyVerdict(code,id,result.verdict,result.confidence);
      if(applied.ok) {
       const scored=rooms.getRoom(code),q=scored.ok&&scored.value.round===round?scored.value.log.find(item=>item.id===id):undefined;
       if(q) {
        const proximity=q.verdict==='不相关'?0:result.proximity;
        let points=0;let assessed:number|undefined;
        if(['是','不是','不相关'].includes(q.verdict)&&result.confidence>=deps.config.judgeThreshold&&typeof proximity==='number'&&Number.isFinite(proximity)&&proximity>=0&&proximity<=100) {
         assessed=Math.round(proximity);
         try {points=scores.award({id:awardId,playerKey:q.playerKey,name:q.playerName,avatar:q.avatar,puzzleId,normText:normalize(parsed.data.text),proximity:assessed});}
         catch {io.to(code).emit('toast',{level:'error',msg:'本次积分保存失败，判题结果仍有效'});}
        }
        rooms.setQuestionScore(code,id,assessed,points);
       }
      }
      if(applied.ok&&!stopped) broadcast(code);
      if(!applied.ok) {
       rooms.applyVerdict(code,id,'出错',0);
      } else if(result.verdict!=='出错') {
       const latest=rooms.getRoom(code);
       if(latest.ok&&latest.value.phase==='playing'&&latest.value.round===round&&typeof judge.evaluateProgress==='function') {
        try {
         const progress=await judge.evaluateProgress(secret,latest.value.log);
         const check=rooms.getRoom(code);
         if(check.ok&&check.value.phase==='playing'&&check.value.round===round) {
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
 const turnTimer=setInterval(()=>{if(!stopped) rooms.expireTurns().forEach(broadcast);},250);
 turnTimer.unref();
 return {broadcast,async close(){stopped=true;clearInterval(turnTimer);await Promise.all(queues.values());queues.clear();gameIds.clear();}};
}
