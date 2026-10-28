import { expect, it } from 'vitest';
import { RoomManager } from '../../server/rooms/roomManager.js';
import type { Ack } from '../../shared/protocol.js';
function value<T>(r: Ack<T>): T { if (!r.ok) throw Error(r.msg);return r.value; }
it('任意在线玩家可开启提示，广播开启者与轮次，新题清除通知且不能超量', () => {
 const rooms=new RoomManager();const code=value(rooms.createRoom('甲','a')).code;
 value(rooms.join(code,'甲','a','sa'));value(rooms.join(code,'乙','b','sb'));
 value(rooms.start(code,'a','p',1));
 value(rooms.showHint(code,'b',1));
 expect(value(rooms.toPublicView(code)).hintAnnouncement).toMatchObject({id:expect.any(String),round:1,index:1,playerKey:'b',playerName:'乙'});
 expect(rooms.showHint(code,'a',1)).toMatchObject({ok:false,code:'INVALID'});
 expect(rooms.showHint(code,'absent',1)).toMatchObject({ok:false,code:'NOT_IN_ROOM'});
 value(rooms.reveal(code,'a'));value(rooms.start(code,'a','p',1));
 expect(value(rooms.toPublicView(code)).hintAnnouncement).toBeNull();
});
