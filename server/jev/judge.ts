import type { DatabaseSync } from 'node:sqlite';
import type { PuzzleSecret, Verdict, Outcome, CanvasStroke, AiCanvasGuess } from '../../shared/protocol.js';
import type { Config } from '../config.js';
import { Lru } from '../util/lru.js';
import { decide, type DecisionResult } from './client.js';
export interface JudgeService {
 judgeQuestion(p:PuzzleSecret,text:string):Promise<{verdict:Verdict;confidence:number;proximity?:number}>;
 judgeSolution(p:PuzzleSecret,text:string):Promise<{outcome:Outcome;confidence:number}>;
 evaluateProgress?(p:PuzzleSecret,log:{text:string;verdict:Verdict}[]):Promise<{score:number;status:string}>;
 recognizeCanvas?(p:PuzzleSecret,strokes:CanvasStroke[],snapshotDataUrl?:string):Promise<AiCanvasGuess>;
 totalCost():number;
}
export function normalize(text:string):string { return text.trim().replace(/[？?。.!！]+$/u,'').trim().replace(/\s+/gu,' ').toLowerCase(); }
export function extractTargetWord(bottom:string):string { return bottom.split(/[（(]/)[0]!.trim()||bottom.trim(); }
const questionCriteria={是:'汤底明确或可合理推出该提问为真。',不是:'汤底明确或可合理推出该提问为假。',不相关:'该提问与汤底中的人物、事件、因果无实质关系，或汤底无法判断且不影响推理。'};
const solutionCriteria={破解成功:'玩家猜词是目标词本身，或日常语言中明确指向同一事物的同义词、别称。仅描述属性、类别、相关事物，或在多个候选中罗列到答案，不算猜中。',接近真相:'词语相关但不等同于目标词，仍未猜中。',还没猜对:'猜词与目标词不是同一事物；仅泛泛描述类别或属性。'};
const proximityAssessment={
 instructions:'仅评估本次玩家提问对汤底真相的相关性与关键因果突破，独立于真假判定。不是的回答也可能排除关键错误假设而获得高分；是的回答若只确认外围事实不能获得高分。不相关的问题为0分。只输出评分，不输出解释或泄露汤底、补充事实。',
 criteria:[
  '0% 迷雾重重：无实质相关性或关键突破，只问出零星事实',
  '25% 初见端倪：触及某人生死或单点背景，但未触及核心因果',
  '50% 渐入佳境：触及核心动机或反常举动的主因',
  '75% 临门一脚：触及核心诡计与关键因果链，形成重要突破',
  '100% 真相大白：直接点破核心反转与完整关键因果'
 ]
};
export function isValidJevImageDataUrl(url?:string):boolean {
 if(typeof url!=='string') return false;
 return /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/i.test(url.trim()) && url.length <= 8_000_000;
}
function summarizeStrokes(strokes:CanvasStroke[]):Record<string,unknown> {
 if(!strokes.length) return {strokeCount:0,summary:'空白画布'};
 const colors=[...new Set(strokes.filter(s=>s.tool!=='eraser').map(s=>s.color))];
 const tools=[...new Set(strokes.map(s=>s.tool))];
 let minX=1000,minY=1000,maxX=0,maxY=0,totalPoints=0;
 for(const s of strokes) {
  for(const pt of s.points) {
   totalPoints++;
   if(pt.x<minX) minX=pt.x;if(pt.y<minY) minY=pt.y;
   if(pt.x>maxX) maxX=pt.x;if(pt.y>maxY) maxY=pt.y;
  }
 }
 return {
  strokeCount:strokes.length,
  totalPoints,
  colors,
  tools,
  boundingBox:totalPoints?{x:Math.round(minX),y:Math.round(minY),width:Math.round(maxX-minX),height:Math.round(maxY-minY)}:null,
 };
}
export function createJevJudge(config:Config,db:DatabaseSync,fetchImpl?:typeof fetch):Required<JudgeService> {
 const cache=new Lru<string,DecisionResult>(500); const inflight=new Map<string,Promise<DecisionResult>>(); const inflightProgress=new Map<string,Promise<{score:number;status:string}>>(); let cost=0;
 async function run(p:PuzzleSecret,text:string,kind:'question'|'solution'):Promise<DecisionResult> {
  const cacheKind=kind==='solution'&&p.source.key==='draw-bank'?'solution:pictionary-v1':kind;
   const norm=normalize(text),key=JSON.stringify([p.id,p.bottom,cacheKind,norm]); const hit=cache.get(key); if(hit) return hit;
  const isQuestion=kind==='question';
  const row=db.prepare('SELECT choice,confidence,proximity FROM judge_cache WHERE puzzle_id=? AND kind=? AND norm_text=?').get(p.id,cacheKind,norm);
  if(row&&(!isQuestion||row.proximity!=null)) { const value={choice:String(row.choice),confidence:Number(row.confidence),cost:0,...(row.proximity==null?{}:{proximity:Number(row.proximity)})}; cache.set(key,value); return value; }
  const pending=inflight.get(key); if(pending) return pending;
  const task=(async()=>{
   try {
    const value=await decide({apiKey:config.apiKey,model:config.model,state:{汤面:p.surface,汤底:p.bottom,补充事实:p.hints,...(isQuestion?{玩家提问:text}:{玩家还原:text})},instructions:isQuestion?'你是海龟汤与你画我猜主持人。仅依据汤底/目标词判断玩家提问的真假，只能选 是、不是、不相关。':'你是经典你画我猜裁判。只判断玩家猜词是否与保密目标词含义相同，允许明确同义词和别称；不得按故事反转、相关特征或大类判为成功。只输出结构化判定，不输出目标词。',criteria:isQuestion?questionCriteria:solutionCriteria,...(isQuestion?{proximity:proximityAssessment}:{})},{fetchImpl});
    cost+=value.cost;
    const threshold=!isQuestion&&value.choice==='破解成功'?config.solveThreshold:config.judgeThreshold;
    if(value.confidence>=threshold) { cache.set(key,value); db.prepare('INSERT OR REPLACE INTO judge_cache(puzzle_id,kind,norm_text,choice,confidence,proximity,created_at) VALUES(?,?,?,?,?,?,?)').run(p.id,cacheKind,norm,value.choice,value.confidence,value.proximity??null,Date.now()); }
    return value;
   } finally { inflight.delete(key); }
  })();
  inflight.set(key,task);
  return task;
 }
 return {
  async judgeQuestion(p,text) { if(!config.judgeConfigured||!config.apiKey) return {verdict:'出错',confidence:0};const v=await run(p,text,'question');const verdict:Verdict=v.confidence<config.judgeThreshold?'不确定':v.choice as Verdict;return {verdict,confidence:v.confidence,...(v.proximity!==undefined&&Object.hasOwn(questionCriteria,verdict)?{proximity:v.proximity}:{})}; },
  async judgeSolution(p,text) {
   const target=normalize(extractTargetWord(p.bottom)),norm=normalize(text);
   if(norm&&(norm===target||norm===normalize(p.bottom))) return {outcome:'破解成功',confidence:1};
   if(!config.judgeConfigured||!config.apiKey) return {outcome:'出错',confidence:0};
   const v=await run(p,text,'solution'); const outcome:Outcome=v.confidence<config.judgeThreshold?'不确定':v.choice==='破解成功'&&v.confidence<config.solveThreshold?'接近真相':v.choice as Outcome; return {outcome,confidence:v.confidence};
  },
  async evaluateProgress(p,log) {
   if(!config.judgeConfigured||!config.apiKey||log.length===0) return {score:0,status:'迷雾重重'};
   const historyText=log.map((item,idx)=>`${idx+1}. 问：${item.text} → 答：${item.verdict}`).join('\n');
   const key=JSON.stringify([p.id,'progress',historyText]);
   const hit=cache.get(key);
   if(hit) { try { return JSON.parse(hit.choice); } catch {} }
   const pending=inflightProgress.get(key); if(pending) return pending;
   const task=(async()=>{
    try {
     const f=fetchImpl??fetch;
     const res=await f('https://openrouter.ai/api/alpha/decisions',{
      method:'POST',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json','HTTP-Referer':'http://localhost','X-Title':'Draw & Guess'},
      body:JSON.stringify({
       model:config.model,
       state:{汤面:p.surface,汤底:p.bottom,补充事实:p.hints,问答记录:historyText},
       questions:{
        progress:{
         type:'score',
         instructions:'严格评估玩家已探明的问答记录距离【完整还原出汤底所有核心反转与因果链】的整体破解比例。单单确认某人生死或外围事实只是刚刚起步（0-1分），绝不能给高分。',
         criteria:[
          '0% 迷雾重重：刚开始，只问出零星事实',
          '25% 初见端倪：确认了某人生死或单点背景，但核心因果一无所知',
          '50% 渐入佳境：抓住了核心动机或反常举动的主因',
          '75% 临门一脚：核心诡计与因果链已基本完全浮出水面',
          '100% 真相大白：整个故事的来龙去脉已被全部问明'
         ]
        }
       }
      })
     });
     if(!res.ok) return {score:Math.min(95,log.filter(l=>l.verdict==='是').length*15),status:log.some(l=>l.verdict==='是')?'初见端倪':'迷雾重重'};
     const body=await res.json();
     cost+=(body.usage?.cost??0);
     const scoreVal=body.answers?.progress?.score??body.answers?.progress?.value??body.answers?.progress;
     const rawScore=typeof scoreVal==='number'&&Number.isFinite(scoreVal)?Math.min(100,Math.max(0,Math.round((scoreVal/4)*100))):0;
     const statusChoice=rawScore>=95?'真相大白':rawScore>=75?'临门一脚':rawScore>=45?'渐入佳境':rawScore>=20?'初见端倪':'迷雾重重';
     const result={score:rawScore,status:statusChoice};
     cache.set(key,{choice:JSON.stringify(result),confidence:1,cost:0});
     return result;
    } catch {
     return {score:Math.min(95,log.filter(l=>l.verdict==='是').length*15),status:log.some(l=>l.verdict==='是')?'初见端倪':'迷雾重重'};
    } finally { inflightProgress.delete(key); }
   })();
   inflightProgress.set(key,task);
   return task;
  },
  async recognizeCanvas(p,strokes,snapshotDataUrl) {
   const summary=summarizeStrokes(strokes);
   const strokeCount=strokes.length;
   const hasImage=isValidJevImageDataUrl(snapshotDataUrl);
   if(strokeCount===0 && !hasImage) {
    return {guess:'空白画布',comment:'AI 鉴画官：画板上还没有落笔呢，快画上几笔让我看看！',confidence:0,similarity:0,multimodal:false,at:Date.now()};
   }
   const fallbackGuess=()=>{
    const sim=Math.min(92,Math.max(18,(strokeCount||1)*14));
    const category=p.tags[1]||p.tags[0]||'神秘事物';
    const stage=sim>=75?'神形兼备':sim>=45?'颇有灵气':'抽象派大作';
    const comments=[
     `AI 鉴画官（${stage}）：看出是「${category}」方向，线条轮廓很有辨识度！`,
     `AI 鉴画官（${stage}）：用色大胆，抓住了核心几何特征，再添一点细节就呼之欲出了！`,
     `AI 鉴画官（${stage}）：这几笔灵魂勾勒很有神韵，猜词队友注意观察主体轮廓！`,
    ];
    return {
     guess:`疑似「${category}」主题画作`,
     comment:comments[strokeCount%comments.length]!,
     confidence:Number((sim/100).toFixed(2)),
     similarity:sim,
     multimodal:hasImage,
     at:Date.now(),
    };
   };
   if(!config.judgeConfigured||!config.apiKey) return fallbackGuess();
   try {
    const f=fetchImpl??fetch;
    // OpenRouter Multimodal Decisions API: top-level `state` array or object with `{ type: "image_url", image_url: { url: "data:image/png;base64,..." } }`
    const multimodalState=hasImage
     ? [
        `公开题面提示：${p.surface}`,
        `分类标签：${p.tags.join('、')}`,
        `笔触统计：${JSON.stringify(summary)}`,
        { type:'image_url', image_url:{ url:snapshotDataUrl!.trim() } },
       ]
     : {
        公开题面提示:p.surface,
        分类标签:p.tags,
        画板笔触特征:summary,
       };
    const res=await f('https://openrouter.ai/api/alpha/decisions',{
     method:'POST',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json','HTTP-Referer':'http://localhost','X-Title':'Draw & Guess'},
     body:JSON.stringify({
      model:config.model,
      state:multimodalState,
      questions:{
       style:{
        type:'choice',
        instructions:'你是你画我猜房间的 JEV 多模态视觉鉴画陪玩员。观察画板图像与笔触结构（严禁直接剧透答案原词），评价当前画作的视觉表现力。',
        criteria:{
         惟妙惟肖:'图像构图、色彩与主体特征非常鲜明，一眼能认出大类',
         初具雏形:'已有核心轮廓线条，能看出大致几何形状与方向',
         灵魂抽象:'笔画极简或充满抽象艺术感，颇具想象空间',
        }
       },
       similarity:{
        type:'score',
        instructions:'基于视觉画布与公开类别，评估当前画作的特征还原度与传神程度（0-4分）。',
        criteria:['0% 刚起笔','25% 局部线条','50% 初具轮廓','75% 特征鲜明','100% 传神还原']
       }
      }
     })
    });
    if(!res.ok) return fallbackGuess();
    const body=await res.json();
    cost+=(body.usage?.cost??0);
    const choice=String(body.answers?.style?.choice??'初具雏形');
    const conf=Number(body.answers?.style?.confidence??0.8);
    const rawScore=Number(body.answers?.similarity?.score??2);
    const similarity=Number.isFinite(rawScore)?Math.min(100,Math.max(15,Math.round(rawScore*25))):fallbackGuess().similarity;
    const category=p.tags[1]||p.tags[0]||'神秘作品';
    return {
     guess:`${choice} · 锁定「${category}」特征`,
     comment:`AI 鉴画官【${choice}】（传神度 ${similarity}%）：画作主体轮廓指向「${category}」，快结合特征猜词吧！`,
     confidence:Number.isFinite(conf)?Math.max(0,Math.min(1,conf)):0.8,
     similarity,
     multimodal:hasImage,
     at:Date.now(),
    };
   } catch {
    return fallbackGuess();
   }
  },
  totalCost:()=>cost,
 };
}
