import { describe, expect, it, vi } from 'vitest';
import { RoomManager } from '../../server/rooms/roomManager.js';
import { createJevJudge } from '../../server/jev/judge.js';
import { openDb, seedIfEmpty } from '../../server/db.js';
import { PuzzleRepo } from '../../server/puzzles/repo.js';
import type { Ack, SeedPuzzle } from '../../shared/protocol.js';

function unwrap<T>(r: Ack<T>): T {
  if (!r.ok) throw new Error(r.msg);
  return r.value;
}

const samplePuzzle: SeedPuzzle = {
  id: 'draw-animal-01',
  title: '萌趣动物 · 3字词',
  surface: '画题提示：3个字 · 分类【萌趣动物】',
  bottom: '大熊猫',
  hints: ['国宝', '爱吃竹子'],
  difficulty: 1,
  tags: ['动物', '日常'],
  nsfl: false,
  source: { key: 'draw-bank', repo: 'test', url: 'test', license: 'MIT' },
  alsoIn: [],
};

const testConfig = {
  apiKey: 'test-only',
  judgeConfigured: true,
  model: 'typesafe/jev-1.13',
  judgeThreshold: 0.4,
  solveThreshold: 0.55,
  port: 3001,
  dbPath: ':memory:',
};

describe('你画我猜核心状态机、设备识别、10大派对模式与JEV多模态测试', () => {
  it('记录并更新玩家联机设备类型（桌面 / iPad Apple Pencil），断线重连保留状态', () => {
    const rm = new RoomManager();
    const code = unwrap(rm.createRoom('画手阿呆', 'p-host', undefined, {
      kind: 'desktop',
      os: 'macOS',
      browser: 'Chrome',
      label: 'macOS · Chrome',
    })).code;
    unwrap(rm.join(code, '画手阿呆', 'p-host', 'sock-host', undefined, {
      kind: 'desktop',
      os: 'macOS',
      browser: 'Chrome',
      label: 'macOS · Chrome',
    }));
    unwrap(rm.join(code, '平板画师', 'p-ipad', 'sock-ipad-1', undefined, {
      kind: 'tablet',
      os: 'iPadOS',
      browser: 'Safari',
      label: 'iPadOS · Safari (触屏)',
    }));

    const view1 = unwrap(rm.toPublicView(code));
    expect(view1.players.find(p => p.key === 'p-host')?.device?.label).toBe('macOS · Chrome');
    expect(view1.players.find(p => p.key === 'p-ipad')?.device?.kind).toBe('tablet');

    // 断线后携带压感笔重连，自动升级设备标识并保持在线
    unwrap(rm.disconnect('sock-ipad-1'));
    expect(unwrap(rm.toPublicView(code)).players.find(p => p.key === 'p-ipad')?.online).toBe(false);

    unwrap(rm.join(code, '平板画师', 'p-ipad', 'sock-ipad-2', undefined, {
      kind: 'stylus',
      os: 'iPadOS',
      browser: 'Safari',
      label: 'iPadOS · Safari · 压感笔',
    }));
    const view2 = unwrap(rm.toPublicView(code));
    const ipadPlayer = view2.players.find(p => p.key === 'p-ipad');
    expect(ipadPlayer?.online).toBe(true);
    expect(ipadPlayer?.device?.kind).toBe('stylus');
    expect(ipadPlayer?.device?.label).toBe('iPadOS · Safari · 压感笔');
  });

  it('支持画板笔触同步、撤销、清空以及 Gartic 高仿山寨 (knock-off) 递减帧限时与残缺补全初始线', () => {
    const rm = new RoomManager();
    const code = unwrap(rm.createRoom('房主', 'p1')).code;
    unwrap(rm.join(code, '房主', 'p1', 's1'));
    unwrap(rm.join(code, '队友', 'p2', 's2'));

    // 残缺补全模式自动注入初始残缺线条
    unwrap(rm.updateSettings(code, 'p1', { partyMode: 'complement' }));
    unwrap(rm.start(code, 'p1', 'draw-1', 2));
    const compView = unwrap(rm.toPublicView(code));
    expect(compView.strokes?.length).toBe(1);
    expect(compView.strokes?.[0]?.playerName).toBe('残缺初始线');

    // 添加笔触、撤销与清空
    const s1 = rm.addStroke(code, 'p1', {
      round: 1,
      tool: 'pen',
      color: '#ff3b30',
      size: 12,
      points: [{ x: 100, y: 120, p: 0.7 }, { x: 240, y: 260, p: 0.8 }],
    });
    expect(s1.ok).toBe(true);
    expect(unwrap(rm.toPublicView(code)).strokes?.length).toBe(2);

    const undone = rm.undoStroke(code, 'p1', 1);
    expect(undone.ok).toBe(true);
    expect(unwrap(rm.toPublicView(code)).strokes?.length).toBe(1);

    const cleared = rm.clearCanvas(code, 'p1', 1);
    expect(cleared.ok).toBe(true);
    expect(unwrap(rm.toPublicView(code)).strokes?.length).toBe(0);

    // 切换到 knock-off 模式并开启下一局，测试 60 -> 30 -> 15 -> 8 秒帧递减
    unwrap(rm.reveal(code, 'p1'));
    unwrap(rm.updateSettings(code, 'p1', { partyMode: 'knock-off' }));
    unwrap(rm.start(code, 'p1', 'draw-2', 2));
    expect(unwrap(rm.toPublicView(code)).party?.knockOffSeconds).toBe(60);
    unwrap(rm.advanceFrame(code, 'p1', 2));
    expect(unwrap(rm.toPublicView(code)).party?.knockOffSeconds).toBe(30);
    unwrap(rm.advanceFrame(code, 'p1', 2));
    expect(unwrap(rm.toPublicView(code)).party?.knockOffSeconds).toBe(15);
    unwrap(rm.advanceFrame(code, 'p1', 2));
    expect(unwrap(rm.toPublicView(code)).party?.knockOffSeconds).toBe(8);
  });

  it('支持 Drawful 妙笔生谎（提交假答案 + 全员盲投 + 骗票每个 +2 分）', () => {
    const rm = new RoomManager();
    const code = unwrap(rm.createRoom('画手A', 'p1')).code;
    unwrap(rm.join(code, '画手A', 'p1', 's1'));
    unwrap(rm.join(code, '骗子B', 'p2', 's2'));
    unwrap(rm.join(code, '吃瓜C', 'p3', 's3'));

    unwrap(rm.updateSettings(code, 'p1', { partyMode: 'drawful' }));
    unwrap(rm.start(code, 'p1', 'drawful-01', 2));

    // p2 和 p3 提交假答案
    expect(rm.submitBluff(code, 'p2', '加班到秃头的程序员企鹅').ok).toBe(true);
    expect(rm.submitBluff(code, 'p3', '刚从煤矿出来的北极熊').ok).toBe(true);

    const choices = unwrap(rm.toPublicView(code)).party?.drawfulChoices ?? [];
    expect(choices.length).toBe(2);
    const p2Choice = choices.find(c => c.text === '加班到秃头的程序员企鹅');
    expect(p2Choice).toBeDefined();

    // p3 被 p2 的假答案骗了，投票给 p2 的假答案 -> p2 获得 +2 骗票分
    expect(rm.submitPartyVote(code, 'p3', p2Choice!.id).ok).toBe(true);
    const p2View = unwrap(rm.toPublicView(code)).players.find(p => p.key === 'p2');
    expect(p2View?.roundPoints).toBe(2);
  });

  it('支持 猜拆画画 (doodle-puzzle) 四象限分配、内鬼指派与投票抓内鬼，以及 妙笔神猜 (pictomania) 16词竞速', () => {
    const rm = new RoomManager();
    const code = unwrap(rm.createRoom('P1', 'p1')).code;
    unwrap(rm.join(code, 'P1', 'p1', 's1'));
    unwrap(rm.join(code, 'P2', 'p2', 's2'));
    unwrap(rm.join(code, 'P3', 'p3', 's3'));

    unwrap(rm.updateSettings(code, 'p1', { partyMode: 'doodle-puzzle' }));
    unwrap(rm.start(code, 'p1', 'draw-1', 2));
    const party1 = unwrap(rm.toPublicView(code)).party;
    expect(party1?.mode).toBe('doodle-puzzle');
    expect(party1?.quadrantOwners?.length).toBe(3);
    expect(party1?.saboteurName).toBeNull(); // 揭晓前绝不公开内鬼身份

    // 投中真内鬼 +3 分
    const internalRoom = unwrap(rm.getRoom(code));
    const realSaboteur = internalRoom.saboteurKey!;
    const realSaboteurName = unwrap(rm.toPublicView(code)).players.find(p => p.key === realSaboteur)?.name;
    const voter = ['p1', 'p2', 'p3'].find(k => k !== realSaboteur)!;
    expect(rm.submitPartyVote(code, voter, realSaboteur).ok).toBe(true);
    expect(unwrap(rm.toPublicView(code)).players.find(p => p.key === voter)?.roundPoints).toBe(3);

    // 揭晓后公开 saboteurName
    unwrap(rm.reveal(code, 'p1'));
    expect(unwrap(rm.toPublicView(code)).party?.saboteurName).toBe(realSaboteurName);

    // 切换到妙笔神猜 pictomania：公开16个易混淆词
    unwrap(rm.updateSettings(code, 'p1', { partyMode: 'pictomania' }));
    unwrap(rm.start(code, 'p1', 'draw-2', 2));
    const party2 = unwrap(rm.toPublicView(code)).party;
    expect(party2?.mode).toBe('pictomania');
    expect(party2?.candidateWords?.length).toBe(16);
  });

  it('JEV 多模态识图将 base64 PNG 作为 image_url 块发送至 OpenRouter decisions state 数组，且支持精确匹配短路判题', async () => {
    const db = openDb(':memory:');
    seedIfEmpty(db, [samplePuzzle]);
    const secretPuzzle = new PuzzleRepo(db).getSecret(samplePuzzle.id)!;

    const capturedBodies: unknown[] = [];
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      capturedBodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({
        answers: {
          similarity: { score: 4 },
          impression: { choice: '传神佳作' },
        },
        usage: { cost: 0.01 },
      }));
    });

    const judge = createJevJudge(testConfig, db, mockFetch);

    // 1. 精确答案短路：无需消耗远端请求即可瞬间判定破解成功
    const exact = await judge.judgeSolution(secretPuzzle, '大熊猫');
    expect(exact.outcome).toBe('破解成功');
    expect(exact.confidence).toBe(1);
    expect(capturedBodies.length).toBe(0);

    // 2. 多模态识图：传入合法 base64 PNG Data URL，验证 state 数组中包含 { type: 'image_url', image_url: { url } }
    const validPngDataUrl = 'data:image/png;base64,' + 'A'.repeat(120);
    const aiRes = await judge.recognizeCanvas(secretPuzzle, [], validPngDataUrl);
    expect(aiRes.similarity).toBeGreaterThanOrEqual(80);
    expect(capturedBodies.length).toBe(1);
    const sent = capturedBodies[0] as { state: unknown[] };
    expect(Array.isArray(sent.state)).toBe(true);
    expect(sent.state.some(item => typeof item === 'object' && item !== null && (item as { type?: string }).type === 'image_url')).toBe(true);
    db.close();
  });
});
