import type { Ack, PlayerView, RoomView, ProgressView } from '../../shared/protocol.js';
export type Result<T=undefined> = Ack<T>;
export interface RoomOptions { now?:()=>number; random?:()=>number }
export interface PlayerState extends PlayerView { socketId:string|null; offlineAt:number|null }
export interface RoomState extends Omit<RoomView,'players'|'puzzle'|'hints'|'progress'> { players:PlayerState[]; puzzleId:string|null; hintsShown:number; playedIds:string[]; winner:string|null; revealReason:'solved'|'host'|'exhausted'|null; offlineAt:number|null; startedAt:number|null; progress:ProgressView }
