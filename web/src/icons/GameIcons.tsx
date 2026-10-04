import React from 'react';
import './icons.css';

export interface GameIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  animate?: boolean;
}

// 辅助包装函数，处理默认尺寸与动效 class
function withDefaults(size?: number | string) {
  const s = size ?? 20;
  return {
    width: s,
    height: s,
  };
}

/** 1. TurtleIcon - 可爱圆润的小海龟（带微浮动与呼吸） */
export function TurtleIcon({ size = 24, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-float' : ''} ${className}`}
      {...props}
    >
      <defs>
        <radialGradient id="turtleShell" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="70%" stopColor="#059669" />
          <stop offset="100%" stopColor="#047857" />
        </radialGradient>
        <linearGradient id="turtleSkin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a7f3d0" />
          <stop offset="100%" stopColor="#6ee7b7" />
        </linearGradient>
      </defs>
      {/* 四肢与尾巴 */}
      <circle cx="7" cy="11" r="3.2" fill="url(#turtleSkin)" />
      <circle cx="25" cy="11" r="3.2" fill="url(#turtleSkin)" />
      <circle cx="8" cy="22" r="3" fill="url(#turtleSkin)" />
      <circle cx="24" cy="22" r="3" fill="url(#turtleSkin)" />
      <path d="M16 26 C15 28 17 28 16 29" stroke="url(#turtleSkin)" strokeWidth="2.5" strokeLinecap="round" />
      {/* 头部 */}
      <g className={animate ? 'anim-wiggle' : ''} style={{ transformOrigin: '16px 8px' }}>
        <ellipse cx="16" cy="7.5" rx="4.5" ry="4" fill="url(#turtleSkin)" />
        {/* 眼睛 */}
        <circle cx="14" cy="6.8" r="0.9" fill="#0f172a" />
        <circle cx="18" cy="6.8" r="0.9" fill="#0f172a" />
        <circle cx="14.3" cy="6.4" r="0.3" fill="#ffffff" />
        <circle cx="18.3" cy="6.4" r="0.3" fill="#ffffff" />
        {/* 害羞红晕 */}
        <ellipse cx="12.5" cy="8.5" rx="0.8" ry="0.5" fill="#f43f5e" opacity="0.6" />
        <ellipse cx="19.5" cy="8.5" rx="0.8" ry="0.5" fill="#f43f5e" opacity="0.6" />
      </g>
      {/* 龟壳 */}
      <ellipse cx="16" cy="16.5" rx="9" ry="8.5" fill="url(#turtleShell)" stroke="#065f46" strokeWidth="1.2" />
      {/* 龟壳花纹 */}
      <path
        d="M16 11 L20 14 L20 19 L16 22 L12 19 L12 14 Z"
        fill="#10b981"
        stroke="#065f46"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="13.5" r="1.5" fill="#fef08a" opacity="0.8" />
    </svg>
  );
}

/** 2. SoupIcon - 冒着热气的美味汤碗（带上升蒸汽） */
export function SoupIcon({ size = 24, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-float' : ''} ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="bowlGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id="soupGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      {/* 蒸汽 */}
      <path
        d="M11 9 C10 6 12 5 11 2"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeLinecap="round"
        className={animate ? 'anim-wave-1' : ''}
        opacity="0.85"
      />
      <path
        d="M16 8 C15 5 17 4 16 1"
        stroke="#5eead4"
        strokeWidth="2"
        strokeLinecap="round"
        className={animate ? 'anim-wave-2' : ''}
        opacity="0.9"
      />
      <path
        d="M21 9 C20 6 22 5 21 2"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeLinecap="round"
        className={animate ? 'anim-wave-1' : ''}
        opacity="0.85"
      />
      {/* 汤水 */}
      <ellipse cx="16" cy="15" rx="11" ry="3.5" fill="url(#soupGrad)" stroke="#d97706" strokeWidth="1" />
      {/* 碗身 */}
      <path
        d="M5 15 C5 24 10 27 16 27 C22 27 27 24 27 15"
        fill="url(#bowlGrad)"
        stroke="#0369a1"
        strokeWidth="1.8"
      />
      {/* 碗高光 */}
      <path
        d="M8 18 C8.5 22.5 12 24.5 16 24.5"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
      {/* 碗底座 */}
      <rect x="12" y="27" width="8" height="2" rx="1" fill="#0284c7" />
    </svg>
  );
}

