import React from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { CandyButton, CandyNavigation } from 'candy-ui';
import type { CandyColor } from 'candy-ui';

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
  variant: CandyColor;
  appearance: 'solid' | 'outline' | 'soft';
} {
  if (tone === 'ghost' || variant === 'subtle') {
    return { variant: 'ghost', appearance: 'soft' };
  }
  if (variant === 'light') {
    const color = tone === 'green' ? 'green' : tone === 'yellow' ? 'yellow' : tone === 'red' ? 'red' : 'blue';
    return { variant: color, appearance: 'soft' };
  }
  switch (tone) {
    case 'green': return { variant: 'green', appearance: 'solid' };
    case 'yellow': return { variant: 'yellow', appearance: 'solid' };
    case 'red': return { variant: 'red', appearance: 'solid' };
    case 'grey': return { variant: 'gray', appearance: 'outline' };
    default: return { variant: 'blue', appearance: 'solid' };
  }
}

// Compatibility export for existing callers; CandyUI owns all control rendering.
export function GameButton({
  tone, color: _color, variant, size = 'md', fullWidth, leftSection, rightSection,
  component = 'button', className = '', children, type, href, ...rest
}: GameButtonProps) {
  const mapped = mapTone(tone, variant);
  const candySize = size === 'compact-xs' ? 'xs' : size;

  if (component === 'a') {
    // CandyButton has no polymorphic/link API. CandyNavigation renders a real
    // anchor, preserving href and browser link behavior without copying skins.
    const { onClick, disabled, style, 'aria-label': label } = rest;
    return (
      <CandyNavigation
        aria-label={label}
        className={className}
        style={fullWidth ? { width: '100%', ...style } : style}
        onClick={onClick as unknown as React.MouseEventHandler<HTMLElement>}
        items={[{
          value: 'link', href, disabled, icon: leftSection,
          label: <>{children}{rightSection}</>,
        }]}
      />
    );
  }

  return (
    <CandyButton
      {...rest}
      type={type ?? 'button'}
      variant={mapped.variant}
      appearance={mapped.appearance}
      size={candySize}
      shape="pill"
      fullWidth={fullWidth}
      leftIcon={leftSection}
      rightIcon={rightSection}
      className={className}
    >
      {children}
    </CandyButton>
  );
}
