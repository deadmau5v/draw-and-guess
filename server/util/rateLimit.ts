export interface RateLimitOptions { now?:()=>number; minIntervalMs?:number; maxPerMinute?:number }
export class RateLimiter {
 private readonly times=new Map<string,number[]>();
 private readonly now:()=>number;
 private readonly interval:number;
 private readonly max:number;
 constructor(opts:RateLimitOptions={}) { this.now=opts.now??Date.now; this.interval=opts.minIntervalMs??2000; this.max=opts.maxPerMinute??20; }
 check(key:string):boolean {
  const now=this.now(); const times=(this.times.get(key)??[]).filter(t=>t>now-60000);
  this.times.set(key,times);
  return times.length<this.max && (times.length===0 || now-times[times.length-1]>=this.interval);
 }
 commit(key:string):void {
  const now=this.now(); const times=(this.times.get(key)??[]).filter(t=>t>now-60000);
  times.push(now);this.times.set(key,times);
 }
 allow(key:string):boolean {
  if(!this.check(key)) return false;
  this.commit(key);return true;
 }
}
