import { useSyncExternalStore } from 'react';
import type { RoomView } from '@shared/protocol';

export interface GameState { room: RoomView | null; status: 'offline' | 'connecting' | 'connected'; joined: boolean; message: string | null; joinError: string | null }
let state: GameState = { room: null, status: 'offline', joined: false, message: null, joinError: null };
const listeners = new Set<() => void>();
export const getSnapshot = () => state;
export function updateState(patch: Partial<GameState>): void { state = { ...state, ...patch }; listeners.forEach(listener => listener()); }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useGame = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
export const notify = (message: string) => updateState({ message });
export const clearToast = () => updateState({ message: null });