/** 3. SparkleIcon - 饱满四角闪烁星（自转 + 闪光） */
export function SparkleIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-sparkle' : ''} ${className}`}
      {...props}
    >
      <defs>
        <radialGradient id="sparkleGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#fef08a" />
          <stop offset="80%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
      </defs>
      {/* 饱满四角星 */}
      <path
        d="M12 2 C12 7.5 16.5 12 22 12 C16.5 12 12 16.5 12 22 C12 16.5 7.5 12 2 12 C7.5 12 12 7.5 12 2 Z"
        fill="url(#sparkleGrad)"
        stroke="#fef08a"
        strokeWidth="0.8"
      />
      {/* 旁边的小星光点 */}
      <circle cx="19" cy="5" r="1.5" fill="#fef08a" />
      <circle cx="5" cy="18" r="1.2" fill="#5eead4" />
    </svg>
  );
}

/** 4. CompassIcon - 圆润指南针（指针灵动摇摆） */
export function CompassIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-pulse' : ''} ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="compRing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="compBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      {/* 外圈金环 */}
      <circle cx="12" cy="12" r="10" fill="url(#compRing)" stroke="#d97706" strokeWidth="1" />
      {/* 内表盘 */}
      <circle cx="12" cy="12" r="7.5" fill="url(#compBg)" />
      {/* 表盘小刻度点 */}
      <circle cx="12" cy="5.5" r="0.8" fill="#5eead4" />
      <circle cx="12" cy="18.5" r="0.8" fill="#94a3b8" />
      <circle cx="5.5" cy="12" r="0.8" fill="#94a3b8" />
      <circle cx="18.5" cy="12" r="0.8" fill="#94a3b8" />
      {/* 摇摆的红蓝指针 */}
      <g className={animate ? 'anim-needle' : ''} style={{ transformOrigin: '12px 12px' }}>
        {/* 北针红 */}
        <polygon points="12,6 14.5,12 12,11 9.5,12" fill="#ef4444" />
        {/* 南针白/青 */}
        <polygon points="12,18 14.5,12 12,13 9.5,12" fill="#38bdf8" />
        {/* 中心轴 */}
        <circle cx="12" cy="12" r="1.8" fill="#ffffff" stroke="#0f172a" strokeWidth="0.8" />
      </g>
    </svg>
  );
}

/** 5. BookIcon - 饱满彩色厚书本（书页微浮动） */
export function BookIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-float' : ''} ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="bookCover" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id="bookPage" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      {/* 书本外壳 */}
      <rect x="3" y="4" width="18" height="16" rx="3.5" fill="url(#bookCover)" stroke="#0369a1" strokeWidth="1" />
      {/* 书脊阴影 */}
      <rect x="3" y="4" width="3.5" height="16" rx="1.5" fill="#0369a1" />
      {/* 翻开的书页质感 */}
      <path
        d="M6.5 6 C9 5.5 11 6 12 7 C13 6 15 5.5 18 6 L18 17 C15 16.5 13 17 12 18 C11 17 9 16.5 6.5 17 Z"
        fill="url(#bookPage)"
      />
      {/* 中缝 */}
      <line x1="12" y1="7" x2="12" y2="18" stroke="#cbd5e1" strokeWidth="1" />
      {/* 页面文字横线 */}
      <line x1="8" y1="9" x2="10.5" y2="9" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" />
      <line x1="8" y1="12" x2="10.5" y2="12" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" />
      <line x1="13.5" y1="9" x2="16.5" y2="9" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" />
      <line x1="13.5" y1="12" x2="16" y2="12" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" />
      {/* 金色书签绳 */}
      <path d="M12 18 L12 21 L13.5 19.5 L15 21 L15 18" fill="#f59e0b" />
    </svg>
  );
}

