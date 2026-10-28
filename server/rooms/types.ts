import type { Ack, PlayerView, RoomView, ProgressView, CanvasStroke, AiCanvasGuess } from '../../shared/protocol.js';
export type Result<T=undefined> = Ack<T>;
export interface RoomOptions { now?:()=>number; random?:()=>number }
export interface PlayerState extends PlayerView { socketId:string|null; offlineAt:number|null }
export interface InternalBluff { id:string; playerKey:string; playerName:string; text:string; votes:string[] }
export interface RoomState extends Omit<RoomView,'players'|'puzzle'|'hints'|'progress'|'party'> {
 players:PlayerState[];
 puzzleId:string|null;
 hintsShown:number;
 playedIds:string[];
 winner:string|null;
 revealReason:'solved'|'host'|'exhausted'|null;
 offlineAt:number|null;
 startedAt:number|null;
 progress:ProgressView;
 drawerKey:string|null;
 strokes:CanvasStroke[];
 aiGuess:AiCanvasGuess|null;
 bluffs:InternalBluff[];
 truthVotes:string[];
 saboteurKey:string|null;
 sabotagedQuadrant:0|1|2|3|null;
 accusedVotes:{voterKey:string;voterName:string;suspectKey:string;suspectName:string}[];
 candidateWords:string[];
 solvedRankings:{playerKey:string;playerName:string;points:number;at:number}[];
 witnessKey:string|null;
 memoryDeadline:number|null;
 bestArtistVotes:Record<string,string>;
 currentFrame:number;
 totalFrames:number;
}
