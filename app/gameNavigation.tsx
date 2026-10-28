'use client';
import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { beginRouteLoading, finishRouteLoading } from '../web/src/loading';
import { PageContainer, SectionLoading } from '../web/src/PageContainer';

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
  return <PageContainer><SectionLoading label="正在切换场景…" skeleton /></PageContainer>;
}