/** 6. RadioIcon - 实时电台天线（彩色波纹广播扩散） */
export function RadioIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${className}`}
      {...props}
    >
      <defs>
        <radialGradient id="radioCenter" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#e11d48" />
        </radialGradient>
      </defs>
      {/* 扩散波纹 1 */}
      <circle
        cx="12"
        cy="12"
        r="6"
        stroke="#ec4899"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        className={animate ? 'anim-wave-1' : ''}
        style={{ transformOrigin: '12px 12px' }}
      />
      {/* 扩散波纹 2 */}
      <circle
        cx="12"
        cy="12"
        r="9.5"
        stroke="#8b5cf6"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        className={animate ? 'anim-wave-2' : ''}
        style={{ transformOrigin: '12px 12px' }}
      />
      {/* 核心发信红球 */}
      <circle cx="12" cy="12" r="3.5" fill="url(#radioCenter)" className={animate ? 'anim-pulse' : ''} style={{ transformOrigin: '12px 12px' }} />
      <circle cx="11.2" cy="10.8" r="1" fill="#ffffff" opacity="0.8" />
    </svg>
  );
}

/** 7. BotIcon - 圆滚滚 AI 小机器人（天线发光 + 眼睛眨眼） */
export function BotIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-float' : ''} ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="botHead" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id="botFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
      </defs>
      {/* 天线 */}
      <line x1="12" y1="2" x2="12" y2="6" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="2" r="2" fill="#fbbf24" className={animate ? 'anim-sparkle' : ''} />
      {/* 脑袋外框 */}
      <rect x="3.5" y="6" width="17" height="14" rx="5" fill="url(#botHead)" stroke="#0369a1" strokeWidth="1" />
      {/* 面罩屏幕 */}
      <rect x="5.5" y="8" width="13" height="9" rx="3" fill="url(#botFace)" />
      {/* 眼睛 (可眨眼动效) */}
      <g className={animate ? 'anim-blink' : ''} style={{ transformOrigin: '12px 12.5px' }}>
        <circle cx="9" cy="12.5" r="1.8" fill="#5eead4" />
        <circle cx="15" cy="12.5" r="1.8" fill="#5eead4" />
        <circle cx="9.5" cy="12" r="0.6" fill="#ffffff" />
        <circle cx="15.5" cy="12" r="0.6" fill="#ffffff" />
      </g>
      {/* 脸颊腮红 */}
      <ellipse cx="7" cy="14.8" rx="0.9" ry="0.5" fill="#f43f5e" opacity="0.7" />
      <ellipse cx="17" cy="14.8" rx="0.9" ry="0.5" fill="#f43f5e" opacity="0.7" />
    </svg>
  );
}

/** 8. UserIcon - 饱满圆润彩色小人头像 */
export function UserIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-float' : ''} ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="userHead" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id="userBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
      </defs>
      {/* 头 */}
      <circle cx="12" cy="7.5" r="4.5" fill="url(#userHead)" stroke="#0284c7" strokeWidth="0.8" />
      <circle cx="13.5" cy="6" r="1.2" fill="#ffffff" opacity="0.5" />
      {/* 身体底座 */}
      <path
        d="M4.5 19.5 C4.5 15.5 8 13.5 12 13.5 C16 13.5 19.5 15.5 19.5 19.5 C19.5 20.5 18.5 21 17.5 21 L6.5 21 C5.5 21 4.5 20.5 4.5 19.5 Z"
        fill="url(#userBody)"
      />
    </svg>
  );
}

/** 9. UsersIcon - 饱满彩色双人组 */
export function UsersIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-pulse' : ''} ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="uBack" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7e22ce" />
        </linearGradient>
        <linearGradient id="uFront" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      {/* 背后的人 */}
      <g opacity="0.85">
        <circle cx="16" cy="7" r="3.5" fill="url(#uBack)" />
        <path d="M11 18 C11 15 13.5 13.5 16.5 13.5 C19.5 13.5 22 15 22 18" fill="url(#uBack)" />
      </g>
      {/* 前面的人 */}
      <circle cx="8.5" cy="8.5" r="4" fill="url(#uFront)" stroke="#ffffff" strokeWidth="1" />
      <circle cx="9.8" cy="7.2" r="1" fill="#ffffff" opacity="0.6" />
      <path
        d="M2.5 19.5 C2.5 16 5 14.5 8.5 14.5 C12 14.5 14.5 16 14.5 19.5 C14.5 20.5 13.8 21 12.8 21 L4.2 21 C3.2 21 2.5 20.5 2.5 19.5 Z"
        fill="url(#uFront)"
        stroke="#ffffff"
        strokeWidth="1"
      />
    </svg>
  );
}

/** 10. CrownIcon - 金灿灿小皇冠（微浮动 + 宝石光泽） */
export function CrownIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-float' : ''} ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="crownGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      {/* 皇冠顶上的三颗圆珍珠 */}
      <circle cx="4" cy="9" r="1.8" fill="#fef08a" stroke="#d97706" strokeWidth="0.8" />
      <circle cx="12" cy="6" r="2.2" fill="#ffffff" stroke="#d97706" strokeWidth="0.8" />
      <circle cx="20" cy="9" r="1.8" fill="#fef08a" stroke="#d97706" strokeWidth="0.8" />
      {/* 皇冠主体 */}
      <path
        d="M3.5 10.5 L6.5 18 L17.5 18 L20.5 10.5 L15 14 L12 8 L9 14 Z"
        fill="url(#crownGold)"
        stroke="#b45309"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* 底座横条 */}
      <rect x="5.5" y="18" width="13" height="3" rx="1.5" fill="#f59e0b" stroke="#b45309" strokeWidth="0.8" />
      {/* 皇冠中央红宝石 */}
      <circle cx="12" cy="15" r="1.4" fill="#f43f5e" />
    </svg>
  );
}

/** 11. DiceIcon - 圆角立体彩色骰子（轻摆动摇摇） */
export function DiceIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-wiggle' : ''} ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="diceGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
      </defs>
      {/* 骰子圆角立方体 */}
      <rect x="3" y="3" width="18" height="18" rx="4.5" fill="url(#diceGrad)" stroke="#64748b" strokeWidth="1.2" />
      {/* 点数 5 */}
      <circle cx="7.5" cy="7.5" r="1.6" fill="#ef4444" />
      <circle cx="16.5" cy="7.5" r="1.6" fill="#0284c7" />
      <circle cx="12" cy="12" r="2" fill="#ef4444" />
      <circle cx="7.5" cy="16.5" r="1.6" fill="#0284c7" />
      <circle cx="16.5" cy="16.5" r="1.6" fill="#0284c7" />
    </svg>
  );
}

/** 12. MessageIcon - 饱满聊天气泡（内置 3 颗跳跃律动小点） */
export function MessageIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-pulse' : ''} ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="msgGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      {/* 圆角气泡 */}
      <path
        d="M4 11 C4 6.5 7.5 3 12 3 C16.5 3 20 6.5 20 11 C20 15.5 16.5 19 12 19 C10.2 19 8.6 18.4 7.2 17.5 L4 18.8 L4.8 15.6 C4.3 14.2 4 12.7 4 11 Z"
        fill="url(#msgGrad)"
        stroke="#0284c7"
        strokeWidth="1"
      />
      {/* 3 颗律动打字点 */}
      <circle cx="8.5" cy="11" r="1.4" fill="#ffffff" className={animate ? 'anim-dot-1' : ''} />
      <circle cx="12" cy="11" r="1.4" fill="#ffffff" className={animate ? 'anim-dot-2' : ''} />
      <circle cx="15.5" cy="11" r="1.4" fill="#ffffff" className={animate ? 'anim-dot-3' : ''} />
    </svg>
  );
}

/** 13. LightbulbIcon - 亮黄灵感灯泡（发光辐射光芒） */
export function LightbulbIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-sparkle' : ''} ${className}`}
      {...props}
    >
      <defs>
        <radialGradient id="bulbGrad" cx="45%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#fef08a" />
          <stop offset="85%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
      </defs>
      {/* 顶部光线 */}
      <line x1="12" y1="1" x2="12" y2="3" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="4.5" y1="4.5" x2="6" y2="6" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="19.5" y1="4.5" x2="18" y2="6" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" />
      {/* 灯泡球体 */}
      <path
        d="M7 9 C7 6.2 9.2 4 12 4 C14.8 4 17 6.2 17 9 C17 11.2 15.6 13 14.5 14.2 L14.5 16.5 C14.5 17 14 17.5 13.5 17.5 L10.5 17.5 C10 17.5 9.5 17 9.5 16.5 L9.5 14.2 C8.4 13 7 11.2 7 9 Z"
        fill="url(#bulbGrad)"
        stroke="#d97706"
        strokeWidth="1"
      />
      {/* 底座螺口 */}
      <path d="M10 18.5 L14 18.5" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10.5 20.5 L13.5 20.5" stroke="#64748b" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** 14. ZapIcon - 圆角能量闪电（轻微脉冲） */
