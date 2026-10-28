import { it,expect,vi } from 'vitest';
import { decide } from '../../server/jev/client.js';
it.each([429,500,503,'network'])('重试暂时错误 %s 两次',async(status)=>{const f=vi.fn<typeof fetch>(); if(status==='network') f.mockRejectedValueOnce(new TypeError('offline')); else f.mockResolvedValueOnce(new Response('',{status:status as number})); f.mockResolvedValueOnce(new Response('',{status:503})).mockResolvedValueOnce(new Response(JSON.stringify({answers:{verdict:{choice:'是',confidence:0.7}}}))); const sleep=vi.fn(async(_ms:number)=>{}); expect((await decide(request,{fetchImpl:f,sleep})).confidence).toBe(0.7); expect(sleep.mock.calls).toEqual([[300],[900]]); expect(f).toHaveBeenCalledTimes(3);});
it.each([400,401,403])('不重试 HTTP %s',async(status)=>{const f=vi.fn<typeof fetch>().mockResolvedValue(new Response('',{status})); await expect(decide(request,{fetchImpl:f})).rejects.toThrow(); expect(f).toHaveBeenCalledTimes(1);});
it.each([{choice:'未知',confidence:0.8},{choice:'是',confidence:1.1},{choice:'是',confidence:-0.1},{choice:'是',confidence:'0.8'}])('拒绝无效判定 %j',async(answer)=>{const f=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({answers:{verdict:answer}}))); await expect(decide(request,{fetchImpl:f})).rejects.toThrow();});
const request={apiKey:'test-only',model:'typesafe/jev-1.13',state:{汤面:'面'},instructions:'判断',criteria:{是:'真',不是:'假'}};
it('按协议发送请求并读取概率与成本',async()=>{const f=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({answers:{verdict:{choice:'是',probabilities:{是:0.8}}},usage:{cost:0.01}}))); expect(await decide(request,{fetchImpl:f})).toEqual({choice:'是',confidence:0.8,cost:0.01}); const [url,init]=f.mock.calls[0]; expect(url).toBe('https://openrouter.ai/api/alpha/decisions'); expect(init?.headers).toMatchObject({'HTTP-Referer':'http://localhost','X-Title':'Turtle Soup'}); expect(JSON.parse(String(init?.body)).questions.verdict).toMatchObject({type:'choice',criteria:request.criteria});});

it.each([0,1,2,3,4])('同一次判定请求同时评估接近度 %s',async(score)=>{
 const proximity={instructions:'评估关键因果突破，不以是或不是衡量',criteria:['零','一','二','三','四']};
 const f=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({answers:{verdict:{choice:'不是',confidence:0.9},proximity:{score,explanation:'秘密汤底'}},usage:{cost:0.02}})));
 expect(await decide({...request,proximity},{fetchImpl:f})).toEqual({choice:'不是',confidence:0.9,cost:0.02,proximity:score*25});
 expect(f).toHaveBeenCalledTimes(1);
 const body=JSON.parse(String(f.mock.calls[0][1]?.body));
 expect(body.questions).toEqual({verdict:{type:'choice',instructions:request.instructions,criteria:request.criteria},proximity:{type:'score',...proximity}});
 expect(body).not.toHaveProperty('apiKey');
});

it.each([undefined,null,'3',-1,5,NaN,Infinity,{},[]])('畸形接近度 %j 不影响有效判定',async(score)=>{
 const f=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({answers:{verdict:{choice:'是',confidence:0.8},proximity:{score}}})));
 expect(await decide({...request,proximity:{instructions:'评分',criteria:['0','1','2','3','4']}},{fetchImpl:f})).toEqual({choice:'是',confidence:0.8,cost:0});
});
it('没有请求评分时忽略供应商附加评分',async()=>{
 const f=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({answers:{verdict:{choice:'是',confidence:0.8},proximity:{score:4}}})));
 expect(await decide(request,{fetchImpl:f})).toEqual({choice:'是',confidence:0.8,cost:0});
});
