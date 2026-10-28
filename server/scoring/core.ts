import { LIMITS } from '../../shared/protocol.js';

/** Pure, server-owned Pictionary scoring: maxPlayers (15) for 1st place, 14 for 2nd, 13 for 3rd... */
export function correctGuessPoints(startedAt:number, submittedAt:number, turnSeconds:number, wrongGuesses:number, solvedOrder = 0):number {
 if(!Number.isFinite(startedAt)||!Number.isFinite(submittedAt)||!Number.isFinite(turnSeconds)||turnSeconds<=0||!Number.isSafeInteger(wrongGuesses)||wrongGuesses<0||!Number.isSafeInteger(solvedOrder)||solvedOrder<0) throw new RangeError('Invalid round scoring inputs');
 return Math.max(1, LIMITS.maxPlayers - solvedOrder);
}
export const DRAWER_COOPERATIVE_POINTS = 5;
