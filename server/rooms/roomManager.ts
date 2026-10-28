// 状态机仅保存题目 ID 和提示计数；公开题面/提示由 Socket 层投影。
// 进入 revealed 只设胜者/原因，汤底由调用方查询并 setReveal。
import { randomUUID } from 'node:crypto';
import { correctGuessPoints, DRAWER_COOPERATIVE_POINTS } from '../scoring/core.js';
import { DEFAULT_SETTINGS, LIMITS, PARTY_MODES } from '../../shared/protocol.js';
import type {
 ErrorCode, RoomView, Settings, QAView, Verdict, GuessView, Outcome, RevealView, RevealReason,
 ProgressView, RoomLobbySummary, HighlightRequest, RemoveHighlightRequest, StrokeInput,
 CanvasStroke, DrawPoint, AiCanvasGuess, DeviceInfo, PartyMode, PartyStateView, DrawfulChoiceView,
} from '../../shared/protocol.js';
import type { Result, RoomOptions, RoomState } from './types.js';
import { resolveAvatar } from '../../shared/avatars.js';
export type { Result, RoomOptions, RoomState } from './types.js';
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ok=<T>(value:T):Result<T>=>({ok:true,value});
const fail=(code:ErrorCode,msg:string):Result<never>=>({ok:false,code,msg});

const PICTOMANIA_POOLS: readonly (readonly string[])[] = [
 ['大熊猫','北极熊','棕熊','浣熊','考拉','袋鼠','树懒','刺猬','河豚','企鹅','猫头鹰','长颈鹿','火烈鸟','变色龙','章鱼','哈士奇'],
 ['珍珠奶茶','鸳鸯火锅','冰糖葫芦','榴莲比萨','荷包蛋','生日蛋糕','旋转寿司','臭豆腐','棉花糖','烤羊肉串','小笼包','甜筒冰淇淋','方便面','北京烤鸭','螺蛳粉','铜锣烧'],
 ['画蛇添足','守株待兔','对牛弹琴','井底之蛙','掩耳盗铃','亡羊补牢','狐假虎威','盲人摸象','鸡飞狗跳','一心二用','水中捞月','拔苗助长','乌鸦喝水','三头六臂','眉开眼笑','画饼充饥'],
] as const;

const MODE_STAGE_DESC: Record<PartyMode, string> = {
 'classic': '经典你画我猜：画手根据机密词条作画，猜词玩家实时输入答案或特征提问，支持 AI 看画点评！',
 'drawful': '《Drawful》妙笔生谎：画手画出奇葩题目，全员编造以假乱真的假答案骗取选票，骗票 +2 分！',
 'doodle-puzzle': '《猜拆画画》拼图内鬼：四人分块合作画局部，内鬼「坏坏」暗中擦改破坏，既要猜词也要揪出内鬼！',
 'pictomania': '《妙笔神猜》全员狂飙：桌面公开 16 个近似干扰词，所有人边画边抢答，越早猜中得分越高！',
 'monsdrawsity': '《MonsDRAWsity》怪兽目击：目击者限时 20 秒观察猎奇异兽并口述特征，全员扮演警方画像师还原！',
 'secret-ink': 'Gartic 隐形墨水：画手落笔 2 秒后线条自动隐形消失，全凭空间记忆盲画，揭晓时刻全显！',
 'knock-off': 'Gartic 高仿山寨：60秒 ➔ 30秒 ➔ 15秒 ➔ 8秒极限接力临摹，见证名画如何一步步退化成火柴人！',
 'complement': 'Gartic 残缺补全：画板上自带神秘残缺初始笔画，请脑洞大开将其合理化补全为一幅完整作品！',
 'sandwich': 'Gartic 三明治传声筒：写词 ➔ 连续多帧看画重画畸变 ➔ 最终猜词，画面畸变快乐翻倍！',
 'animation': 'Gartic 逐帧动画：每一帧只看上一帧半透明洋葱皮残影，多人接力完成后自动 5fps 循环连播！',
};

function sanitizeDevice(device?: DeviceInfo): DeviceInfo | undefined {
 if (!device || typeof device !== 'object') return undefined;
 const kind = ['desktop', 'tablet', 'mobile', 'stylus'].includes(device.kind) ? device.kind : 'desktop';
 const os = typeof device.os === 'string' && device.os.trim() ? device.os.trim().slice(0, 32) : 'Web';
 const browser = typeof device.browser === 'string' && device.browser.trim() ? device.browser.trim().slice(0, 32) : 'Browser';
 const label = typeof device.label === 'string' && device.label.trim() ? device.label.trim().slice(0, 64) : `${os} · ${browser}`;
 return { kind, os, browser, label };
}

