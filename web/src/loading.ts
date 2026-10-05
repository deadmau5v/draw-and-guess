import { useEffect, useSyncExternalStore } from 'react';

const tasks = new Map<symbol, string>();
const listeners = new Set<() => void>();
let snapshot = { active: false, label: '正在进入推理局…' };
const publish = () => {
  snapshot = { active: tasks.size > 0, label: [...tasks.values()].at(-1) ?? '正在进入推理局…' };
  listeners.forEach(listener => listener());
};
export function beginLoading(label = '正在加载…'): () => void {
  const id = Symbol(label);
  tasks.set(id, label); publish();
  return () => { if (tasks.delete(id)) publish(); };
}
export async function withLoading<T>(label: string, action: () => Promise<T>): Promise<T> {
  const finish = beginLoading(label);
  try { return await action(); } finally { finish(); }
}
export function usePageLoading(active: boolean, label: string): void {
  useEffect(() => { if (active) return beginLoading(label); }, [active, label]);
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useLoading = () => useSyncExternalStore(subscribe, () => snapshot, () => snapshot);

let finishRoute: (() => void) | null = null;
let routeTimer: ReturnType<typeof setTimeout> | null = null;
export function finishRouteLoading(): void {
  if (routeTimer) clearTimeout(routeTimer);
  routeTimer = null; finishRoute?.(); finishRoute = null;
}
export function beginRouteLoading(): void {
  finishRouteLoading();
  finishRoute = beginLoading('正在切换场景…');
  routeTimer = setTimeout(finishRouteLoading, 15000);
}
