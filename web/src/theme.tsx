import React from 'react';
import type { ReactNode } from 'react';
import { MantineProvider, createTheme } from '@mantine/core';

export const gameTheme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'lg',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  components: {
    Button: { defaultProps: { radius: 'xl', size: 'md' } },
    Paper: { defaultProps: { radius: 'lg', shadow: 'sm' } },
    Modal: {
      defaultProps: {
        centered: true,
        radius: 'lg',
        overlayProps: { backgroundOpacity: 0.65, blur: 4 },
        closeButtonProps: { 'aria-label': '关闭' },
      },
    },
    TextInput: { defaultProps: { radius: 'xl', size: 'md' } },
  },
});

export function GameProvider({ children }: { children: ReactNode }) {
  return <MantineProvider theme={gameTheme} forceColorScheme="light">{children}</MantineProvider>;
}
