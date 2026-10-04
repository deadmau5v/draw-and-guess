import React from 'react';
import type { ReactNode } from 'react';
import { MantineProvider, createTheme } from '@mantine/core';

export const gameTheme = createTheme({
  primaryColor: 'teal', primaryShade: 4, defaultRadius: 'md',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
  colors: { dark: ['#e2e8f0', '#b8c6d8', '#94a3b8', '#748398', '#475569', '#334155', '#243247', '#172338', '#111c2e', '#0b1423'] },
  components: {
    Button: { defaultProps: { size: 'sm' } },
    Paper: { defaultProps: { p: 'lg', radius: 'md', shadow: 'none' } },
    Modal: { defaultProps: { centered: true, transitionProps: { duration: 0 }, overlayProps: { backgroundOpacity: 0.65 }, closeButtonProps: { 'aria-label': '关闭' } } },
  },
});
export function GameProvider({ children }: { children: ReactNode }) {
  return <MantineProvider theme={gameTheme} forceColorScheme="dark">{children}</MantineProvider>;
}
