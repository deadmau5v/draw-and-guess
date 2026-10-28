/** Pure, server-owned Pictionary scoring. Never accepts client point values. */
export function correctGuessPoints(startedAt:number, submittedAt:number, turnSeconds:number, wrongGuesses:number):number {
 if(!Number.isFinite(startedAt)||!Number.isFinite(submittedAt)||!Number.isFinite(turnSeconds)||turnSeconds<=0||!Number.isSafeInteger(wrongGuesses)||wrongGuesses<0) throw new RangeError('Invalid round scoring inputs');
 const elapsed=Math.max(0,submittedAt-startedAt);
 const speed=Math.floor(50*Math.max(0,1-elapsed/(turnSeconds*1000)));
 return Math.max(70,100+speed-Math.min(30,wrongGuesses*5));
}
export const DRAWER_COOPERATIVE_POINTS=40;
