// 움직임과 화면 설정: 속도(느리게/보통/빠르게), 움직임 줄이기, 결정 팝업 자동 열기, 글자 크기.
// 설정은 이 기기에만 남는 편의 기능이라 localStorage에 둔다 (막혀 있어도 기본값으로 동작한다).

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Speed = 'slow' | 'normal' | 'fast';

export interface Settings {
  speed: Speed;
  /** 게임 설정에서 켠 움직임 줄이기 (운영체제 설정과 별개) */
  reduceMotion: boolean;
  autoOpen: boolean;
  fontScale: 1 | 2 | 3;
  /** 평온한 달은 상순·중순·하순을 한 화면으로 요약한다 (DESIGN.md §19) */
  quietSummary: boolean;
  /** 한 순씩 "계속"을 눌러 넘긴다. 끄면 서술이 끝나고 잠시 쉰 뒤 저절로 다음 순으로 간다 */
  stepByStep: boolean;
  /** 저절로 넘어가기 전에 쉬는 시간 */
  autoDelay: AutoDelay;
}

export type AutoDelay = 'short' | 'normal' | 'long';

const DEFAULTS: Settings = {
  speed: 'normal',
  reduceMotion: false,
  autoOpen: true,
  fontScale: 1,
  // 자동 진행이 생겨 기본은 끈다. 새 시안에서 "이달의 결과"(순별 한 줄 회고 + 장부)로 합칠 예정
  quietSummary: false,
  stepByStep: false,
  autoDelay: 'normal',
};

/** 서술이 다 나온 뒤 다음 순으로 저절로 넘어가기까지 쉬는 시간(ms, 속도 배율을 곱하기 전) */
export const AUTO_DELAY_MS: Record<AutoDelay, number> = { short: 800, normal: 1500, long: 3000 };
const KEY = 'sac.settings';

/** 타이핑·순차 등장 시간 배율 */
export const SPEED_MUL: Record<Speed, number> = { slow: 1.5, normal: 1, fast: 0.6 };
const FONT_SCALE: Record<Settings['fontScale'], number> = { 1: 1, 2: 1.12, 3: 1.25 };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function osReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

interface MotionCtx {
  settings: Settings;
  set: (patch: Partial<Settings>) => void;
  /** 운영체제 또는 게임 설정으로 움직임을 줄였는가 */
  reduced: boolean;
  /** 시간 배율 (타이핑 ms × mul) */
  mul: number;
}

const Ctx = createContext<MotionCtx>({ settings: DEFAULTS, set: () => {}, reduced: false, mul: 1 });

export function MotionProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);
  const [os, setOs] = useState(osReducedMotion);

  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setOs(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset['reduceMotion'] = String(settings.reduceMotion);
    root.style.setProperty('--motion-scale', String(SPEED_MUL[settings.speed]));
    root.style.setProperty('--font-scale', String(FONT_SCALE[settings.fontScale]));
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      // 저장이 막혀 있으면 이번 실행에만 적용한다
    }
  }, [settings]);

  const reduced = os || settings.reduceMotion;
  const value: MotionCtx = {
    settings,
    set: (patch) => setSettings((s) => ({ ...s, ...patch })),
    reduced,
    mul: SPEED_MUL[settings.speed],
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMotion(): MotionCtx {
  return useContext(Ctx);
}
