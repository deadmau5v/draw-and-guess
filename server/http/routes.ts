import express from 'express';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { ScoreRepo } from '../scoring/repo.js';
const listSchema=z.object({sort:z.enum(['good','mid','low','hot','new']).optional(),q:z.string().max(200).optional(),tag:z.string().max(100).optional(),nsfl:z.enum(['0','1']).default('0'),limit:z.coerce.number().int().min(1).max(200).default(60),offset:z.coerce.number().int().min(0).default(0)});
export const deviceSchema=z.object({
 kind:z.enum(['desktop','tablet','mobile','stylus']),
 os:z.string().trim().min(1).max(32),
 browser:z.string().trim().min(1).max(32),
 label:z.string().trim().min(1).max(64),
}).strict();
export const identitySchema=z.object({name:z.string().trim().min(1).max(16),playerKey:z.string().min(1).max(128),avatar:z.string().max(512).optional(),device:deviceSchema.optional()}).strict();
export function createRoutes(deps:AppDeps) {
 const router=express.Router(),scores=new ScoreRepo(deps.db);
 router.get('/api/leaderboard',(req,res)=>{
  const parsed=z.object({playerKey:z.string().min(1).max(128).optional(),limit:z.coerce.number().int().min(1).max(100).default(50)}).strict().safeParse(req.query);
  if(!parsed.success) {res.status(400).json({code:'INVALID',msg:'排行榜查询参数无效'});return;}
  res.set('Cache-Control','no-store').json(scores.leaderboard(parsed.data.playerKey,parsed.data.limit));
 });
 router.get('/api/health',(_req,res)=>res.json({ok:true,puzzles:deps.repo.count(),model:deps.config.model,cost:deps.judge.totalCost(),judgeConfigured:deps.config.judgeConfigured}));
 router.get('/api/puzzles',(req,res)=>{
  const parsed=listSchema.safeParse(req.query);
  if(!parsed.success) {res.status(400).json({code:'INVALID',msg:'题库查询参数无效'});return;}
  const {nsfl,...query}=parsed.data;
  res.json(deps.repo.list({...query,excludeNsfl:nsfl==='0'}));
 });
 router.get('/api/puzzles/:id',(req,res)=>{
  const parsed=z.string().regex(/^[a-z0-9-]+$/).max(128).safeParse(req.params.id);
  if(!parsed.success) {res.status(400).json({code:'INVALID',msg:'题目 ID 无效'});return;}
  const puzzle=deps.repo.getPublic(parsed.data);
  if(!puzzle) {res.status(404).json({code:'NOT_FOUND',msg:'题目不存在'});return;}
  res.json(puzzle);
 });
 router.get('/api/rooms',(_req,res)=>res.json(deps.rooms.listLobby()));
 router.post('/api/rooms',(req,res)=>{
  const parsed=identitySchema.safeParse(req.body);
  if(!parsed.success) {res.status(400).json({code:'INVALID',msg:'昵称或身份无效'});return;}
  const result=deps.rooms.createRoom(parsed.data.name,parsed.data.playerKey,parsed.data.avatar,parsed.data.device);
  if(!result.ok) {res.status(400).json(result);return;}
  res.status(201).json(result.value);
 });
 router.use('/api',(_req,res)=>res.status(404).json({code:'NOT_FOUND',msg:'接口不存在'}));
 return router;
}
