import type { DatabaseSync } from 'node:sqlite';
import type { PuzzleSecret, Verdict, Outcome } from '../../shared/protocol.js';
import type { Config } from '../config.js';
import { Lru } from '../util/lru.js';
import { decide, type DecisionResult } from './client.js';
export interface JudgeService {
 judgeQuestion(p:PuzzleSecret,text:string):Promise<{verdict:Verdict;confidence:number}>;
 judgeSolution(p:PuzzleSecret,text:string):Promise<{outcome:Outcome;confidence:number}>;
 evaluateProgress?(p:PuzzleSecret,log:{text:string;verdict:Verdict}[]):Promise<{score:number;status:string}>;
 totalCost():number;
}
export function normalize(text:string):string { return text.trim().replace(/[？?。.!！]+$/u,'').trim().replace(/\s+/gu,' ').toLowerCase(); }
const questionCriteria={是:'汤底明确或可合理推出该提问为真。',不是:'汤底明确或可合理推出该提问为假。',不相关:'该提问与汤底中的人物、事件、因果无实质关系，或汤底无法判断且不影响推理。'};
const solutionCriteria={破解成功:'猜中或说中了谜底的核心反转或关键真相（例如“第五个人是死人，被四个人抬棺到教堂”这种核心诡计、隐秘身份或反常原因）。只要命中核心反转/核心真相即判定为破解成功，绝不苛求玩家逐字复述已知汤面背景细节。',接近真相:'抓住了部分反转或方向正确，但遗漏了最关键的核心反转事实。',还没猜对:'与汤底核心事实不符，或者过于笼统、毫无实质进展。'};
export function createJevJudge(config:Config,db:DatabaseSync,fetchImpl?:typeof fetch):Required<JudgeService> {
 const cache=new Lru<string,DecisionResult>(500); let cost=0;
 async function run(p:PuzzleSecret,text:string,kind:'question'|'solution'):Promise<DecisionResult> {
  const norm=normalize(text),key=JSON.stringify([p.id,kind,norm]); const hit=cache.get(key); if(hit) return hit;
  const row=db.prepare('SELECT choice,confidence FROM judge_cache WHERE puzzle_id=? AND kind=? AND norm_text=?').get(p.id,kind,norm);
  if(row) { const value={choice:String(row.choice),confidence:Number(row.confidence),cost:0}; cache.set(key,value); return value; }
  const isQuestion=kind==='question';
  const value=await decide({apiKey:config.apiKey,model:config.model,state:{汤面:p.surface,汤底:p.bottom,补充事实:p.hints,...(isQuestion?{玩家提问:text}:{玩家还原:text})},instructions:isQuestion?'你是海龟汤主持人。仅依据汤底判断玩家提问的真假，只能选 是、不是、不相关。':'你是海龟汤主持人。判断玩家还原是否猜中谜底的核心反转真相（例如核心诡计、关键隐秘身份如“第五个人是死人，被四个人抬棺到教堂”、意外动机或核心反常原因）。海龟汤注重猜中核心梗，只要玩家点破了核心反转与关键真相，即判定为【破解成功】，严禁苛求玩家逐字复述已知汤面背景细节。',criteria:isQuestion?questionCriteria:solutionCriteria},{fetchImpl});
  cost+=value.cost;
  const threshold=!isQuestion&&value.choice==='破解成功'?config.solveThreshold:config.judgeThreshold;
  if(value.confidence>=threshold) { cache.set(key,value); db.prepare('INSERT OR REPLACE INTO judge_cache(puzzle_id,kind,norm_text,choice,confidence,created_at) VALUES(?,?,?,?,?,?)').run(p.id,kind,norm,value.choice,value.confidence,Date.now()); }
  return value;
 }
 return {
  async judgeQuestion(p,text) { if(!config.judgeConfigured||!config.apiKey) return {verdict:'出错',confidence:0};const v=await run(p,text,'question');return {verdict:v.confidence<config.judgeThreshold?'不确定':v.choice as Verdict,confidence:v.confidence}; },
  async judgeSolution(p,text) { if(!config.judgeConfigured||!config.apiKey) return {outcome:'出错',confidence:0};const v=await run(p,text,'solution'); const outcome:Outcome=v.confidence<config.judgeThreshold?'不确定':v.choice==='破解成功'&&v.confidence<config.solveThreshold?'接近真相':v.choice as Outcome; return {outcome,confidence:v.confidence}; },
  async evaluateProgress(p,log) {
   if(!config.judgeConfigured||!config.apiKey||log.length===0) return {score:0,status:'迷雾重重'};
   const historyText=log.map((item,idx)=>`${idx+1}. 问：${item.text} → 答：${item.verdict}`).join('\n');
   const key=JSON.stringify([p.id,'progress',historyText]);
   const hit=cache.get(key);
   if(hit) { try { return JSON.parse(hit.choice); } catch {} }
   try {
    const f=fetchImpl??fetch;
    const res=await f('https://openrouter.ai/api/alpha/decisions',{
     method:'POST',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json','HTTP-Referer':'http://localhost','X-Title':'Turtle Soup'},
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
   }
  },
  totalCost:()=>cost,
 };
}
