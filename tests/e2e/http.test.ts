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