function buildComplementStarterStrokes(round: number, now: number): CanvasStroke[] {
 const templates: DrawPoint[][] = [
  [{ x: 260, y: 520, p: 0.6 }, { x: 320, y: 360, p: 0.7 }, { x: 480, y: 340, p: 0.7 }, { x: 540, y: 520, p: 0.6 }],
  [{ x: 340, y: 300, p: 0.6 }, { x: 660, y: 300, p: 0.6 }, { x: 500, y: 640, p: 0.7 }, { x: 340, y: 300, p: 0.6 }],
  [{ x: 240, y: 460, p: 0.6 }, { x: 400, y: 320, p: 0.7 }, { x: 580, y: 600, p: 0.7 }, { x: 740, y: 420, p: 0.6 }],
 ];
 const pts = templates[round % templates.length]!;
 return [{
  id: `stroke-starter-${round}`,
  tool: 'pen',
  color: '#7955c7',
  size: 10,
  points: pts,
  playerKey: 'system',
  playerName: '残缺初始线',
  at: now,
  frameIndex: 0,
 }];
}

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
 createRoom(hostName:string,playerKey:string,avatar?:string,device?:DeviceInfo):Result<{code:string}> {
  if(!hostName.trim()||Array.from(hostName.trim()).length>LIMITS.nameMax||!playerKey) return fail('INVALID','昵称或身份无效');
  let code='';let unique=false;
  for(let attempt=0;attempt<100;attempt++) {code=Array.from({length:6},()=>alphabet[Math.min(alphabet.length-1,Math.max(0,Math.floor(this.random()*alphabet.length)))]).join('');if(!this.rooms.has(code)){unique=true;break;}}
  if(!unique) return fail('INTERNAL','无法生成房间码');
  const dev=sanitizeDevice(device);
  this.rooms.set(code,{
   code,phase:'lobby',hostKey:playerKey,settings:{...DEFAULT_SETTINGS},
   players:[{key:playerKey,name:hostName.trim(),avatar:resolveAvatar(avatar),...(dev?{device:dev}:{}),online:false,isHost:true,asked:0,guesses:0,pending:false,socketId:null,offlineAt:this.now()}],
   puzzleId:null,log:[],guesses:[],highlights:[],hintCount:0,hintsShown:0,sharedUsed:0,turnKey:null,turnDeadline:null,turnRemainingMs:null,serverNow:this.now(),round:0,reveal:null,playedIds:[],winner:null,revealReason:null,offlineAt:this.now(),startedAt:null,gameId:randomUUID(),secretHolderKeys:[],progress:{score:0,status:'迷雾重重'},
   drawerKey:playerKey,strokes:[],aiGuess:null,
   bluffs:[],truthVotes:[],saboteurKey:null,sabotagedQuadrant:null,accusedVotes:[],candidateWords:[],solvedRankings:[],witnessKey:null,memoryDeadline:null,bestArtistVotes:{},currentFrame:0,totalFrames:4,
  });
  return ok({code});
 }
 join(code:string,name:string,playerKey:string,socketId:string,avatar?:string,device?:DeviceInfo):Result<RoomView> {
  const r=this.rooms.get(code);if(!r) return fail('NOT_FOUND','房间不存在');
  let p=r.players.find(p=>p.key===playerKey);
  if(!p) {
   if(r.players.length>=LIMITS.maxPlayers) return fail('ROOM_FULL','房间已满');
   const base=name.trim();if(!base||Array.from(base).length>LIMITS.nameMax||!playerKey||!socketId) return fail('INVALID','昵称或身份无效');
   let unique=base,index=2;while(r.players.some(p=>p.name===unique)) unique=`${base}(${index++})`;
   p={key:playerKey,name:unique,online:true,isHost:false,asked:0,guesses:0,pending:false,socketId,offlineAt:null};r.players.push(p);
  }
  p.avatar=resolveAvatar(avatar??p.avatar);
  const dev=sanitizeDevice(device);if(dev) p.device=dev;
  p.online=true;p.socketId=socketId;p.offlineAt=null;r.offlineAt=null;
  if(r.phase==='playing'&&r.settings.turnMode==='turns'&&r.turnKey===null) this.advance(r);
  if(r.phase==='playing'&&!r.drawerKey) r.drawerKey=p.key;
  return this.toPublicView(code);
 }
 private host(code:string,key:string):Result<RoomState> {
  const r=this.rooms.get(code);if(!r) return fail('NOT_FOUND','房间不存在');
  if(r.hostKey!==key) return fail('NOT_HOST','仅房主可操作');return ok(r);
 }
 updateSettings(code:string,key:string,partial:Partial<Settings>):Result {
  const check=this.host(code,key);if(!check.ok) return check;const r=check.value;
  if(r.phase==='playing') return fail('BAD_PHASE','仅大厅可修改设置');
  const s={...r.settings,...partial};
  const validParty=s.partyMode===undefined||PARTY_MODES.includes(s.partyMode);
  if(!['perPlayer','shared','unlimited'].includes(s.quotaMode)||!['free','turns'].includes(s.turnMode)||!Number.isInteger(s.quota)||s.quota<1||s.quota>50||!Number.isInteger(s.maxGuesses)||s.maxGuesses<1||s.maxGuesses>10||typeof s.excludeNsfl!=='boolean'||!Number.isInteger(s.turnSeconds)||s.turnSeconds<LIMITS.turnSecondsMin||s.turnSeconds>LIMITS.turnSecondsMax||!validParty) return fail('INVALID','设置无效');
  r.settings={
   quotaMode:s.quotaMode,
   quota:s.quota,
   turnMode:s.turnMode,
   turnSeconds:s.turnSeconds,
   maxGuesses:s.maxGuesses,
   excludeNsfl:s.excludeNsfl,
   ...(s.partyMode?{partyMode:s.partyMode}:{}),
  };
  return ok(undefined);
 }
 startClassic(code:string,key:string,puzzleId:string):Result {
  const check=this.host(code,key);if(!check.ok) return check;const r=check.value;
  if(r.phase==='playing') return fail('BAD_PHASE','游戏正在进行');
  r.settings={...r.settings,partyMode:'classic',turnMode:'free'};
  return this.start(code,key,puzzleId,0);
 }
 start(code:string,key:string,puzzleId:string,hintCount=0):Result {
  const check=this.host(code,key);if(!check.ok) return check;const r=check.value;
  if(r.phase==='playing') return fail('BAD_PHASE','游戏正在进行');
  if(typeof puzzleId!=='string'||!puzzleId.trim()||!Number.isInteger(hintCount)||hintCount<0) return fail('INVALID','题目无效');
  const now=this.now();
  const mode:PartyMode=r.settings.partyMode??'classic';
  r.puzzleId=puzzleId;r.hintCount=hintCount;r.hintsShown=0;r.log=[];r.guesses=[];r.highlights=[];r.sharedUsed=0;r.reveal=null;r.winner=null;r.revealReason=null;r.phase='playing';r.round++;r.startedAt=now;r.gameId=randomUUID();r.secretHolderKeys=[];r.progress={score:0,status:'迷雾重重'};
  r.strokes=mode==='complement'?buildComplementStarterStrokes(r.round,now):[];
  r.aiGuess=null;
  r.bluffs=[];r.truthVotes=[];r.sabotagedQuadrant=null;r.accusedVotes=[];r.solvedRankings=[];r.bestArtistVotes={};r.currentFrame=0;r.totalFrames=Math.max(4,Math.min(6,r.players.length||4));
  const onlinePlayers=r.players.filter(p=>p.online);
  const pool=onlinePlayers.length?onlinePlayers:r.players;
  r.drawerKey=pool.length?pool[(r.round-1)%pool.length]!.key:key;
  r.secretHolderKeys=[r.drawerKey];
  if(mode==='doodle-puzzle'&&pool.length>=2) {
   r.saboteurKey=pool[r.round%pool.length]!.key;
  } else {
   r.saboteurKey=null;
  }
  if(mode==='pictomania') {
   r.candidateWords=[...PICTOMANIA_POOLS[(r.round-1)%PICTOMANIA_POOLS.length]!];
  } else {
   r.candidateWords=[];
  }
  if(mode==='monsdrawsity') {
   r.witnessKey=r.drawerKey;
   r.memoryDeadline=now+20000;
  } else {
   r.witnessKey=null;
   r.memoryDeadline=null;
  }
  if(!r.playedIds.includes(puzzleId)) r.playedIds.push(puzzleId);
  for(const p of r.players) {p.asked=0;p.guesses=0;p.pending=false;}
  r.hintAnnouncement=null;
  r.turnKey=r.settings.turnMode==='turns'?(r.players.find(p=>p.online)?.key??null):null;this.resetClock(r);return ok(undefined);
 }
 addStroke(code:string,key:string,input:StrokeInput):Result<CanvasStroke> {
  const check=this.player(code,key);if(!check.ok) return check;const {r,p}=check.value;
  if(r.phase!=='playing') return fail('BAD_PHASE','对局期间才能作画');
  if(input.round!==r.round) return fail('INVALID','轮次已切换');
  if(r.drawerKey!==key) return fail('NOT_YOUR_TURN','仅当前画手可作画');
  if(!['pen','eraser','fill','line','rect','circle'].includes(input.tool)) return fail('INVALID','画笔工具无效');
  if(typeof input.color!=='string'||!/^#[0-9a-fA-F]{3,8}$/.test(input.color)) return fail('INVALID','颜色格式无效');
  if(typeof input.size!=='number'||!Number.isFinite(input.size)||input.size<LIMITS.brushSizeMin||input.size>LIMITS.brushSizeMax) return fail('INVALID','画笔粗细无效');
  if(!Array.isArray(input.points)||input.points.length<1||input.points.length>LIMITS.pointsPerStrokeMax) return fail('INVALID','笔触坐标点无效');
  for(const pt of input.points) {
   if(typeof pt?.x!=='number'||typeof pt?.y!=='number'||!Number.isFinite(pt.x)||!Number.isFinite(pt.y)||pt.x<0||pt.x>1000||pt.y<0||pt.y>1000) return fail('INVALID','坐标超出画布范围');
  }
  if(r.strokes.length>=LIMITS.strokesMax) r.strokes.shift();
  const isSabotage=!!input.sabotage&&r.saboteurKey===key;
  if(isSabotage&&input.quadrant!==undefined) r.sabotagedQuadrant=input.quadrant;
  const stroke:CanvasStroke={
   id:`s-${++this.sequence}`,
   tool:input.tool,
   color:input.color,
   size:Math.round(input.size),
   points:input.points.map(pt=>({x:Math.round(pt.x*10)/10,y:Math.round(pt.y*10)/10,...(typeof pt.p==='number'&&Number.isFinite(pt.p)?{p:Math.max(0,Math.min(1,Math.round(pt.p*100)/100))}:{})})),
   playerKey:key,
   playerName:p.name,
   at:this.now(),
   frameIndex:input.frameIndex??r.currentFrame,
   ...(input.quadrant!==undefined?{quadrant:input.quadrant}:{}),
   ...(isSabotage?{sabotage:true}:{}),
  };
  r.strokes.push(stroke);
  const progressScore=Math.min(95,Math.max(r.progress.score,Math.min(80,r.strokes.length*8)));
  const status=progressScore>=75?'临门一脚':progressScore>=45?'渐入佳境':progressScore>=20?'初见端倪':'迷雾重重';
  r.progress={score:progressScore,status};
  return ok(structuredClone(stroke));
 }
 undoStroke(code:string,key:string,round?:number):Result {
  const check=this.player(code,key);if(!check.ok) return check;const {r}=check.value;
  if(r.phase!=='playing') return fail('BAD_PHASE','对局期间才能撤销笔触');
  if(round!==r.round) return fail('INVALID','轮次已切换');
  for(let i=r.strokes.length-1;i>=0;i--) {
   if(r.strokes[i]!.playerKey===key) {
    r.strokes.splice(i,1);
    return ok(undefined);
   }
  }
  return fail('NOT_FOUND','没有可撤销的笔触');
 }
 clearCanvas(code:string,key:string,round?:number):Result {
  const check=this.player(code,key);if(!check.ok) return check;const {r}=check.value;
  if(r.phase!=='playing') return fail('BAD_PHASE','对局期间才能清空画布');
  if(round!==r.round) return fail('INVALID','轮次已切换');
  if(key!==r.drawerKey&&key!==r.hostKey) return fail('NOT_YOUR_TURN','仅画手或房主可清空画布');
  r.strokes=[];r.aiGuess=null;
  return ok(undefined);
 }
 advanceFrame(code:string,key:string,round?:number):Result {
  const check=this.player(code,key);if(!check.ok) return check;const {r}=check.value;
  if(r.phase!=='playing') return fail('BAD_PHASE','对局期间才能推进帧');
  if(round!==r.round) return fail('INVALID','轮次已切换');
  r.currentFrame=(r.currentFrame+1)%Math.max(1,r.totalFrames);
  const online=r.players.filter(p=>p.online);
  if(online.length>1) {
   const idx=online.findIndex(p=>p.key===r.drawerKey);
   r.drawerKey=online[(idx+1)%online.length]!.key;
  }
  return ok(undefined);
 }
 submitBluff(code:string,key:string,text:string):Result {
  const check=this.player(code,key);if(!check.ok) return check;const {r,p}=check.value;
  if(r.phase!=='playing') return fail('BAD_PHASE','对局期间才能提交假答案');
  const clean=text.trim();if(!clean||Array.from(clean).length>40) return fail('INVALID','假答案需为 1–40 字');
  const existing=r.bluffs.find(b=>b.playerKey===key);
  if(existing) {existing.text=clean;} else {r.bluffs.push({id:`bluff-${++this.sequence}`,playerKey:key,playerName:p.name,text:clean,votes:[]});}
  return ok(undefined);
 }
 submitPartyVote(code:string,key:string,targetId:string):Result {
  const check=this.player(code,key);if(!check.ok) return check;const {r,p}=check.value;
  if(r.phase!=='playing') return fail('BAD_PHASE','对局期间才能投票');
  const mode=r.settings.partyMode??'classic';
  if(mode==='drawful') {
   for(const b of r.bluffs) b.votes=b.votes.filter(n=>n!==p.name);
   r.truthVotes=r.truthVotes.filter(n=>n!==p.name);
   if(targetId==='choice-truth') {
    r.truthVotes.push(p.name);
   } else {
    const bluff=r.bluffs.find(b=>b.id===targetId);
    if(!bluff) return fail('NOT_FOUND','选项不存在');
    bluff.votes.push(p.name);
   }
   return ok(undefined);
  }
  if(mode==='doodle-puzzle') {
   const suspect=r.players.find(pl=>pl.key===targetId||pl.name===targetId);
   if(!suspect) return fail('NOT_FOUND','被指认玩家不存在');
   r.accusedVotes=r.accusedVotes.filter(v=>v.voterKey!==key);
   r.accusedVotes.push({voterKey:key,voterName:p.name,suspectKey:suspect.key,suspectName:suspect.name});
   return ok(undefined);
  }
  if(mode==='monsdrawsity') {
   const artist=r.players.find(pl=>pl.key===targetId||pl.name===targetId);
   if(!artist) return fail('NOT_FOUND','画师不存在');
   r.bestArtistVotes[p.name]=artist.name;
   return ok(undefined);
  }
  return fail('INVALID','当前模式无需投票');
 }
 setAiGuess(code:string,aiGuess:AiCanvasGuess):Result {
  const r=this.rooms.get(code);if(!r) return fail('NOT_FOUND','房间不存在');
  r.aiGuess=structuredClone(aiGuess);
  return ok(undefined);
 }
 addHighlight(code:string,key:string,request:HighlightRequest,surfaceLength:number):Result {
  const check=this.player(code,key);if(!check.ok) return check;const {r,p}=check.value;
  if(r.phase!=='playing') return fail('BAD_PHASE','推理期间才能标记汤面');
  const {round,start,end}=request;
  if(round!==r.round||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<=start||end>surfaceLength||r.highlights.length>=LIMITS.highlightsMax) return fail('INVALID','高亮范围无效或标记过多');
  if(r.highlights.some(h=>start<h.end&&end>h.start)) return fail('INVALID','选中文字已包含高亮，请先取消原高亮');
  r.highlights.push({id:`h-${++this.sequence}`,start,end,playerKey:key,playerName:p.name});
  r.highlights.sort((a,b)=>a.start-b.start);return ok(undefined);
 }
 removeHighlight(code:string,key:string,request:RemoveHighlightRequest):Result {
  const check=this.player(code,key);if(!check.ok) return check;const {r}=check.value;
  if(r.phase!=='playing') return fail('BAD_PHASE','推理期间才能取消高亮');
  if(request.round!==r.round) return fail('INVALID','题目已经切换');
  const index=r.highlights.findIndex(h=>h.id===request.id);if(index<0) return fail('NOT_FOUND','高亮已取消');
  r.highlights.splice(index,1);return ok(undefined);
 }
 private sequence=0;
 private player(code:string,key:string):Result<{r:RoomState;p:RoomState['players'][number]}> {
  const r=this.rooms.get(code);if(!r) return fail('NOT_FOUND','房间不存在');
  const p=r.players.find(p=>p.key===key&&p.online);if(!p) return fail('NOT_IN_ROOM','玩家不在房间');return ok({r,p});
 }
 private judging(r:RoomState):boolean {return r.log.some(q=>q.verdict==='判定中')||r.guesses.some(g=>g.outcome==='判定中');}
 private syncClock(r:RoomState,now=this.now()):void {
  if(r.phase!=='playing'||r.settings.turnMode!=='turns'||r.turnKey===null) {r.turnDeadline=null;r.turnRemainingMs=null;return;}
  if(this.judging(r)) {
   if(r.turnDeadline!==null) {r.turnRemainingMs=Math.max(0,r.turnDeadline-now);r.turnDeadline=null;}
  } else if(r.turnRemainingMs!==null) {r.turnDeadline=now+r.turnRemainingMs;r.turnRemainingMs=null;}
 }
 private resetClock(r:RoomState,now=this.now()):void {
  r.turnDeadline=null;r.turnRemainingMs=r.settings.turnSeconds*1000;this.syncClock(r,now);
 }
 private advance(r:RoomState,now=this.now()):void {
  if(r.settings.turnMode!=='turns') return;
  const start=r.players.findIndex(p=>p.key===r.turnKey);
  for(let step=1;step<=r.players.length;step++) {
   const p=r.players[(start+step)%r.players.length]!;
   const quota=r.settings.quotaMode==='unlimited'||(r.settings.quotaMode==='shared'?r.sharedUsed<r.settings.quota:p.asked<r.settings.quota);
   if(p.online&&quota) {r.turnKey=p.key;this.resetClock(r,now);return;}
  }
  r.turnKey=null;this.resetClock(r,now);
 }
 private expireTurn(r:RoomState,now=this.now()):boolean {
  if(r.phase!=='playing'||r.settings.turnMode!=='turns'||r.turnDeadline===null||now<r.turnDeadline||this.judging(r)) return false;
  this.advance(r,now);return true;
 }
 expireTurns(now=this.now()):string[] {
  const changed:string[]=[];for(const r of this.rooms.values()) if(this.expireTurn(r,now)) changed.push(r.code);return changed;
 }
 beginAsk(code:string,key:string,text:string):Result<QAView> {
  const check=this.player(code,key);if(!check.ok) return check;const {r,p}=check.value;
  if(r.phase!=='playing') return fail('BAD_PHASE','游戏尚未进行');
  this.expireTurn(r);
  if(p.pending) return fail('PENDING','正在判定，请稍候');
  const clean=text.trim();if(!clean||Array.from(clean).length>LIMITS.questionMax) return fail('INVALID','提问需 1–120 字');
  if((r.settings.quotaMode==='perPlayer'&&p.asked>=r.settings.quota)||(r.settings.quotaMode==='shared'&&r.sharedUsed>=r.settings.quota)) return fail('QUOTA_EXCEEDED','提问额度用尽');
  if(r.settings.turnMode==='turns'&&r.turnKey!==key) return fail('NOT_YOUR_TURN','还未轮到你');
  const qa:QAView={id:`q-${++this.sequence}`,playerKey:key,playerName:p.name,avatar:p.avatar,text:clean,verdict:'判定中',at:this.now()};
  p.asked++;if(r.settings.quotaMode==='shared') r.sharedUsed++;p.pending=true;r.log.push(qa);this.syncClock(r);return ok({...qa});
 }
 applyVerdict(code:string,qaId:string,verdict:Verdict,confidence:number):Result {
  const r=this.rooms.get(code);if(!r) return fail('NOT_FOUND','房间不存在');
  const qa=r.log.find(q=>q.id===qaId);if(!qa) return fail('NOT_FOUND','问题不存在');
  if(qa.verdict!=='判定中') return fail('INVALID','问题已经判定');
  if(!['是','不是','不相关','不确定','出错'].includes(verdict)||!Number.isFinite(confidence)||confidence<0||confidence>1) return fail('INVALID','判定无效');
  qa.verdict=verdict;const p=r.players.find(p=>p.key===qa.playerKey);
  if(p) {p.pending=false;if(verdict==='不确定'||verdict==='出错') p.asked=Math.max(0,p.asked-1);}
  if(r.settings.quotaMode==='shared'&&(verdict==='不确定'||verdict==='出错')) r.sharedUsed=Math.max(0,r.sharedUsed-1);
  if(r.phase==='playing'&&(r.turnKey===qa.playerKey||r.turnKey===null)) this.advance(r);this.syncClock(r);this.exhausted(r);return ok(undefined);
 }
 private end(r:RoomState,reason:RevealReason,winner:string|null=null):void {r.phase='revealed';r.revealReason=reason;r.winner=winner;r.turnKey=null;r.progress={score:100,status:'真相大白'};this.syncClock(r);}
 endGame(code:string,reason:RevealReason,winner:string|null=null):Result {
  const r=this.rooms.get(code);if(!r) return fail('NOT_FOUND','房间不存在');
  if(r.phase!=='playing') return fail('BAD_PHASE','游戏未在进行中');
  this.end(r,reason,winner);return ok(undefined);
 }
 private exhausted(r:RoomState):void {
  if(r.phase!=='playing'||this.judging(r)||r.settings.quotaMode==='unlimited') return;
  const online=r.players.filter(p=>p.online);if(!online.length) return;
  const quotaDone=r.settings.quotaMode==='shared'?r.sharedUsed>=r.settings.quota:online.every(p=>p.asked>=r.settings.quota);
  if(quotaDone&&online.every(p=>p.guesses>=r.settings.maxGuesses)) this.end(r,'exhausted');
 }
 markSecretHolder(code:string,key:string):Result {
  const check=this.player(code,key);if(!check.ok) return check;
  if(!check.value.r.secretHolderKeys.includes(key)) check.value.r.secretHolderKeys.push(key);
  return ok(undefined);
 }
 beginGuess(code:string,key:string,text:string,round?:number):Result<GuessView> {
  const check=this.player(code,key);if(!check.ok) return check;const {r,p}=check.value;
  if(r.phase!=='playing') return fail('BAD_PHASE','游戏尚未进行');
  if(round!==undefined&&round!==r.round) return fail('INVALID','轮次已切换');
  if(r.drawerKey===key||r.secretHolderKeys.includes(key)||(r.settings.partyMode??'classic')!=='classic') return fail('NOT_YOUR_TURN','看过题词的玩家不能猜词得分');
  if(p.pending) return fail('PENDING','正在判定，请稍候');
  const clean=text.trim();if(!clean||Array.from(clean).length>LIMITS.guessMax) return fail('INVALID','猜词需 1–400 字');
  // No maxGuesses gate: rate limiting and one pending request per player suffice.
  const guess:GuessView={id:`g-${++this.sequence}`,playerKey:key,playerName:p.name,avatar:p.avatar,text:clean,outcome:'判定中',at:this.now()};
  p.guesses++;p.pending=true;r.guesses.push(guess);return ok({...guess});
 }
 guessPoints(code:string,guessId:string):number {
  const r=this.rooms.get(code),g=r?.guesses.find(g=>g.id===guessId);
  if(!r||!g||r.phase!=='playing'||r.startedAt===null||r.drawerKey===g.playerKey||r.secretHolderKeys.includes(g.playerKey)||(r.settings.partyMode??'classic')!=='classic') return 0;
  const wrong=r.guesses.filter(item=>item.playerKey===g.playerKey&&item.id!==g.id&&(item.outcome==='还没猜对'||item.outcome==='接近真相')).length;
  return correctGuessPoints(r.startedAt,g.at,r.settings.turnSeconds,wrong);
 }
 applyOutcome(code:string,guessId:string,outcome:Outcome,credited?:{solverPoints:number;drawerPoints:number}):Result {
  const r=this.rooms.get(code);if(!r) return fail('NOT_FOUND','房间不存在');
  const g=r.guesses.find(g=>g.id===guessId);if(!g) return fail('NOT_FOUND','猜测不存在');
  if(r.phase!=='playing') return fail('BAD_PHASE','轮次已经结束');
  if(g.outcome!=='判定中'||!['破解成功','接近真相','还没猜对','不确定','出错'].includes(outcome)) return fail('INVALID','判定无效');
  const points=outcome==='破解成功'?this.guessPoints(code,guessId):0;
  if(outcome==='破解成功'&&points===0) return fail('NOT_YOUR_TURN','看过题词的玩家不能得分');
  g.outcome=outcome;const p=r.players.find(p=>p.key===g.playerKey);
  if(p) {p.pending=false;if(outcome==='不确定'||outcome==='出错') p.guesses=Math.max(0,p.guesses-1);}
  if(outcome==='破解成功') {
   const solverPoints=credited?.solverPoints??points,drawerPoints=credited?.drawerPoints??DRAWER_COOPERATIVE_POINTS;
   Object.assign(g,{points:solverPoints});
   r.solvedRankings.push({playerKey:g.playerKey,playerName:g.playerName,points:solverPoints,at:this.now()});
   const drawer=r.players.find(player=>player.key===r.drawerKey);
   if(drawer&&drawerPoints) r.solvedRankings.push({playerKey:drawer.key,playerName:drawer.name,points:drawerPoints,at:this.now()});
   for(const other of r.guesses) if(other.outcome==='判定中') other.outcome='出错';
   for(const player of r.players) player.pending=false;
   this.end(r,'solved',g.playerName);
  }
  return ok(undefined);
 }
 setQuestionScore(code:string,id:string,proximity:number|undefined,points:number):Result {
  const r=this.rooms.get(code);if(!r) return fail('NOT_FOUND','房间不存在');
  const q=r.log.find(item=>item.id===id);
  if(!q||q.verdict==='判定中'||q.points!==undefined) return fail('PENDING','提问尚未判定或已经评分');
  if(!Number.isInteger(points)||points<0||points>10||(proximity!==undefined&&(!Number.isFinite(proximity)||proximity<0||proximity>100))) return fail('INVALID','积分无效');
  q.points=points;if(proximity!==undefined) q.proximity=Math.round(proximity);return ok(undefined);
 }
 showHint(code:string,key:string,hintCount:number):Result {
  const check=this.player(code,key);if(!check.ok) return check;const {r,p}=check.value;
  if(r.phase!=='playing') return fail('BAD_PHASE','游戏尚未进行');
  if(!Number.isInteger(hintCount)||hintCount<0||r.hintsShown>=hintCount) return fail('INVALID','没有更多提示');
  r.hintCount=hintCount;r.hintsShown++;
  r.hintAnnouncement={id:`hint-${++this.sequence}`,round:r.round,index:r.hintsShown,playerKey:key,playerName:p.name};return ok(undefined);
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
  if(r.hostKey===key) this.transfer(r,(r.players.find(p=>p.online)??r.players[0]!).key);
  if(r.drawerKey===key) {r.drawerKey=(r.players.find(p=>p.online)??r.players[0]!).key;if(!r.secretHolderKeys.includes(r.drawerKey)) r.secretHolderKeys.push(r.drawerKey);}
  if(r.turnKey===key) r.turnKey=null;
  this.syncClock(r);
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
 exportSnapshots():RoomState[] {return [...this.rooms.values()].map(r=>structuredClone(r));}
 restoreSnapshots(snapshots:RoomState[],now=this.now()):void {
  for(const raw of snapshots) {
   const r=structuredClone(raw);
   for(const q of r.log) if(q.verdict==='判定中') {q.verdict='出错';const p=r.players.find(item=>item.key===q.playerKey);if(p) p.asked=Math.max(0,p.asked-1);if(r.settings.quotaMode==='shared') r.sharedUsed=Math.max(0,r.sharedUsed-1);}
   for(const g of r.guesses) if(g.outcome==='判定中') {g.outcome='出错';const p=r.players.find(item=>item.key===g.playerKey);if(p) p.guesses=Math.max(0,p.guesses-1);}
   for(const p of r.players) {p.online=false;p.socketId=null;p.pending=false;p.offlineAt??=now;}
   r.offlineAt??=now;
   r.strokes??=[];
   r.gameId??=randomUUID();
   r.secretHolderKeys??=r.drawerKey?[r.drawerKey]:[];
   r.drawerKey??=r.hostKey;
   r.aiGuess??=null;
   r.bluffs??=[];
   r.truthVotes??=[];
   r.saboteurKey??=null;
   r.sabotagedQuadrant??=null;
   r.accusedVotes??=[];
   r.candidateWords??=[];
   r.solvedRankings??=[];
   r.witnessKey??=null;
   r.memoryDeadline??=null;
   r.bestArtistVotes??={};
   r.currentFrame??=0;
   r.totalFrames??=4;
   let maxSeq=this.sequence;
   for(const item of [...r.log,...r.guesses,...r.highlights,...r.strokes,...r.bluffs,...(r.hintAnnouncement?[r.hintAnnouncement]:[])]) {
    const num=Number(item.id.split('-').pop());if(Number.isFinite(num)&&num>maxSeq) maxSeq=num;
   }
   this.sequence=maxSeq;
   this.rooms.set(r.code,r);
  }
 }
 setProgress(code:string,progress:ProgressView):Result {const r=this.rooms.get(code);if(!r) return fail('NOT_FOUND','房间不存在');r.progress=progress;return ok(undefined);}
 private buildPartyView(r:RoomState):PartyStateView|null {
  const mode=r.settings.partyMode;
  if(!mode||mode==='classic') {
   if(!r.bluffs.length&&!r.accusedVotes.length&&!r.solvedRankings.length) return null;
  }
  const activeMode:PartyMode=mode??'classic';
  const revealed=r.phase==='revealed';
  const choices:DrawfulChoiceView[]=r.bluffs.map(b=>({
   id:b.id,
   text:b.text,
   votes:[...b.votes],
   ...(revealed?{authorName:b.playerName,isTruth:false}:{}),
  }));
  if(revealed&&r.reveal) {
   choices.push({
    id:'choice-truth',
    text:r.reveal.bottom.split(/[（(]/)[0]!.trim(),
    votes:[...r.truthVotes],
    authorName:'真题答案',
    isTruth:true,
   });
  }
  const votedNames=[...new Set([...r.truthVotes,...r.bluffs.flatMap(b=>b.votes)])];
  const quadrantOwners=r.players.slice(0,4).map((pl,idx)=>({quadrant:idx as 0|1|2|3,playerKey:pl.key,playerName:pl.name}));
  const saboteurPlayer=r.players.find(pl=>pl.key===r.saboteurKey);
  const witnessPlayer=r.players.find(pl=>pl.key===r.witnessKey);
  const knockOffSteps=[60,30,15,8];
  const knockOffSeconds=activeMode==='knock-off'?knockOffSteps[Math.min(knockOffSteps.length-1,r.currentFrame)]!:null;
  let bestArtistWinner:string|null=null;
  if(Object.keys(r.bestArtistVotes).length>0) {
   const tally=new Map<string,number>();
   for(const target of Object.values(r.bestArtistVotes)) tally.set(target,(tally.get(target)??0)+1);
   bestArtistWinner=[...tally.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]??null;
  }
  return {
   mode:activeMode,
   stageDescription:MODE_STAGE_DESC[activeMode],
   bluffSubmittedNames:r.bluffs.map(b=>b.playerName),
   drawfulChoices:choices,
   votedNames,
   quadrantOwners,
   sabotagedQuadrant:revealed?r.sabotagedQuadrant:null,
   accusedVotes:r.accusedVotes.map(({voterName,suspectName})=>({voterName,suspectName})),
   saboteurName:revealed?(saboteurPlayer?.name??null):null,
   candidateWords:[...r.candidateWords],
   solvedRankings:r.solvedRankings.map(({playerName,points,at})=>({playerName,points,at})),
   witnessKey:r.witnessKey,
   witnessName:witnessPlayer?.name??null,
   memoryDeadline:r.memoryDeadline,
   bestArtistWinner,
   inkFadeMs:activeMode==='secret-ink'?2000:null,
   currentFrame:r.currentFrame,
   totalFrames:r.totalFrames,
   knockOffSeconds,
  };
 }
 toPublicView(code:string):Result<RoomView> {
  const r=this.rooms.get(code);if(!r) return fail('NOT_FOUND','房间不存在');
  const revealed=r.phase==='revealed';
  const safeStrokes=r.strokes.map(({sabotage,...s})=>({...s,...(revealed&&sabotage?{sabotage:true}:{})}));
  const party=this.buildPartyView(r);
  return ok(structuredClone({
   code:r.code,
   phase:r.phase,
   hostKey:r.hostKey,
   settings:r.settings,
   players:r.players.map(({socketId:_,offlineAt:__,...p})=>{
    const partyBonus=
     r.solvedRankings.filter(s=>s.playerKey===p.key).reduce((sum,s)=>sum+s.points,0)+
     r.bluffs.filter(b=>b.playerKey===p.key).reduce((sum,b)=>sum+b.votes.length*2,0)+
     r.accusedVotes.filter(v=>v.voterKey===p.key&&v.suspectKey===r.saboteurKey).length*3;
    return partyBonus>0?{...p,roundPoints:partyBonus}:p;
   }),
   puzzle:null,
   log:r.log,
   guesses:r.guesses.map(g=>revealed?g:{...g,text:'已提交猜词'}),
   highlights:r.highlights,
   hints:[],
   hintAnnouncement:r.hintAnnouncement??null,
   hintCount:r.hintCount,
   sharedUsed:r.sharedUsed,
   turnKey:r.turnKey,
   turnDeadline:r.turnDeadline,
   turnRemainingMs:r.turnRemainingMs,
   serverNow:this.now(),
   round:r.round,
   reveal:revealed?r.reveal:null,
   progress:r.progress??{score:0,status:'迷雾重重'},
   drawerKey:r.drawerKey,
   strokes:safeStrokes,
   aiGuess:r.aiGuess,
   ...(party?{party}:{}),
  }));
 }
}
