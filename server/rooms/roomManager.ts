// 状态机仅保存题目 ID 和提示计数；公开题面/提示由 Socket 层投影。
// 进入 revealed 只设胜者/原因，汤底由调用方查询并 setReveal。
import { DEFAULT_SETTINGS, LIMITS, type ErrorCode, type RoomView, type Settings, type QAView, type Verdict, type GuessView, type Outcome, type RevealView, type RevealReason, type ProgressView } from '../../shared/protocol.js';
import type { Result, RoomOptions, RoomState } from './types.js';
import type { RoomLobbySummary } from '../../shared/protocol.js';
import { resolveAvatar } from '../../shared/avatars.js';
export type { Result, RoomOptions, RoomState } from './types.js';
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ok=<T>(value:T):Result<T>=>({ok:true,value});
const fail=(code:ErrorCode,msg:string):Result<never>=>({ok:false,code,msg});
export class RoomManager {
 private readonly rooms=new Map<string,RoomState>();
 private readonly now:()=>number;
 private readonly random:()=>number;
 constructor(opts:RoomOptions={}) { this.now=opts.now??Date.now;this.random=opts.random??Math.random; }
 listLobby():RoomLobbySummary[] {
  return [...this.rooms.values()].reverse().flatMap(room=> {
   if(room.phase==='revealed'||!room.players.some(player=>player.online)||room.players.length>=LIMITS.maxPlayers) return [];
   return [{code:room.code,hostName:room.players.find(player=>player.key===room.hostKey)?.name??'房主',players:room.players.length,maxPlayers:LIMITS.maxPlayers,phase:room.phase}];
  }).slice(0,100);
 }
 createRoom(hostName:string,playerKey:string,avatar?:string):Result<{code:string}> {
  if(!hostName.trim()||Array.from(hostName.trim()).length>LIMITS.nameMax||!playerKey) return fail('INVALID','昵称或身份无效');
  let code='';let unique=false;
  for(let attempt=0;attempt<100;attempt++) {code=Array.from({length:6},()=>alphabet[Math.min(alphabet.length-1,Math.max(0,Math.floor(this.random()*alphabet.length)))]).join('');if(!this.rooms.has(code)){unique=true;break;}}
  if(!unique) return fail('INTERNAL','无法生成房间码');
  this.rooms.set(code,{code,phase:'lobby',hostKey:playerKey,settings:{...DEFAULT_SETTINGS},players:[{key:playerKey,name:hostName.trim(),avatar:resolveAvatar(avatar),online:false,isHost:true,asked:0,guesses:0,pending:false,socketId:null,offlineAt:this.now()}],puzzleId:null,log:[],guesses:[],hintCount:0,hintsShown:0,sharedUsed:0,turnKey:null,round:0,reveal:null,playedIds:[],winner:null,revealReason:null,offlineAt:this.now(),startedAt:null,progress:{score:0,status:'迷雾重重'}});
  return ok({code});
 }
 join(code:string,name:string,playerKey:string,socketId:string,avatar?:string):Result<RoomView> {
  const r=this.rooms.get(code);if(!r) return fail('NOT_FOUND','房间不存在');
  let p=r.players.find(p=>p.key===playerKey);
  if(!p) {
   if(r.players.length>=LIMITS.maxPlayers) return fail('ROOM_FULL','房间已满');
   const base=name.trim();if(!base||Array.from(base).length>LIMITS.nameMax||!playerKey||!socketId) return fail('INVALID','昵称或身份无效');
   let unique=base,index=2;while(r.players.some(p=>p.name===unique)) unique=`${base}(${index++})`;
   p={key:playerKey,name:unique,online:true,isHost:false,asked:0,guesses:0,pending:false,socketId,offlineAt:null};r.players.push(p);
  }
  p.avatar=resolveAvatar(avatar??p.avatar);p.online=true;p.socketId=socketId;p.offlineAt=null;r.offlineAt=null;
  if(r.phase==='playing'&&r.settings.turnMode==='turns'&&r.turnKey===null) this.advance(r);
  return this.toPublicView(code);
 }
 private host(code:string,key:string):Result<RoomState> {
  const r=this.rooms.get(code);if(!r) return fail('NOT_FOUND','房间不存在');
  if(r.hostKey!==key) return fail('NOT_HOST','仅房主可操作');return ok(r);
 }
 updateSettings(code:string,key:string,partial:Partial<Settings>):Result {
  const check=this.host(code,key);if(!check.ok) return check;const r=check.value;
  if(r.phase!=='lobby') return fail('BAD_PHASE','仅大厅可修改设置');
  const s={...r.settings,...partial};
  if(!['perPlayer','shared','unlimited'].includes(s.quotaMode)||!['free','turns'].includes(s.turnMode)||!Number.isInteger(s.quota)||s.quota<1||s.quota>50||!Number.isInteger(s.maxGuesses)||s.maxGuesses<1||s.maxGuesses>10||typeof s.excludeNsfl!=='boolean') return fail('INVALID','设置无效');
  r.settings={quotaMode:s.quotaMode,quota:s.quota,turnMode:s.turnMode,maxGuesses:s.maxGuesses,excludeNsfl:s.excludeNsfl};return ok(undefined);
 }
 start(code:string,key:string,puzzleId:string,hintCount=0):Result {
  const check=this.host(code,key);if(!check.ok) return check;const r=check.value;
  if(r.phase==='playing') return fail('BAD_PHASE','游戏正在进行');
  if(typeof puzzleId!=='string'||!puzzleId.trim()||!Number.isInteger(hintCount)||hintCount<0) return fail('INVALID','题目无效');
  // 题面不进入状态存储。
  
  r.puzzleId=puzzleId;r.hintCount=hintCount;r.hintsShown=0;r.log=[];r.guesses=[];r.sharedUsed=0;r.reveal=null;r.winner=null;r.revealReason=null;r.phase='playing';r.round++;r.startedAt=this.now();r.progress={score:0,status:'迷雾重重'};
  if(!r.playedIds.includes(puzzleId)) r.playedIds.push(puzzleId);
  for(const p of r.players) {p.asked=0;p.guesses=0;p.pending=false;}
  r.turnKey=r.settings.turnMode==='turns'?(r.players.find(p=>p.online)?.key??null):null;return ok(undefined);
 }
 private sequence=0;
 private player(code:string,key:string):Result<{r:RoomState;p:RoomState['players'][number]}> {
  const r=this.rooms.get(code);if(!r) return fail('NOT_FOUND','房间不存在');
  const p=r.players.find(p=>p.key===key&&p.online);if(!p) return fail('NOT_IN_ROOM','玩家不在房间');return ok({r,p});
 }
 private advance(r:RoomState):void {
  if(r.settings.turnMode!=='turns') return;
  const start=r.players.findIndex(p=>p.key===r.turnKey);
  for(let step=1;step<=r.players.length;step++) {const p=r.players[(start+step)%r.players.length];if(p.online&&(r.settings.quotaMode==='unlimited'||r.settings.quotaMode==='shared'||p.asked<r.settings.quota)){r.turnKey=p.key;return;}}
  r.turnKey=null;
 }
 beginAsk(code:string,key:string,text:string):Result<QAView> {
  const check=this.player(code,key);if(!check.ok) return check;const {r,p}=check.value;
  if(r.phase!=='playing') return fail('BAD_PHASE','游戏尚未进行');
  if(p.pending) return fail('PENDING','正在判定，请稍候');
  const clean=text.trim();if(!clean||Array.from(clean).length>LIMITS.questionMax) return fail('INVALID','提问需 1–120 字');
  if((r.settings.quotaMode==='perPlayer'&&p.asked>=r.settings.quota)||(r.settings.quotaMode==='shared'&&r.sharedUsed>=r.settings.quota)) return fail('QUOTA_EXCEEDED','提问额度用尽');
  if(r.settings.turnMode==='turns'&&r.turnKey!==key) return fail('NOT_YOUR_TURN','还未轮到你');
  const qa:QAView={id:`q-${++this.sequence}`,playerKey:key,playerName:p.name,avatar:p.avatar,text:clean,verdict:'判定中',at:this.now()};
  p.asked++;if(r.settings.quotaMode==='shared') r.sharedUsed++;p.pending=true;r.log.push(qa);return ok({...qa});
 }
 applyVerdict(code:string,qaId:string,verdict:Verdict,confidence:number):Result {
  const r=this.rooms.get(code);if(!r) return fail('NOT_FOUND','房间不存在');
  const qa=r.log.find(q=>q.id===qaId);if(!qa) return fail('NOT_FOUND','问题不存在');
  if(qa.verdict!=='判定中') return fail('INVALID','问题已经判定');
  if(!['是','不是','不相关','不确定','出错'].includes(verdict)||!Number.isFinite(confidence)||confidence<0||confidence>1) return fail('INVALID','判定无效');
  qa.verdict=verdict;const p=r.players.find(p=>p.key===qa.playerKey);
  if(p) {p.pending=false;if(verdict==='不确定'||verdict==='出错') p.asked=Math.max(0,p.asked-1);}
  if(r.settings.quotaMode==='shared'&&(verdict==='不确定'||verdict==='出错')) r.sharedUsed=Math.max(0,r.sharedUsed-1);
  if(r.phase==='playing'&&(r.turnKey===qa.playerKey||r.turnKey===null)) this.advance(r);this.exhausted(r);return ok(undefined);
 }
 private end(r:RoomState,reason:RevealReason,winner:string|null=null):void {r.phase='revealed';r.revealReason=reason;r.winner=winner;r.turnKey=null;r.progress={score:100,status:'真相大白'};}
 endGame(code:string,reason:RevealReason,winner:string|null=null):Result {
  const r=this.rooms.get(code);if(!r) return fail('NOT_FOUND','房间不存在');
  if(r.phase!=='playing') return fail('BAD_PHASE','游戏未在进行中');
  this.end(r,reason,winner);return ok(undefined);
 }
 private exhausted(r:RoomState):void {
  if(r.phase!=='playing'||r.log.some(q=>q.verdict==='判定中')||r.guesses.some(g=>g.outcome==='判定中')||r.settings.quotaMode==='unlimited') return;
  const online=r.players.filter(p=>p.online);if(!online.length) return;
  const quotaDone=r.settings.quotaMode==='shared'?r.sharedUsed>=r.settings.quota:online.every(p=>p.asked>=r.settings.quota);
  if(quotaDone&&online.every(p=>p.guesses>=r.settings.maxGuesses)) this.end(r,'exhausted');
 }
 beginGuess(code:string,key:string,text:string):Result<GuessView> {
  const check=this.player(code,key);if(!check.ok) return check;const {r,p}=check.value;
  if(r.phase!=='playing') return fail('BAD_PHASE','游戏尚未进行');
  if(p.pending) return fail('PENDING','正在判定，请稍候');
  const clean=text.trim();if(!clean||Array.from(clean).length>LIMITS.guessMax) return fail('INVALID','还原需 1–400 字');
  if(p.guesses>=r.settings.maxGuesses) return fail('QUOTA_EXCEEDED','猜测次数用尽');
  const guess:GuessView={id:`g-${++this.sequence}`,playerKey:key,playerName:p.name,avatar:p.avatar,text:clean,outcome:'判定中',at:this.now()};
  p.guesses++;p.pending=true;r.guesses.push(guess);return ok({...guess});
 }
 applyOutcome(code:string,guessId:string,outcome:Outcome):Result {
  const r=this.rooms.get(code);if(!r) return fail('NOT_FOUND','房间不存在');
  const g=r.guesses.find(g=>g.id===guessId);if(!g) return fail('NOT_FOUND','猜测不存在');
  if(g.outcome!=='判定中'||!['破解成功','接近真相','还没猜对','不确定','出错'].includes(outcome)) return fail('INVALID','判定无效');
  g.outcome=outcome;const p=r.players.find(p=>p.key===g.playerKey);
  if(p) {p.pending=false;if(outcome==='不确定'||outcome==='出错') p.guesses=Math.max(0,p.guesses-1);}
  if(outcome==='破解成功'&&r.phase==='playing') this.end(r,'solved',g.playerName);else this.exhausted(r);return ok(undefined);
 }
 showHint(code:string,key:string,hintCount:number):Result {
  const check=this.host(code,key);if(!check.ok) return check;const r=check.value;
  if(r.phase!=='playing') return fail('BAD_PHASE','游戏尚未进行');
  if(!Number.isInteger(hintCount)||hintCount<0||r.hintsShown>=hintCount) return fail('INVALID','没有更多提示');
  r.hintCount=hintCount;r.hintsShown++;return ok(undefined);
 }
 reveal(code:string,key:string):Result {
  const check=this.host(code,key);if(!check.ok) return check;const r=check.value;
  if(r.phase!=='playing') return fail('BAD_PHASE','游戏尚未进行');this.end(r,'host');return ok(undefined);
 }
 setReveal(code:string,reveal:RevealView):Result {
  const r=this.rooms.get(code);if(!r) return fail('NOT_FOUND','房间不存在');
  if(r.phase!=='revealed') return fail('BAD_PHASE','尚未揭晓');
  r.reveal={bottom:reveal.bottom,hints:[...reveal.hints],winnerName:r.winner,reason:r.revealReason!};return ok(undefined);
 }
 private transfer(r:RoomState,key:string):void {r.hostKey=key;for(const p of r.players) p.isHost=p.key===key;}
 disconnect(socketId:string):Result<string[]> {
  const changed:string[]=[];
  for(const r of this.rooms.values()) {
   const p=r.players.find(p=>p.socketId===socketId);if(!p) continue;
   p.online=false;p.socketId=null;p.offlineAt=this.now();if(r.turnKey===p.key) this.advance(r);
   if(r.players.every(p=>!p.online)) r.offlineAt=this.now();this.exhausted(r);changed.push(r.code);
  }return ok(changed);
 }
 leave(code:string,key:string):Result {
  const r=this.rooms.get(code);if(!r) return fail('NOT_FOUND','房间不存在');
  const index=r.players.findIndex(p=>p.key===key);if(index<0) return fail('NOT_IN_ROOM','玩家不在房间');
  for(const qa of r.log) if(qa.playerKey===key&&qa.verdict==='判定中') {
   qa.verdict='出错';if(r.settings.quotaMode==='shared') r.sharedUsed=Math.max(0,r.sharedUsed-1);
  }
  for(const guess of r.guesses) if(guess.playerKey===key&&guess.outcome==='判定中') guess.outcome='出错';
  if(r.turnKey===key) this.advance(r);
  r.players.splice(index,1);if(!r.players.length){this.rooms.delete(code);return ok(undefined);}
  if(r.hostKey===key) this.transfer(r,(r.players.find(p=>p.online)??r.players[0]).key);
  if(r.turnKey===key) r.turnKey=null;
  if(r.players.every(p=>!p.online)&&r.offlineAt===null) r.offlineAt=this.now();this.exhausted(r);return ok(undefined);
 }
 kick(code:string,hostKey:string,targetKey:string):Result {
  const check=this.host(code,hostKey);if(!check.ok) return check;
  if(hostKey===targetKey) return fail('INVALID','不能踢出自己');return this.leave(code,targetKey);
 }
 sweep(now=this.now()):Result<{changed:string[];destroyed:string[]}> {
  const changed:string[]=[],destroyed:string[]=[];
  for(const r of this.rooms.values()) {
   if(r.offlineAt!==null&&now-r.offlineAt>=600000) {this.rooms.delete(r.code);destroyed.push(r.code);continue;}
   const host=r.players.find(p=>p.key===r.hostKey);
   if(host&&!host.online&&host.offlineAt!==null&&now-host.offlineAt>=60000) {const next=r.players.find(p=>p.online);if(next){this.transfer(r,next.key);changed.push(r.code);}}
  }return ok({changed,destroyed});
 }
 getRoom(code:string):Result<RoomState> {const r=this.rooms.get(code);return r?ok(structuredClone(r)):fail('NOT_FOUND','房间不存在');}
 setProgress(code:string,progress:ProgressView):Result {const r=this.rooms.get(code);if(!r) return fail('NOT_FOUND','房间不存在');r.progress=progress;return ok(undefined);}
 toPublicView(code:string):Result<RoomView> {
  const r=this.rooms.get(code);if(!r) return fail('NOT_FOUND','房间不存在');
  return ok(structuredClone({code:r.code,phase:r.phase,hostKey:r.hostKey,settings:r.settings,players:r.players.map(({socketId:_,offlineAt:__,...p})=>p),puzzle:null,log:r.log,guesses:r.guesses,hints:[],hintCount:r.hintCount,sharedUsed:r.sharedUsed,turnKey:r.turnKey,round:r.round,reveal:r.phase==='revealed'?r.reveal:null,progress:r.progress??{score:0,status:'迷雾重重'}}));
 }
}