export function ZapIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-pulse' : ''} ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="zapGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="40%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
      </defs>
      <path
        d="M13 2 L4.5 13.5 C4.2 13.9 4.5 14.5 5 14.5 L11.5 14.5 L9.5 22 C9.3 22.6 10.1 22.9 10.5 22.4 L19.5 10.5 C19.8 10.1 19.5 9.5 19 9.5 L12.5 9.5 L14.5 2.5 C14.6 2.1 14.1 1.7 13.7 1.9 Z"
        fill="url(#zapGrad)"
        stroke="#ca8a04"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 15. SendIcon - 饱满纸飞机/火箭推进（斜向微漂移） */
export function SendIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-drift' : ''} ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="planeGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>
      <path
        d="M21.5 2.5 L10.5 13.5"
        stroke="#0369a1"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M21.8 2.2 C21.4 1.8 20.8 1.8 20.3 2.1 L2.6 11.2 C1.9 11.6 1.9 12.6 2.6 13 L8.2 15.8 L11 21.4 C11.4 22.1 12.4 22.1 12.8 21.4 L21.9 3.7 C22.2 3.2 22.2 2.6 21.8 2.2 Z"
        fill="url(#planeGrad)"
        stroke="#0369a1"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 16. EyeIcon - 彩色灵动大眼睛（自然眨眼动效） */
