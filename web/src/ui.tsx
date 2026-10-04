import React from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * 全站唯一的按钮组件：外观来自 Kenney UI Pack（CC0）的 button_rectangle_depth_gradient，
 * 通过 CSS border-image 九宫格拉伸。所有页面请使用 GameButton，禁止再直接使用 Mantine Button。
 */
export type ButtonTone = 'blue' | 'green' | 'yellow' | 'red' | 'grey' | 'ghost';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const colorToTone: Record<string, ButtonTone> = {
  teal: 'green',
  green: 'green',
  yellow: 'yellow',
  red: 'red',
  gray: 'grey',
  grey: 'grey',
  cyan: 'blue',
  blue: 'blue',
};

export interface GameButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  /** 直接指定色调；未指定时由 color/variant 推导 */
  tone?: ButtonTone;
  /** 兼容旧写法：Mantine 颜色名 */
  color?: string;
  /** 兼容旧写法：light/default 视为灰色按钮，subtle 视为无底色文字按钮 */
  variant?: 'filled' | 'light' | 'default' | 'subtle';
  size?: ButtonSize | 'compact-xs';
  fullWidth?: boolean;
  leftSection?: ReactNode;
  rightSection?: ReactNode;
  component?: 'button' | 'a';
  href?: string;
}

function resolveTone(props: Pick<GameButtonProps, 'tone' | 'color' | 'variant'>): ButtonTone {
  if (props.tone) return props.tone;
  if (props.variant === 'subtle') return 'ghost';
  if (props.variant === 'light' || props.variant === 'default') return 'grey';
  return colorToTone[props.color ?? 'blue'] ?? 'blue';
}

export function GameButton({
  tone,
  color,
  variant,
  size = 'md',
  fullWidth,
  leftSection,
  rightSection,
  component = 'button',
  className,
  children,
  type,
  ...rest
}: GameButtonProps) {
  const resolvedSize = size === 'compact-xs' ? 'xs' : size;
  const classes = [
    'game-btn',
    `game-btn--${resolveTone({ tone, color, variant })}`,
    `game-btn--${resolvedSize}`,
    fullWidth ? 'game-btn--full' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  const inner = (
    <>
      {leftSection ? <span className="game-btn__icon">{leftSection}</span> : null}
      <span className="game-btn__label">{children}</span>
      {rightSection ? <span className="game-btn__icon">{rightSection}</span> : null}
    </>
  );

  if (component === 'a') {
    const { href, onClick } = rest as { href?: string; onClick?: React.MouseEventHandler<HTMLAnchorElement> };
    return <a className={classes} href={href} onClick={onClick}>{inner}</a>;
  }
  return <button type={type ?? 'button'} className={classes} {...rest}>{inner}</button>;
}
