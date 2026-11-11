import {assertEquals} from 'jsr:@std/assert@1';
import {createDrawServer} from '../server.ts';
Deno.test('version endpoint reports explicit build provenance without secrets',async()=>{
 const file=new URL('../build-info.json',import.meta.url);let prior:Uint8Array|undefined;try{prior=await Deno.readFile(file)}catch{}
 await Deno.writeTextFile(file,JSON.stringify({commit:'a'.repeat(40),run:'1234'}));
 const kv=await Deno.openKv(':memory:'),s=createDrawServer(kv);
 try{const r=await s.handler(new Request('https://draw.d5v.cc/api/game/version'),{remoteAddr:{transport:'tcp',hostname:'127.0.0.1',port:1}} as Deno.ServeHandlerInfo);assertEquals(r.status,200);assertEquals(await r.json(),{commit:'a'.repeat(40),run:'1234'});
 }finally{s.shutdown();kv.close();if(prior)await Deno.writeFile(file,prior);else await Deno.remove(file);}
});
