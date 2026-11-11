import {assertEquals} from 'jsr:@std/assert@1';
import {createDrawServer} from '../server.ts';
Deno.test('Deploy origin boundary rejects other apps and loopback while allowing own revision',async()=>{
 const old=Deno.env.get('DENO_DEPLOY_ORG_SLUG');Deno.env.set('DENO_DEPLOY_ORG_SLUG','deadmau5v');
 const kv=await Deno.openKv(':memory:'),s=createDrawServer(kv);
 const info={remoteAddr:{transport:'tcp',hostname:'127.0.0.1',port:1}} as Deno.ServeHandlerInfo;
 try{for(const [origin,status] of [['https://other-app.deadmau5v.deno.net',403],['http://localhost:1234',403],['https://draw-d5v-rev123.deadmau5v.deno.net',200],['https://draw-d5v.deadmau5v.deno.net',200]] as const){
 const r=await s.handler(new Request('https://draw-d5v.deadmau5v.deno.net/api/game/categories',{headers:{origin}}),info);await r.body?.cancel();assertEquals(r.status,status,origin);
 }}finally{s.shutdown();kv.close();if(old===undefined)Deno.env.delete('DENO_DEPLOY_ORG_SLUG');else Deno.env.set('DENO_DEPLOY_ORG_SLUG',old);}
});
