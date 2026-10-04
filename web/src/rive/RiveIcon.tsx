import React, { useState, useEffect } from 'react';
import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas';
import { TurtleIcon, TrophyIcon, FlameIcon, LightbulbIcon, DiceIcon } from '../icons/GameIcons';

export interface RiveIconProps {
  src?: string;
  artboard?: string;
  animations?: string | string[];
  stateMachines?: string | string[];
  autoplay?: boolean;
  size?: number | string;
  fallback?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  fit?: Fit;
  alignment?: Alignment;
}

/**
 * 通用 Rive 动效容器组件
 * 当 .riv 资源加载中或环境不支持 Canvas/WebGL 时，自动无缝呈现圆润饱满的彩色动态 SVG 兜底
 */
export function RiveIcon({
  src,
  artboard,
  animations,
  stateMachines,
  autoplay = true,
  size = 40,
  fallback,
  className = '',
  style = {},
  fit = Fit.Contain,
  alignment = Alignment.Center,
}: RiveIconProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // 如果没有提供 src，直接渲染 fallback
  if (!src) {
    return <span style={{ display: 'inline-flex', width: size, height: size, ...style }} className={className}>{fallback}</span>;
  }

  const { RiveComponent } = useRive({
    src,
    artboard,
    animations,
    stateMachines,
    autoplay,
    layout: new Layout({ fit, alignment }),
    onLoad: () => setIsLoaded(true),
    onLoadError: () => setHasError(true),
    onRiveReady: () => setIsLoaded(true),
  });

  const dimension = typeof size === 'number' ? `${size}px` : size;

  if (hasError || !RiveComponent) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: dimension,
          height: dimension,
          ...style,
        }}
        className={className}
      >
        {fallback}
      </span>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        width: dimension,
        height: dimension,
        verticalAlign: 'middle',
        overflow: 'hidden',
        ...style,
      }}
      className={`rive-icon-wrap ${className}`}
    >
      {/* 资源未就绪时的平滑占位兜底 */}
      {!isLoaded && fallback && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {fallback}
        </div>
      )}
      <RiveComponent
        style={{
          width: '100%',
          height: '100%',
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.25s ease-in',
        }}
      />
    </div>
  );
}

/**
 * 游戏吉祥物：海龟小侦探 (Interactive Turtle Detective)
 * 支持表情心情切换：idle (待机)、thinking (思考中)、happy (破案成功欢呼)、puzzled (困惑不确定)
 */
export function MascotDetective({
  size = 56,
  mood = 'idle',
  rivSrc,
  className = '',
}: {
  size?: number | string;
  mood?: 'idle' | 'thinking' | 'happy' | 'puzzled';
  rivSrc?: string;
  className?: string;
}) {
  return (
    <RiveIcon
      src={rivSrc}
      size={size}
      stateMachines="State Machine 1"
      animations={mood}
      className={`mascot-detective mood-${mood} ${className}`}
      fallback={
        <div
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TurtleIcon size={size} animate />
          {mood === 'thinking' && (
            <div
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                transform: 'scale(0.8)',
              }}
            >
              <LightbulbIcon size={18} animate />
            </div>
          )}
          {mood === 'happy' && (
            <div
              style={{
                position: 'absolute',
                top: -8,
                right: -8,
                transform: 'scale(0.8)',
              }}
            >
              <TrophyIcon size={20} animate />
            </div>
          )}
        </div>
      }
    />
  );
}
