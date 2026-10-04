export class Lru<K,V> {
 private readonly entries=new Map<K,V>();
 private readonly capacity:number;
 constructor(capacity=500) { if(!Number.isInteger(capacity)||capacity<1) throw new Error('容量必须为正整数'); this.capacity=capacity; }
 get(key:K):V|undefined { if(!this.entries.has(key)) return undefined; const v=this.entries.get(key)!; this.entries.delete(key); this.entries.set(key,v); return v; }
 set(key:K,value:V):void { this.entries.delete(key); this.entries.set(key,value); if(this.entries.size>this.capacity) this.entries.delete(this.entries.keys().next().value!); }
}
