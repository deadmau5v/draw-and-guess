import { candySound, triggerCandyConfetti } from 'candy-ui';
import type { CandyColor } from 'candy-ui';

export type JuiceSoundKind =
  | 'pressDown'
  | 'pressUp'
  | 'verdictYes'
  | 'verdictNo'
  | 'verdictIrrelevant'
  | 'verdictUnknown'
  | 'guessSolved'
  | 'guessClose'
  | 'guessMiss'
  | 'countdownTick'
  | 'countdownUrgent'
  | 'highlight'
  | 'mascotPoke'
  | 'hintReveal';

export type FloatingFeedbackEvent = {
  text: string;
  x?: number;
  y?: number;
  color?: CandyColor;
};

const FLOATING_EVENT_NAME = 'turtle:floating-text';

export const DETECTIVE_QUIPS = [
  '反常之处往往藏着破案钥匙！',
  '试试先确认死因或人物关系？',
  '海龟侦探推了推眼镜，觉得事情并不简单。',
  '排除错误假设，剩下的再离谱也是真相！',
  '注意汤面里的时间、地点和缺失的主语。',
  '摸鱼+1，不如再提一个是非问题？',
] as const;

export const QUICK_QUESTION_TEMPLATES = [
  { label: '有人死亡吗', text: '故事里有人死亡吗？' },
  { label: '与职业有关', text: '这和当事人的职业或身份有关吗？' },
  { label: '存在误会', text: '故事中的人是不是产生了某种误会？' },
  { label: '有其他人', text: '现场除了提到的人，还有关键的第三者吗？' },
] as const;

let sharedAudioCtx: AudioContext | null = null;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new Ctx();
    } catch {
      return null;
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Returns a slightly randomized pitch multiplier (e.g. 0.94..1.06) so repeated
 * high-frequency UI actions never cause listener fatigue.
 */
export function randomPitch(spread = 0.06): number {
  return 1 + (Math.random() * 2 - 1) * spread;
}

export function triggerHaptic(pattern: number | number[] = 10): void {
  if (prefersReducedMotion()) return;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore environments where vibrate is restricted.
    }
  }
}

function synthTone(
  ctx: AudioContext,
  options: {
    freq: number;
    endFreq?: number;
    type?: OscillatorType;
    duration?: number;
    delay?: number;
    gain?: number;
  },
): void {
  const now = ctx.currentTime + (options.delay ?? 0);
  const dur = options.duration ?? 0.08;
  const masterVol = Math.max(0.05, Math.min(1, candySound.getVolume?.() ?? 0.4));
  const peak = (options.gain ?? 0.14) * masterVol;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = options.type ?? 'sine';
  osc.frequency.setValueAtTime(options.freq, now);
  if (options.endFreq && options.endFreq !== options.freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.endFreq), now + dur);
  }

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.linearRampToValueAtTime(peak, now + Math.min(0.012, dur * 0.25));
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + dur + 0.01);
}

/**
 * Procedural Web Audio micro-SFX engine with pitch randomization and CandySound fallback.
 */
