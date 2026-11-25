// 움직임과 화면 설정: 속도(느림/보통/빠르게), 움직임 줄이기, 결정 팝업 자동 열기, 글자 크기.
// 설정은 이 기기에만 남는 편의 기능이라 localStorage에 둔다 (막혀 있어도 기본값으로 동작한다).

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { PROGRESS_SPEED_MUL, STORY_SPEED_MUL, type AutoDelay, type Speed } from './timing';

export type { AutoDelay, Speed } from './timing';

export interface Settings {
  speed: Speed;
  /** 게임 설정에서 켠 움직임 줄이기 (운영체제 설정과 별개) */
  reduceMotion: boolean;
  /** 월초 상황 화면에서 소식이 끝나면 결정 팝업(전략·월초 사건)을 연다. 기본 끔 (2026-11-25 4차 피드백).
   *  진행 화면의 결정(중순 사건, 남은 고기)은 이 설정과 상관없이 늘 자동으로 연다. */
  autoOpenPlan: boolean;
  fontScale: 1 | 2 | 3;
  /** 한 순씩 "계속"을 눌러 넘긴다. 끄면 서술이 끝나고 잠시 쉰 뒤 저절로 다음 순으로 간다 */
  stepByStep: boolean;
  /** 저절로 넘어가기 전에 쉬는 시간 */
  autoDelay: AutoDelay;
}

const DEFAULTS: Settings = {
  speed: 'normal',
  reduceMotion: false,
  autoOpenPlan: false,
  fontScale: 1,
  stepByStep: false,
  autoDelay: 'normal',
};

const KEY = 'sac.settings';
const FONT_SCALE: Record<Settings['fontScale'], number> = { 1: 1, 2: 1.12, 3: 1.25 };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    // 없어진 설정(평온한 달 요약 quietSummary, 예전 자동 열기 autoOpen)은 버린다 — 새 기본값(끔)으로 시작하게
    const { quietSummary: _gone, autoOpen: _old, ...saved } = JSON.parse(raw) as Partial<Settings> & { quietSummary?: unknown; autoOpen?: unknown };
    return { ...DEFAULTS, ...saved };
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
  /** 시간 배율 (인트로·월초 소식·등장 움직임: 타이핑 ms × mul) */
  mul: number;
  /** 진행 화면의 시간 배율 (타이핑과 순 사이 쉬는 시간) */
  progressMul: number;
}

const Ctx = createContext<MotionCtx>({ settings: DEFAULTS, set: () => {}, reduced: false, mul: 1, progressMul: PROGRESS_SPEED_MUL.normal });

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
    root.style.setProperty('--motion-scale', String(STORY_SPEED_MUL[settings.speed]));
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
    mul: STORY_SPEED_MUL[settings.speed],
    progressMul: PROGRESS_SPEED_MUL[settings.speed],
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMotion(): MotionCtx {
  return useContext(Ctx);
}
