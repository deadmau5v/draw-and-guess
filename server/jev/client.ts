export interface DecisionRequest { apiKey:string; model:string; state:Record<string,unknown>; instructions:string; criteria:Record<string,string> }
export interface DecisionResult { choice:string; confidence:number; cost:number }
export interface DecisionOptions { fetchImpl?:typeof fetch; sleep?:(ms:number)=>Promise<void> }
export async function decide(request:DecisionRequest,options:DecisionOptions={}):Promise<DecisionResult> {
 const fetchImpl=options.fetchImpl??fetch;
 const sleep=options.sleep??(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
 for(let attempt=0;attempt<3;attempt++) {
  let response:Response;
  try {
   response=await fetchImpl('https://openrouter.ai/api/alpha/decisions',{
    method:'POST',headers:{Authorization:`Bearer ${request.apiKey}`,'Content-Type':'application/json','HTTP-Referer':'http://localhost','X-Title':'Turtle Soup'},
    body:JSON.stringify({model:request.model,state:request.state,questions:{verdict:{type:'choice',instructions:request.instructions,criteria:request.criteria}}}),
   });
  } catch(e) { if(attempt===2) throw e; await sleep([300,900][attempt]); continue; }
  if(!response.ok) {
   if(attempt<2 && (response.status===429 || response.status>=500)) { await sleep([300,900][attempt]); continue; }
   throw new Error(`Jev HTTP ${response.status}`);
  }
  const body=await response.json(); const answer=body.answers?.verdict;
  const choice=answer?.choice;
  const confidence=answer?.probabilities===undefined ? answer?.confidence??0 : answer?.probabilities?.[choice];
  if(typeof choice!=='string'||!Object.hasOwn(request.criteria,choice)||typeof confidence!=='number'||!Number.isFinite(confidence)||confidence<0||confidence>1) throw new Error('Jev 返回无效判定');
  const cost=body.usage?.cost;
  return {choice,confidence,cost:typeof cost==='number'&&Number.isFinite(cost)&&cost>=0?cost:0};
 }
 throw new Error('Jev 请求失败');
}