export function EyeIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="irisGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="60%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </linearGradient>
      </defs>
      {/* 眼眶外形 */}
      <path
        d="M2 12 C4.5 6.5 8.5 4 12 4 C15.5 4 19.5 6.5 22 12 C19.5 17.5 15.5 20 12 20 C8.5 20 4.5 17.5 2 12 Z"
        fill="#f8fafc"
        stroke="#64748b"
        strokeWidth="1.2"
      />
      {/* 眼球及眨眼动作 */}
      <g className={animate ? 'anim-blink' : ''} style={{ transformOrigin: '12px 12px' }}>
        {/* 彩色虹膜 */}
        <circle cx="12" cy="12" r="5" fill="url(#irisGrad)" />
        {/* 瞳孔 */}
        <circle cx="12" cy="12" r="2.4" fill="#0f172a" />
        {/* 高光亮点 */}
        <circle cx="13.5" cy="10.5" r="1.2" fill="#ffffff" />
        <circle cx="10.8" cy="13.5" r="0.6" fill="#ffffff" />
      </g>
    </svg>
  );
}

/** 17. TrophyIcon - 金光闪闪圆角大奖杯（微浮动 + 金色闪耀） */
export function TrophyIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-float' : ''} ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="goldCup" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="45%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      {/* 左右耳朵双把手 */}
      <path
        d="M5 6 C3.5 6 2 7.5 2 9.5 C2 12 4 13.5 6 13.5"
        stroke="#f59e0b"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M19 6 C20.5 6 22 7.5 22 9.5 C22 12 20 13.5 18 13.5"
        stroke="#f59e0b"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* 奖杯碗身 */}
      <path
        d="M5 4 L19 4 L17.5 12.5 C16.5 15.5 14 16.5 12 16.5 C10 16.5 7.5 15.5 6.5 12.5 Z"
        fill="url(#goldCup)"
        stroke="#b45309"
        strokeWidth="1"
      />
      {/* 碗身小星星徽记 */}
      <path d="M12 8 L12.8 9.8 L14.8 10 L13.3 11.3 L13.8 13.2 L12 12.1 L10.2 13.2 L10.7 11.3 L9.2 10 L11.2 9.8 Z" fill="#ffffff" opacity="0.9" />
      {/* 杯柱 */}
      <rect x="10.5" y="16.5" width="3" height="3" fill="#d97706" />
      {/* 底座 */}
      <rect x="7" y="19.5" width="10" height="2.8" rx="1.4" fill="#78350f" stroke="#b45309" strokeWidth="0.8" />
    </svg>
  );
}

/** 18. FlameIcon - 双层圆润跳动火焰（火焰律动） */
export function FlameIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-flame' : ''} ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="outerFlame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="40%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
        <linearGradient id="innerFlame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      {/* 外层大火焰 */}
      <path
        d="M12 2 C13 5.5 17 8 17 13 C17 17.5 14.5 21 12 21 C9.5 21 7 17.5 7 13 C7 9 9.5 6 12 2 Z"
        fill="url(#outerFlame)"
      />
      {/* 内层亮黄小焰心 */}
      <path
        d="M12 9 C12.5 11 14.5 12.5 14.5 15 C14.5 17.5 13.2 19 12 19 C10.8 19 9.5 17.5 9.5 15 C9.5 13 10.5 11.5 12 9 Z"
        fill="url(#innerFlame)"
      />
    </svg>
  );
}

/** 19. CheckCircleIcon - 翡翠绿圆润对勾（判定「是」专用） */
export function CheckCircleIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-pulse' : ''} ${className}`}
      {...props}
    >
      <defs>
        <radialGradient id="checkCircleBg" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="70%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#checkCircleBg)" stroke="#065f46" strokeWidth="0.8" />
      {/* 顶部柔和高光 */}
      <ellipse cx="12" cy="5.5" rx="5" ry="1.8" fill="#ffffff" opacity="0.35" />
      {/* 饱满对勾 */}
      <path
        d="M7.5 12.2 L10.5 15.2 L16.8 8.8"
        stroke="#ffffff"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 20. CrossCircleIcon - 珊瑚红圆润叉叉（判定「不是」专用） */
