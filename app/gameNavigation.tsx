'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { beginRouteLoading, finishRouteLoading, usePageLoading } from '../web/src/loading';

export function useGameRouter() {
  const router = useRouter();
  return { ...router, push: (href: string) => {
    if (new URL(href, window.location.origin).pathname !== window.location.pathname) beginRouteLoading();
    router.push(href);
  } };
}
export function GameRouteTransition() {
  const pathname = usePathname();
  useEffect(() => { finishRouteLoading(); }, [pathname]);
  return null;
}
export function LoadingScene() {
  usePageLoading(true, '正在切换场景…');
  return null;
}
