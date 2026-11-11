import { assertEquals } from 'jsr:@std/assert@1';
import { DrawKvEngine } from '../kv-game.ts';
Deno.test('resync snapshot never returns board operations newer than its sequence',async()=>{
 const kv=await Deno.openKv(':memory:');const e=new DrawKvEngine(kv);
 try{
 const a=await e.createRoom('snapshot',{},{}); const entry=await kv.get<any>(['draw','room',a.roomId]); const room=entry.value;
 await kv.set(['draw','op',a.roomId,room.turnId,room.seq+1],[{k:'clear'}]);
 const response=await e.pollResponse(room,a.pid,0);
 assertEquals('ops' in response ? response.ops : undefined,[]);
 }finally{e.close();kv.close();}
});
