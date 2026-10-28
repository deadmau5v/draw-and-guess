import type { CreateRoomRequest, CreateRoomResponse, HealthResponse, PuzzleListQuery, PuzzlePublic, PuzzleSummary, RoomLobbySummary, LeaderboardResponse } from '@shared/protocol';
import { readPlayerAvatar } from './avatars';

// Request owners render their own loading state. Reads must never cover the whole scene.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { msg?: string; message?: string; error?: string } | null;
    throw new Error(body?.msg || body?.message || body?.error || `请求失败（${response.status}），请稍后重试`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  puzzles(query: PuzzleListQuery = {}, signal?: AbortSignal): Promise<PuzzleSummary[]> {
    const params = new URLSearchParams();
    if (query.sort) params.set('sort', query.sort);
    if (query.tag) params.set('tag', query.tag);
    if (query.q) params.set('q', query.q);
    params.set('nsfl', query.excludeNsfl === false ? '1' : '0');
    if (query.limit !== undefined) params.set('limit', String(query.limit));
    if (query.offset !== undefined) params.set('offset', String(query.offset));
    return request(`/api/puzzles?${params}`, { signal });
  },
  puzzle(id: string): Promise<PuzzlePublic> { return request(`/api/puzzles/${encodeURIComponent(id)}`); },
  createRoom(body: CreateRoomRequest): Promise<CreateRoomResponse> { return request('/api/rooms', { method: 'POST', body: JSON.stringify({ ...body, avatar: body.avatar ?? readPlayerAvatar() }) }); },
  rooms(signal?: AbortSignal): Promise<RoomLobbySummary[]> { return request('/api/rooms', { signal, cache: 'no-store' }); },
  leaderboard(playerKey?: string, signal?: AbortSignal): Promise<LeaderboardResponse> {
    const params = new URLSearchParams(); if (playerKey) params.set('playerKey', playerKey);
    return request(`/api/leaderboard${params.size ? `?${params}` : ''}`, { signal, cache: 'no-store' });
  },
  health(): Promise<HealthResponse> { return request('/api/health'); },
};
