import { assertEquals } from 'jsr:@std/assert@1';
import { createDrawServer } from '../server.ts';
Deno.test('concurrent exact guesses across engines score once and stale turns cannot progress',async()=>{
 const kv=await Deno.openKv(':memory:');const x=createDrawServer(kv),y=createDrawServer(kv);
 const info={remoteAddr:{transport:'tcp',hostname:'127.0.0.1',port:1}} as Deno.ServeHandlerInfo;
 const req=async(s:any,p:string,body?:any,a?:any)=>{const r=await s.handler(new Request('http://localhost/api/game'+p,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(a?{'x-player':a.pid,'x-token':a.token}:{})},body:body===undefined?undefined:JSON.stringify(body)}),info);return {status:r.status,data:await r.json()}};
 try{
 const a=(await req(x,'/rooms',{settings:{customWords:['保密测试词'],customOnly:true,hints:false}})).data;
 const b=(await req(y,`/rooms/${a.roomId}/join`,{name:'b'})).data;
 const p=`/rooms/${a.roomId}`; await req(x,p+'/start',{},a);
 const state=(await req(x,p+'/poll?wait=0',undefined,a)).data.state;
 const d=state.drawerId===a.pid?a:b,g=d===a?b:a;
 await req(y,p+'/choose',{turnId:state.turnId,index:0},d);
 const results=await Promise.all([req(x,p+'/guess',{turnId:state.turnId,text:'保密测试词'},g),req(y,p+'/guess',{turnId:state.turnId,text:'保密测试词'},g)]);
 assertEquals(results.every(r=>r.status===200),true);
 const after=(await req(x,p+'/poll?wait=0',undefined,g)).data;
 assertEquals(after.state.phase,'reveal');assertEquals(after.state.lastResult.guessed,[g.pid]);
 assertEquals(after.state.players.find((p:any)=>p.id===d.pid).score,4);
 const score=after.state.players.find((p:any)=>p.id===g.pid).score;
 assertEquals(score>=3&&score<=11,true);
 const stale=await req(y,p+'/choose',{turnId:state.turnId-1,index:0},d);assertEquals(stale.status,409);
 }finally{x.shutdown();y.shutdown();kv.close();}
});