export function CrossCircleIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-wiggle' : ''} ${className}`}
      {...props}
    >
      <defs>
        <radialGradient id="crossCircleBg" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fda4af" />
          <stop offset="70%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#be123c" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#crossCircleBg)" stroke="#9f1239" strokeWidth="0.8" />
      <ellipse cx="12" cy="5.5" rx="5" ry="1.8" fill="#ffffff" opacity="0.35" />
      {/* 饱满叉叉 */}
      <path
        d="M8.5 8.5 L15.5 15.5 M15.5 8.5 L8.5 15.5"
        stroke="#ffffff"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 21. MinusCircleIcon - 冰川蓝圆润横杠（判定「不相关」专用） */
export function MinusCircleIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-pulse' : ''} ${className}`}
      {...props}
    >
      <defs>
        <radialGradient id="minusCircleBg" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="70%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#minusCircleBg)" stroke="#1e40af" strokeWidth="0.8" />
      <ellipse cx="12" cy="5.5" rx="5" ry="1.8" fill="#ffffff" opacity="0.35" />
      {/* 饱满横杠 */}
      <line x1="7.5" y1="12" x2="16.5" y2="12" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

/** 22. HelpCircleIcon - 梦幻紫圆润问号（判定「不确定」专用，带思考晃头） */
export function HelpCircleIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-tilt' : ''} ${className}`}
      {...props}
    >
      <defs>
        <radialGradient id="helpCircleBg" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="70%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#6b21a8" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#helpCircleBg)" stroke="#581c87" strokeWidth="0.8" />
      <ellipse cx="12" cy="5.5" rx="5" ry="1.8" fill="#ffffff" opacity="0.35" />
      {/* 饱满问号 */}
      <path
        d="M9.5 9 C9.5 7.2 10.5 6.2 12 6.2 C13.5 6.2 14.8 7.2 14.8 8.8 C14.8 10.5 13.5 11.5 12 12.5 L12 13.5"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.5" r="1.3" fill="#ffffff" />
    </svg>
  );
}

/** 23. AlertIcon - 圆角金黄警示牌（微警示抖动） */
export function AlertIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-wiggle' : ''} ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="alertGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="60%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      {/* 圆角三角 */}
      <path
        d="M10.3 3.4 C11 2.1 13 2.1 13.7 3.4 L22.2 18.2 C22.9 19.5 21.9 21 20.5 21 L3.5 21 C2.1 21 1.1 19.5 1.8 18.2 Z"
        fill="url(#alertGrad)"
        stroke="#b45309"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <line x1="12" y1="8" x2="12" y2="13.5" stroke="#78350f" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.3" fill="#78350f" />
    </svg>
  );
}

/** 24. DoorIcon - 糖果色大门/传送门 */
export function DoorIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-float' : ''} ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="doorFrame" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id="doorLeaf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      {/* 门框拱顶 */}
      <path
        d="M3 21 L3 7 C3 4 6 2 12 2 C18 2 21 4 21 7 L21 21"
        stroke="url(#doorFrame)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* 内部打开的半虚掩门板 */}
      <rect x="5.5" y="4" width="9" height="17" rx="2" fill="url(#doorLeaf)" stroke="#d97706" strokeWidth="1" />
      {/* 金色小门把手 */}
      <circle cx="12.5" cy="13" r="1.4" fill="#d97706" />
      {/* 门内透露的光芒 */}
      <line x1="15.5" y1="5" x2="19" y2="20" stroke="#5eead4" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="21.5" x2="22" y2="21.5" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** 25. PlusIcon - 饱满立体绿色加号胶囊 */
export function PlusIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-pulse' : ''} ${className}`}
      {...props}
    >
      <defs>
        <radialGradient id="plusGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="70%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#plusGrad)" stroke="#065f46" strokeWidth="0.8" />
      <line x1="12" y1="7" x2="12" y2="17" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" />
      <line x1="7" y1="12" x2="17" y2="12" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

/** 26. HashIcon - 饱满橙色号码牌 */
export function HashIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="hashGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#hashGrad)" stroke="#c2410c" strokeWidth="0.8" />
      <path
        d="M9.5 5 L7.5 19 M16.5 5 L14.5 19 M5 9.5 L19 9.5 M4 14.5 L18 14.5"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 27. CopyIcon - 双层圆角彩色卡片 */
