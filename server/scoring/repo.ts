import type { DatabaseSync } from 'node:sqlite';
import { resolveAvatar } from '../../shared/avatars.js';
import type { LeaderboardEntry, LeaderboardResponse } from '../../shared/protocol.js';

type AwardInput = { id: string; playerKey: string; name: string; avatar?: string; puzzleId: string; normText: string; proximity: number };
export class ScoreRepo {
  private db: DatabaseSync;
  constructor(db: DatabaseSync) { this.db = db; }

  award(input: AwardInput): number {
    if (!Number.isFinite(input.proximity) || input.proximity < 0 || input.proximity > 100) {
      throw new RangeError('proximity must be a finite number between 0 and 100');
    }
    const points = Math.round(input.proximity / 10);
    const now = Date.now();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const inserted = this.db.prepare(`INSERT INTO score_awards(id,player_key,puzzle_id,norm_text,points,proximity,created_at)
        VALUES(?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`)
        .run(input.id, input.playerKey, input.puzzleId, input.normText, points, input.proximity, now);
      if (Number(inserted.changes) === 0) {
        this.db.exec('COMMIT');
        return 0;
      }
      this.db.prepare(`INSERT INTO player_scores(player_key,name,avatar,points,questions,best_proximity,updated_at)
        VALUES(?,?,?,?,1,?,?) ON CONFLICT(player_key) DO UPDATE SET
        name=excluded.name, avatar=excluded.avatar, points=player_scores.points+excluded.points,
        questions=player_scores.questions+1, best_proximity=MAX(player_scores.best_proximity,excluded.best_proximity), updated_at=excluded.updated_at`)
        .run(input.playerKey, input.name, resolveAvatar(input.avatar), points, input.proximity, now);
      this.db.exec('COMMIT');
      return points;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /** Atomically credit the first solve and its cooperative drawer award once per round.
   * No answer text is stored. A restored room uses the same gameId, not a new UUID.
   */
  awardRound(input:{roomCode:string;gameId:string;round:number;solver:{key:string;name:string;avatar?:string};drawer?:{key:string;name:string;avatar?:string};points:number}):{solverPoints:number;drawerPoints:number} {
    if(!input.roomCode||!input.gameId||!Number.isSafeInteger(input.round)||input.round<1||!Number.isInteger(input.points)||input.points<70||input.points>150||!input.solver.key||input.solver.key===input.drawer?.key) throw new RangeError('Invalid round award');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const prior=this.db.prepare("SELECT 1 FROM round_score_awards WHERE room_code=? AND game_id=? AND round=? AND role='solver'").get(input.roomCode,input.gameId,input.round);
      if(prior) {this.db.exec('COMMIT');return {solverPoints:0,drawerPoints:0};}
      const now=Date.now();
      const credit=(role:'solver'|'drawer',player:{key:string;name:string;avatar?:string},points:number)=>{
        this.db.prepare('INSERT INTO round_score_awards(room_code,game_id,round,role,player_key,points,created_at) VALUES(?,?,?,?,?,?,?)').run(input.roomCode,input.gameId,input.round,role,player.key,points,now);
        this.db.prepare(`INSERT INTO player_scores(player_key,name,avatar,points,questions,best_proximity,updated_at)
          VALUES(?,?,?,?,0,0,?) ON CONFLICT(player_key) DO UPDATE SET name=excluded.name,avatar=excluded.avatar,points=player_scores.points+excluded.points,updated_at=excluded.updated_at`)
          .run(player.key,player.name,resolveAvatar(player.avatar),points,now);
      };
      credit('solver',input.solver,input.points);
      if(input.drawer) credit('drawer',input.drawer,40);
      this.db.exec('COMMIT');
      return {solverPoints:input.points,drawerPoints:input.drawer?40:0};
    } catch(error) {this.db.exec('ROLLBACK');throw error;}
  }

  playerPoints(key: string): number {
    return Number(this.db.prepare('SELECT points FROM player_scores WHERE player_key=?').get(key)?.points ?? 0);
  }

  leaderboard(playerKey?: string, limit = 50): LeaderboardResponse {
    const ranked = `WITH ranked AS (SELECT player_key, name, avatar, points, questions, best_proximity,
      ROW_NUMBER() OVER (ORDER BY points DESC,best_proximity DESC,updated_at ASC,player_key ASC) AS rank
      FROM player_scores)`;
    const publicColumns = 'rank,name,avatar,points,questions,best_proximity';
    const toEntry = (row: Record<string, unknown>): LeaderboardEntry => ({
      rank: Number(row.rank), name: String(row.name), avatar: resolveAvatar(String(row.avatar)),
      points: Number(row.points), questions: Number(row.questions), bestProximity: Number(row.best_proximity),
    });
    const cappedLimit = Number.isFinite(limit) ? Math.min(100, Math.max(0, Math.floor(limit))) : 50;
    const entries = this.db.prepare(`${ranked} SELECT ${publicColumns} FROM ranked ORDER BY rank LIMIT ?`)
      .all(cappedLimit).map(toEntry);
    const self = playerKey === undefined ? undefined : this.db.prepare(`${ranked} SELECT ${publicColumns} FROM ranked WHERE player_key=?`).get(playerKey);
    return { entries, self: self ? toEntry(self) : null };
  }
}
