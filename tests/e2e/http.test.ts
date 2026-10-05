import { afterEach, expect, test } from 'vitest';
import { createApp } from '../../server/app.js';
import { fixture, bottom } from './fixture.js';
let app: ReturnType<typeof createApp>;
afterEach(async()=>{if(app) await app.close();});
test('健康检查、公开题库与建房接口，不泄露汤底和提示', async()=>{
 app=createApp(fixture());
 await new Promise<void>(resolve=>app.httpServer.listen(0,'127.0.0.1',resolve));
 const address=app.httpServer.address(); if(!address || typeof address==='string') throw Error('未监听');
 const url=`http://127.0.0.1:${address.port}`;
 expect(await (await fetch(`${url}/api/health`)).json()).toEqual({ok:true,puzzles:1,model:'fake',cost:0.25,judgeConfigured:false});
 for(const path of ['/api/puzzles','/api/puzzles/test-1']) {
  const body=await (await fetch(url+path)).json();
  for(const p of Array.isArray(body)?body:[body]) {expect(p).not.toHaveProperty('bottom');expect(p).not.toHaveProperty('hints');}
  expect(JSON.stringify(body)).not.toContain(bottom);
 }
 expect((await fetch(`${url}/api/puzzles/missing`)).status).toBe(404);
 for(const query of ['limit=201','offset=-1','sort=bad','nsfl=2']) expect((await fetch(`${url}/api/puzzles?${query}`)).status).toBe(400);
 expect((await fetch(`${url}/api/rooms`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status).toBe(400);
 const created=await (await fetch(`${url}/api/rooms`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'房主',playerKey:'a'})})).json();
 expect(created.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
});
test('房间大厅仅返回有在线玩家且未满的房间摘要，不泄露题目秘密或身份', async()=>{
 const deps=fixture();
 app=createApp(deps);
 await new Promise<void>(resolve=>app.httpServer.listen(0,'127.0.0.1',resolve));
 const address=app.httpServer.address();if(!address||typeof address==='string') throw Error('未监听');
 const url=`http://127.0.0.1:${address.port}/api/rooms`;
 const created=deps.rooms.createRoom('大厅房主','private-host-key');if(!created.ok) throw Error(created.msg);
 const code=created.value.code;
 expect(await (await fetch(url)).json()).toEqual([]);
 deps.rooms.join(code,'大厅房主','private-host-key','host-socket');
 const read=async()=>{
  const payload=await (await fetch(url)).json();
  expect(JSON.stringify(payload).includes(bottom)).toBe(false);
  expect(JSON.stringify(payload)).not.toContain('private-host-key');
  for(const room of payload) {expect(Object.keys(room).sort()).toEqual(['code','hostName','maxPlayers','phase','players']);}
  return payload;
 };
 expect(await read()).toEqual([{code,hostName:'大厅房主',players:1,maxPlayers:8,phase:'lobby'}]);
 deps.rooms.start(code,'private-host-key','test-1',1);
 expect(await read()).toMatchObject([{phase:'playing'}]);
 for(let i=1;i<8;i++) deps.rooms.join(code,`玩家${i}`,`player-${i}`,`socket-${i}`);
 expect(await read()).toEqual([]);
 const ended=deps.rooms.createRoom('结束房间','ended');if(!ended.ok) throw Error(ended.msg);
 deps.rooms.join(ended.value.code,'结束房间','ended','ended-socket');
 deps.rooms.start(ended.value.code,'ended','test-1');
 deps.rooms.endGame(ended.value.code,'host');
 deps.rooms.setReveal(ended.value.code,{bottom,hints:['秘密提示'],reason:'host',winnerName:null});
 expect(await read()).toEqual([]);
});