export function CopyIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${className}`}
      {...props}
    >
      {/* 底层卡片 */}
      <rect x="7" y="7" width="13" height="14" rx="3.5" fill="#38bdf8" stroke="#0284c7" strokeWidth="1" />
      {/* 顶层卡片 */}
      <rect x="4" y="3" width="13" height="14" rx="3.5" fill="#ffffff" stroke="#0284c7" strokeWidth="1.2" />
      <line x1="7.5" y1="7.5" x2="13.5" y2="7.5" stroke="#94a3b8" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="7.5" y1="11" x2="11.5" y2="11" stroke="#94a3b8" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** 28. LogOutIcon - 红色退出小指示牌 */
export function LogOutIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="logoutGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#be123c" />
        </linearGradient>
      </defs>
      {/* 门 */}
      <path
        d="M10 4 L5 4 C3.9 4 3 4.9 3 6 L3 18 C3 19.1 3.9 20 5 20 L10 20"
        stroke="#94a3b8"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* 红色飞出箭头 */}
      <path
        d="M14 8 L18 12 L14 16 M18 12 L8 12"
        stroke="url(#logoutGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 29. StarIcon - 饱满胖胖金黄色五角星（微闪烁） */
export function StarIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-sparkle' : ''} ${className}`}
      {...props}
    >
      <defs>
        <radialGradient id="starGrad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="60%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
      </defs>
      <path
        d="M12 2.5 C12.3 2.5 12.6 2.7 12.8 3 L15.3 7.8 C15.4 8 15.7 8.2 15.9 8.2 L21.3 9.1 C21.8 9.2 22 9.8 21.6 10.2 L17.8 14 C17.6 14.2 17.5 14.5 17.6 14.7 L18.4 20 C18.5 20.6 18 21 17.5 20.7 L12.6 18.2 C12.4 18.1 12.1 18.1 11.9 18.2 L7 20.7 C6.5 21 6 20.6 6.1 20 L7 14.7 C7 14.5 6.9 14.2 6.7 14 L2.9 10.2 C2.5 9.8 2.7 9.2 3.2 9.1 L8.6 8.2 C8.8 8.2 9.1 8 9.2 7.8 L11.7 3 C11.9 2.7 12.2 2.5 12.5 2.5 Z"
        fill="url(#starGrad)"
        stroke="#b45309"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="8" r="1" fill="#ffffff" opacity="0.8" />
    </svg>
  );
}

/** 30. PlayIcon - 圆润翠绿开始播放胶囊 */
export function PlayIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-pulse' : ''} ${className}`}
      {...props}
    >
      <defs>
        <radialGradient id="playGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="70%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#playGrad)" stroke="#065f46" strokeWidth="0.8" />
      <path
        d="M10 7.8 C10 7.2 10.7 6.8 11.2 7.1 L17.2 11.2 C17.7 11.5 17.7 12.3 17.2 12.6 L11.2 16.7 C10.7 17 10 16.6 10 16 Z"
        fill="#ffffff"
      />
    </svg>
  );
}

/** 31. ThumbsUpIcon - 饱满大拇指（点赞动效） */
export function ThumbsUpIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-wiggle' : ''} ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="thumbUp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <path
        d="M7 10 L4 10 C3 10 2.5 10.5 2.5 11.5 L2.5 20 C2.5 21 3 21.5 4 21.5 L7 21.5 Z"
        fill="#059669"
      />
      <path
        d="M7 11.5 L10 4 C10.8 2 12.5 2 13 3.5 C13.5 5 12.5 7.5 12.5 9 L19 9 C20.5 9 21.5 10.2 21.2 11.8 L19.8 19.2 C19.5 20.5 18.2 21.5 17 21.5 L7 21.5 Z"
        fill="url(#thumbUp)"
        stroke="#047857"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 32. ThumbsDownIcon - 饱满倒大拇指 */
export function ThumbsDownIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="thumbDown" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#be123c" />
        </linearGradient>
      </defs>
      <path
        d="M7 14 L4 14 C3 14 2.5 13.5 2.5 12.5 L2.5 4 C2.5 3 3 2.5 4 2.5 L7 2.5 Z"
        fill="#9f1239"
      />
      <path
        d="M7 12.5 L10 20 C10.8 22 12.5 22 13 20.5 C13.5 19 12.5 16.5 12.5 15 L19 15 C20.5 15 21.5 13.8 21.2 12.2 L19.8 4.8 C19.5 3.5 18.2 2.5 17 2.5 L7 2.5 Z"
        fill="url(#thumbDown)"
        stroke="#881337"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 33. SmileIcon - 圆胖开心笑脸表情（微跳动） */
