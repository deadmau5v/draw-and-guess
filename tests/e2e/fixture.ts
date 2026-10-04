import { openDb, seedIfEmpty } from '../../server/db.js';
import { PuzzleRepo } from '../../server/puzzles/repo.js';
import { RoomManager } from '../../server/rooms/roomManager.js';
import type { Config } from '../../server/config.js';
import type { JudgeService } from '../../server/jev/judge.js';
export const bottom = '绝密汤底：酒保用枪治好了打嗝';
export function fixture(judge?: JudgeService) {
 const db = openDb(':memory:');
 seedIfEmpty(db, [{id:'test-1',title:'酒保',surface:'他道谢后离开。',bottom,hints:['他没有受伤'],difficulty:1,tags:[],nsfl:false,source:{key:'test',repo:'local',url:'local',license:'MIT'},alsoIn:[]}]);
 const config: Config = {apiKey:'',judgeConfigured:false,model:'fake',judgeThreshold:0.4,solveThreshold:0.55,port:3001,dbPath:':memory:'};
 return {config, db, repo:new PuzzleRepo(db), rooms:new RoomManager(), judge:judge ?? {judgeQuestion:async()=>({verdict:'是',confidence:1}),judgeSolution:async()=>({outcome:'破解成功',confidence:1}),totalCost:()=>0.25}};
}
