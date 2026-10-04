import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { DatabaseSync } from 'node:sqlite';
import type { ClientToServer, ServerToClient } from '../shared/protocol.js';
import type { Config } from './config.js';
import type { PuzzleRepo } from './puzzles/repo.js';
import type { JudgeService } from './jev/judge.js';
import type { RoomManager } from './rooms/roomManager.js';
import { createRoutes } from './http/routes.js';
import { attachSockets } from './rooms/socket.js';
export interface AppDeps {config:Config;repo:PuzzleRepo;judge:JudgeService;rooms:RoomManager;db:DatabaseSync}
export function createApp(deps:AppDeps) {
 const app=express();
 app.use(express.json({limit:'16kb'}));
 app.use(createRoutes(deps));
 app.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  const invalid=error instanceof SyntaxError;
  res.status(invalid?400:500).json({code:invalid?'INVALID':'INTERNAL',msg:invalid?'请求格式无效':'服务暂时不可用'});
 });
 const httpServer=createServer(app);
 const io=new Server<ClientToServer,ServerToClient>(httpServer);
 const sockets=attachSockets(io,deps);
 let closing:Promise<void>|undefined;
 return {httpServer,io,broadcast:sockets.broadcast,close():Promise<void> {
  closing??=sockets.close().then(()=>new Promise<void>(resolve=>io.close(()=>{deps.db.close();resolve();})));
  return closing;
 }};
}
