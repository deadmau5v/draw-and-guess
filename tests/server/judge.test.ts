import { it,expect,vi } from 'vitest';
import { runSmoke } from '../../scripts/jev-smoke.js';
it('smoke 无密钥打印提示，有密钥用 mock 测三问一次还原',async()=>{const db=openDb(':memory:');const f=vi.fn<typeof fetch>().mockImplementation(async(_url,init)=>{const body=JSON.parse(String(init?.body));return response(body.questions.verdict.criteria['是']?'是':'破解成功',0.9);});const print=vi.fn();await runSmoke({...config,apiKey:'',judgeConfigured:false},db,f,print);expect(f).not.toHaveBeenCalled();expect(print).toHaveBeenCalled();await runSmoke(config,db,f,print);expect(f).toHaveBeenCalledTimes(4);db.close();});
import { createJevJudge } from '../../server/jev/judge.js';
import { openDb,seedIfEmpty } from '../../server/db.js';
import { PuzzleRepo } from '../../server/puzzles/repo.js';
import { seed } from './fixtures.js';
it('无 key 不调用网络',async()=>{const db=openDb(':memory:');seedIfEmpty(db,[seed]);const p=new PuzzleRepo(db).getSecret(seed.id)!;const f=vi.fn<typeof fetch>(); const j=createJevJudge({...config,apiKey:'',judgeConfigured:false},db,f);expect(await j.judgeQuestion(p,'问')).toEqual({verdict:'出错',confidence:0});expect(await j.judgeSolution(p,'猜')).toEqual({outcome:'出错',confidence:0});expect(f).not.toHaveBeenCalled();db.close();});
it('低置信不缓存，成功阈值降级，问答和还原缓存隔离',async()=>{const db=openDb(':memory:');seedIfEmpty(db,[seed]);const p=new PuzzleRepo(db).getSecret(seed.id)!;const f=vi.fn<typeof fetch>().mockImplementationOnce(async()=>response('是',0.2)).mockImplementationOnce(async()=>response('是',0.3)).mockImplementationOnce(async()=>response('破解成功',0.5)).mockImplementationOnce(async()=>response('破解成功',0.8));const j=createJevJudge(config,db,f);expect((await j.judgeQuestion(p,'相同')).verdict).toBe('不确定');expect((await j.judgeQuestion(p,'相同')).verdict).toBe('不确定');expect((await j.judgeSolution(p,'相同')).outcome).toBe('接近真相');expect((await j.judgeSolution(p,'新猜测')).outcome).toBe('破解成功');expect((await j.judgeSolution(p,'新猜测！')).outcome).toBe('破解成功');expect(f).toHaveBeenCalledTimes(4);expect(j.totalCost()).toBeCloseTo(0.04);db.close();});
const config={apiKey:'test-only',judgeConfigured:true,model:'typesafe/jev-1.13',judgeThreshold:0.4,solveThreshold:0.55,port:3001,dbPath:':memory:'};
const response=(choice:string,confidence:number,cost=0.01)=>new Response(JSON.stringify({answers:{verdict:{choice,probabilities:{[choice]:confidence}}},usage:{cost}}));
it('高置信问答缓存规范化文本并持久化，累计实际调用成本',async()=>{const db=openDb(':memory:');seedIfEmpty(db,[seed]);const p=new PuzzleRepo(db).getSecret(seed.id)!; const f=vi.fn<typeof fetch>().mockImplementation(async()=>response('是',0.9));const j=createJevJudge(config,db,f);expect(await j.judgeQuestion(p,'  HELLO   world？！ ')).toEqual({verdict:'是',confidence:0.9});expect(await j.judgeQuestion(p,'hello world')).toEqual({verdict:'是',confidence:0.9});expect(f).toHaveBeenCalledTimes(1);expect(j.totalCost()).toBe(0.01);expect(await createJevJudge(config,db,f).judgeQuestion(p,'hello world?')).toEqual({verdict:'是',confidence:0.9});expect(f).toHaveBeenCalledTimes(1);db.close();});

it('evaluateProgress 未配置或空日志优雅回退，有效日志调用 JEV 并转换 0-4 评分为 0-100 百分比',async()=>{
 const db=openDb(':memory:');seedIfEmpty(db,[seed]);const p=new PuzzleRepo(db).getSecret(seed.id)!;
 const unconfigured=createJevJudge({...config,apiKey:'',judgeConfigured:false},db);
 expect(await unconfigured.evaluateProgress(p,[])).toEqual({score:0,status:'迷雾重重'});
 expect(await unconfigured.evaluateProgress(p,[{text:'活着吗',verdict:'是'}])).toEqual({score:0,status:'迷雾重重'});

 const configuredEmpty=createJevJudge(config,db);
 expect(await configuredEmpty.evaluateProgress(p,[])).toEqual({score:0,status:'迷雾重重'});

 let requestBody:any=null;
 const f=vi.fn<typeof fetch>().mockImplementation(async(_url,init)=>{
  requestBody=JSON.parse(String(init?.body));
  return new Response(JSON.stringify({
   answers:{
    progress:{score:3},
    status:{choice:'临门一脚'}
   },
   usage:{cost:0.02}
  }));
 });

 const j=createJevJudge(config,db,f);
 const log=[{text:'他受伤了吗',verdict:'不是' as const},{text:'他是为了治病吗',verdict:'是' as const}];
 const res=await j.evaluateProgress(p,log);
 expect(res).toEqual({score:75,status:'临门一脚'});
 expect(f).toHaveBeenCalledTimes(1);
 expect(requestBody.questions.progress.type).toBe('score');
 expect(requestBody.questions.progress.criteria).toEqual([
  '0% 迷雾重重：刚开始，只问出零星事实',
  '25% 初见端倪：确认了某人生死或单点背景，但核心因果一无所知',
  '50% 渐入佳境：抓住了核心动机或反常举动的主因',
  '75% 临门一脚：核心诡计与因果链已基本完全浮出水面',
  '100% 真相大白：整个故事的来龙去脉已被全部问明'
 ]);

 // 缓存命中测试
 const cachedRes=await j.evaluateProgress(p,log);
 expect(cachedRes).toEqual({score:75,status:'临门一脚'});
 expect(f).toHaveBeenCalledTimes(1);

 // 网络异常优雅降级
 const failingFetch=vi.fn<typeof fetch>().mockImplementation(async()=>new Response('error',{status:500}));
 const failingJudge=createJevJudge(config,db,failingFetch);
 const fallbackRes=await failingJudge.evaluateProgress(p,[{text:'问1',verdict:'是' as const}]);
 expect(fallbackRes.score).toBeGreaterThan(0);
 expect(fallbackRes.status).toBe('初见端倪');
 db.close();
});