export function playJuiceSound(kind: JuiceSoundKind): void {
  if (!candySound.isEnabled()) return;

  const ctx = getAudioContext();
  const pitch = randomPitch(0.06);

  if (!ctx) {
    // Fallback to CandyUI's built-in sound controller when Web Audio context is unavailable.
    const fallbackMap: Record<JuiceSoundKind, Parameters<typeof candySound.play>[0]> = {
      pressDown: 'click',
      pressUp: 'pop',
      verdictYes: 'coin',
      verdictNo: 'error',
      verdictIrrelevant: 'bubble',
      verdictUnknown: 'toggle',
      guessSolved: 'fanfare',
      guessClose: 'star',
      guessMiss: 'error',
      countdownTick: 'click',
      countdownUrgent: 'pop',
      highlight: 'bubble',
      mascotPoke: 'pop',
      hintReveal: 'star',
    };
    try {
      candySound.play(fallbackMap[kind]);
    } catch {}
    return;
  }

  try {
    switch (kind) {
      case 'pressDown':
        // Crisp low-latency mechanical switch down-stroke
        synthTone(ctx, { freq: 240 * pitch, endFreq: 155 * pitch, type: 'triangle', duration: 0.032, gain: 0.11 });
        break;
      case 'pressUp':
        // Lighter higher-pitched release spring
        synthTone(ctx, { freq: 340 * pitch, endFreq: 490 * pitch, type: 'sine', duration: 0.038, gain: 0.08 });
        break;
      case 'verdictYes':
        // Bright ascending major third chime ("是")
        synthTone(ctx, { freq: 523.25 * pitch, endFreq: 659.25 * pitch, type: 'triangle', duration: 0.11, gain: 0.18 });
        synthTone(ctx, { freq: 783.99 * pitch, endFreq: 1046.5 * pitch, type: 'sine', duration: 0.18, delay: 0.075, gain: 0.2 });
        triggerHaptic(15);
        break;
      case 'verdictNo':
        // Tactile descending double-thud ("不是")
        synthTone(ctx, { freq: 310 * pitch, endFreq: 220 * pitch, type: 'sawtooth', duration: 0.09, gain: 0.12 });
        synthTone(ctx, { freq: 220 * pitch, endFreq: 155 * pitch, type: 'triangle', duration: 0.14, delay: 0.08, gain: 0.15 });
        triggerHaptic([12, 30, 12]);
        break;
      case 'verdictIrrelevant':
        // Neutral bubble shrug ("不相关")
        synthTone(ctx, { freq: 380 * pitch, endFreq: 340 * pitch, type: 'sine', duration: 0.09, gain: 0.12 });
        synthTone(ctx, { freq: 340 * pitch, endFreq: 410 * pitch, type: 'sine', duration: 0.09, delay: 0.07, gain: 0.1 });
        break;
      case 'verdictUnknown':
        // Curious rising inflection ("不确定")
        synthTone(ctx, { freq: 330 * pitch, endFreq: 466 * pitch, type: 'sine', duration: 0.14, gain: 0.12 });
        break;
      case 'guessSolved':
        // Triumphant detective fanfare arpeggio ("破解成功")
        [523.25, 659.25, 783.99, 1046.5].forEach((note, idx) => {
          synthTone(ctx, {
            freq: note,
            endFreq: note * 1.02,
            type: idx === 3 ? 'triangle' : 'sine',
            duration: idx === 3 ? 0.34 : 0.13,
            delay: idx * 0.08,
            gain: 0.2,
          });
        });
        triggerHaptic([20, 40, 30, 40, 60]);
        break;
      case 'guessClose':
        // Exciting sparkle ("接近真相")
        [587.33, 740, 880].forEach((note, idx) => {
          synthTone(ctx, { freq: note * pitch, type: 'triangle', duration: 0.14, delay: idx * 0.065, gain: 0.17 });
        });
        triggerHaptic([15, 25, 20]);
        break;
      case 'guessMiss':
        synthTone(ctx, { freq: 260 * pitch, endFreq: 170 * pitch, type: 'triangle', duration: 0.16, gain: 0.15 });
        triggerHaptic(18);
        break;
      case 'countdownTick':
        // Subtle wooden clock tick (10s..4s)
        synthTone(ctx, { freq: 680 * pitch, endFreq: 420 * pitch, type: 'sine', duration: 0.028, gain: 0.07 });
        break;
      case 'countdownUrgent':
        // High-tension double pulse (3s..1s)
        synthTone(ctx, { freq: 880 * pitch, endFreq: 660 * pitch, type: 'triangle', duration: 0.045, gain: 0.12 });
        break;
      case 'highlight':
        // Marker swoosh
        synthTone(ctx, { freq: 420 * pitch, endFreq: 720 * pitch, type: 'sine', duration: 0.08, gain: 0.13 });
        triggerHaptic(8);
        break;
      case 'mascotPoke':
        // Playful rubbery squish pop
        synthTone(ctx, { freq: 360 * pitch, endFreq: 680 * pitch, type: 'sine', duration: 0.09, gain: 0.15 });
        triggerHaptic(10);
        break;
      case 'hintReveal':
        // Mystery chime
        synthTone(ctx, { freq: 587.33 * pitch, endFreq: 880 * pitch, type: 'sine', duration: 0.18, gain: 0.16 });
        triggerHaptic(12);
        break;
    }
  } catch {
    // Audio synthesis should never interrupt gameplay.
  }
}

export function emitFloatingText(detail: FloatingFeedbackEvent): void {
  if (typeof window === 'undefined' || prefersReducedMotion()) return;
  window.dispatchEvent(new CustomEvent<FloatingFeedbackEvent>(FLOATING_EVENT_NAME, { detail }));
}

export function subscribeFloatingText(handler: (detail: FloatingFeedbackEvent) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const custom = event as CustomEvent<FloatingFeedbackEvent>;
    if (custom.detail?.text) handler(custom.detail);
  };
  window.addEventListener(FLOATING_EVENT_NAME, listener);
  return () => window.removeEventListener(FLOATING_EVENT_NAME, listener);
}

export function celebrateSolved(): void {
  playJuiceSound('guessSolved');
  if (prefersReducedMotion()) return;
  try {
    triggerCandyConfetti({ particleCount: 55, spread: 80, origin: { x: 0.5, y: 0.55 }, playSound: false });
  } catch {}
}

export function triggerVerdictJuice(result: string, points?: number): void {
  switch (result) {
    case '是':
      playJuiceSound('verdictYes');
      emitFloatingText({
        text: typeof points === 'number' && points > 0 ? `是！+${points} 积分` : '✓ 是！关键命中',
        color: 'green',
      });
      break;
    case '不是':
      playJuiceSound('verdictNo');
      emitFloatingText({
        text: typeof points === 'number' && points > 0 ? `不是 · +${points} 积分` : '✗ 已排除可能',
        color: 'red',
      });
      break;
    case '不相关':
      playJuiceSound('verdictIrrelevant');
      emitFloatingText({ text: '○ 线索不相关', color: 'gray' });
      break;
    case '不确定':
      playJuiceSound('verdictUnknown');
      emitFloatingText({ text: '？ 难以确定', color: 'yellow' });
      break;
    case '破解成功':
      celebrateSolved();
      emitFloatingText({ text: '★ 破解成功！真相大白', color: 'yellow' });
      break;
    case '接近真相':
      playJuiceSound('guessClose');
      emitFloatingText({ text: '🔥 非常接近真相！', color: 'purple' });
      break;
    case '还没猜对':
      playJuiceSound('guessMiss');
      emitFloatingText({ text: '再接再厉，继续追问', color: 'blue' });
      break;
  }
}