export function SmileIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-pulse' : ''} ${className}`}
      {...props}
    >
      <defs>
        <radialGradient id="smileGrad" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="70%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#smileGrad)" stroke="#b45309" strokeWidth="0.8" />
      {/* 眯眯笑眼 */}
      <path d="M8 9.5 C8.5 8.5 10 8.5 10.5 9.5" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
      <path d="M13.5 9.5 C14 8.5 15.5 8.5 16 9.5" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
      {/* 大大笑嘴 */}
      <path d="M7.5 13.5 C9 17 15 17 16.5 13.5" stroke="#78350f" strokeWidth="2.2" strokeLinecap="round" />
      {/* 粉红腮红 */}
      <ellipse cx="6.5" cy="13" rx="1.4" ry="0.8" fill="#f43f5e" opacity="0.6" />
      <ellipse cx="17.5" cy="13" rx="1.4" ry="0.8" fill="#f43f5e" opacity="0.6" />
    </svg>
  );
}

/** 34. MehIcon - 呆萌平嘴表情（微眨眼） */
export function MehIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${className}`}
      {...props}
    >
      <defs>
        <radialGradient id="mehGrad" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fed7aa" />
          <stop offset="70%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ea580c" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#mehGrad)" stroke="#c2410c" strokeWidth="0.8" />
      {/* 呆滞圆眼 (可眨眼) */}
      <g className={animate ? 'anim-blink' : ''} style={{ transformOrigin: '12px 10px' }}>
        <circle cx="8.5" cy="9.5" r="1.5" fill="#7c2d12" />
        <circle cx="15.5" cy="9.5" r="1.5" fill="#7c2d12" />
      </g>
      {/* 直直平嘴 */}
      <line x1="8" y1="15" x2="16" y2="15" stroke="#7c2d12" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** 35. SearchIcon - 圆润放大镜 */
export function SearchIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-wiggle' : ''} ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="lensGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#bae6fd" />
        </linearGradient>
      </defs>
      {/* 镜片 */}
      <circle cx="10.5" cy="10.5" r="7.5" fill="url(#lensGrad)" stroke="#0284c7" strokeWidth="2" />
      {/* 高光 */}
      <path d="M7 7 C8.2 5.8 10 5.5 11.5 6" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
      {/* 手柄 */}
      <line x1="16" y1="16" x2="21.5" y2="21.5" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** 36. RefreshIcon - 双色旋转刷新箭头 */
export function RefreshIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-spin' : ''} ${className}`}
      {...props}
    >
      <path
        d="M21 12 C21 16.97 16.97 21 12 21 C8.2 21 4.9 18.6 3.6 15.2 M3 12 C3 7.03 7.03 3 12 3 C15.8 3 19.1 5.4 20.4 8.8"
        stroke="#0284c7"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <polygon points="21,3 21,9 15,9" fill="#10b981" />
      <polygon points="3,21 3,15 9,15" fill="#f59e0b" />
    </svg>
  );
}

/** 37. LoaderIcon - 彩色糖果加载轮（判定中等待） */
export function LoaderIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${animate ? 'anim-spin' : ''} ${className}`}
      {...props}
    >
      <circle cx="12" cy="3.5" r="2.2" fill="#ef4444" />
      <circle cx="18" cy="6" r="2.2" fill="#f59e0b" />
      <circle cx="20.5" cy="12" r="2.2" fill="#10b981" />
      <circle cx="18" cy="18" r="2.2" fill="#06b6d4" />
      <circle cx="12" cy="20.5" r="2.2" fill="#3b82f6" />
      <circle cx="6" cy="18" r="2.2" fill="#8b5cf6" />
      <circle cx="3.5" cy="12" r="2.2" fill="#ec4899" />
      <circle cx="6" cy="6" r="2.2" fill="#f43f5e" />
    </svg>
  );
}

/** 38. ArrowLeftIcon - 饱满蓝色圆角返回箭头 */
export function ArrowLeftIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${className}`}
      {...props}
    >
      <circle cx="12" cy="12" r="10" fill="#e0f2fe" />
      <path
        d="M13.5 8 L9.5 12 L13.5 16 M9.5 12 L16.5 12"
        stroke="#0284c7"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 39. CloseIcon - 饱满红色小叉（关闭/移出） */
export function CloseIcon({ size = 20, animate = true, className = '', ...props }: GameIconProps) {
  return (
    <svg
      {...withDefaults(size)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`game-icon ${className}`}
      {...props}
    >
      <circle cx="12" cy="12" r="9" fill="#fee2e2" />
      <path d="M9 9 L15 15 M15 9 L9 15" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
