import React from 'react';
import { CandyGameIcon } from 'candy-ui';
import type { CandyGameIconProps } from 'candy-ui';

/** Compatibility exports: all artwork is supplied by CandyUI. */
export interface GameIconProps extends Omit<CandyGameIconProps, 'name'> {
  animate?: boolean;
}

function icon(name: string) {
  return function GameIcon({ size = 20, animate: _animate, ...props }: GameIconProps) {
    return <CandyGameIcon name={name} size={size} {...props} />;
  };
}

// Use the installed icon catalogue (semantic nearest matches where no exact icon exists).
export const TurtleIcon = icon('heart');
export const SoupIcon = icon('bowl');
export const SparkleIcon = icon('sparkles');
export const CompassIcon = icon('compass');
export const BookIcon = icon('book');
export const RadioIcon = icon('volume');
export const BotIcon = icon('controller');
export const UserIcon = icon('user');
export const UsersIcon = icon('users');
export const CrownIcon = icon('crown');
export const DiceIcon = icon('dice');
export const MessageIcon = icon('message');
export const LightbulbIcon = icon('light');
export const ZapIcon = icon('zap');
export const SendIcon = icon('mail');
export const EyeIcon = icon('search');
export const TrophyIcon = icon('trophy');
export const FlameIcon = icon('flame');
export const CheckCircleIcon = icon('check');
export const CrossCircleIcon = icon('cross');
export const MinusCircleIcon = icon('minus');
export const HelpCircleIcon = icon('question-mark');
export const AlertIcon = icon('info');
export const DoorIcon = icon('door');
export const PlusIcon = icon('plus');
export const HashIcon = icon('door');
export const CopyIcon = icon('copy');
export const LogOutIcon = icon('door');
export const StarIcon = icon('star');
export const PlayIcon = icon('play');
export const ThumbsUpIcon = icon('like');
export const ThumbsDownIcon = icon('dislike');
export const SmileIcon = icon('user');
export const MehIcon = icon('user');
export const SearchIcon = icon('search');
export const RefreshIcon = icon('refresh');
export const LoaderIcon = icon('loading-ring');
export const ArrowLeftIcon = icon('arrow-left');
export const CloseIcon = icon('close');
