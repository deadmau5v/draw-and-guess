import React from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { CandyButton } from 'candy-ui';

export type ButtonTone = 'blue' | 'green' | 'yellow' | 'red' | 'grey' | 'ghost';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface GameButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  tone?: ButtonTone;
  color?: string;
  variant?: 'filled' | 'light' | 'default' | 'subtle';
  size?: ButtonSize | 'compact-xs';
  fullWidth?: boolean;
  leftSection?: ReactNode;
  rightSection?: ReactNode;
  component?: 'button' | 'a';
  href?: string;
}

function mapTone(tone?: ButtonTone, variant?: string): {
  variant: 'blue' | 'green' | 'yellow' | 'pink' | 'purple' | 'ghost';
  appearance: 'solid' | 'outline' | 'soft';
} {
  if (tone === 'ghost' || variant === 'subtle') {
    return { variant: 'ghost', appearance: 'soft' };
  }
  if (variant === 'light') {
    const v = tone === 'green' ? 'green' : tone === 'yellow' ? 'yellow' : tone === 'red' ? 'pink' : 'blue';
    return { variant: v, appearance: 'soft' };
  }
  switch (tone) {
    case 'green': return { variant: 'green', appearance: 'solid' };
    case 'yellow': return { variant: 'yellow', appearance: 'solid' };
    case 'red': return { variant: 'pink', appearance: 'solid' };
    case 'grey': return { variant: 'ghost', appearance: 'outline' };
    case 'blue':
    default:
      return { variant: 'blue', appearance: 'solid' };
  }
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
  className = '',
  children,
  type,
  ...rest
}: GameButtonProps) {
  const mapped = mapTone(tone, variant);
  const candySize = size === 'compact-xs' ? 'xs' : size;

  if (component === 'a') {
    const { href, onClick } = rest as { href?: string; onClick?: React.MouseEventHandler<HTMLAnchorElement> };
    const classes = [
      'candy-btn',
      `candy-btn-${mapped.variant}`,
      `candy-btn-${candySize}`,
      'candy-btn-pill',
      `candy-btn-${mapped.appearance}`,
      fullWidth ? 'w-full' : '',
      className,
    ].filter(Boolean).join(' ');

    return (
      <a className={classes} href={href} onClick={onClick} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...rest.style }}>
        {leftSection && <span className="candy-btn-icon candy-btn-icon-left">{leftSection}</span>}
        <span>{children}</span>
        {rightSection && <span className="candy-btn-icon candy-btn-icon-right">{rightSection}</span>}
      </a>
    );
  }

  return (
    <CandyButton
      type={type ?? 'button'}
      variant={mapped.variant}
      appearance={mapped.appearance}
      size={candySize}
      shape="pill"
      fullWidth={fullWidth}
      leftIcon={leftSection}
      rightIcon={rightSection}
      className={className}
      {...rest}
    >
      {children}
    </CandyButton>
  );
}
