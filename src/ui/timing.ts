// 화면 시간 설정 (엔진 balance가 아니라 화면 쪽 설정이다)
// 속도 이름(느림/보통/빠르게)과 기본값(보통)은 설정 화면 그대로이고, 화면마다 배율이 다르다.
//
// 2026-11-24 3차 피드백: 진행 화면만 한 단계씩 빨라졌다.
//   새 느림 = 예전 보통, 새 보통 = 예전 빠르게, 새 빠르게 = 예전 빠르게의 2배.
//   인트로, 월초 소식 타이핑, 화면 등장 움직임은 예전 배율 그대로다.

export type Speed = 'slow' | 'normal' | 'fast';
export type AutoDelay = 'short' | 'normal' | 'long';

/** 인트로, 월초 소식, 화면 등장 움직임(--motion-scale)의 시간 배율 */
export const STORY_SPEED_MUL: Record<Speed, number> = { slow: 1.5, normal: 1, fast: 0.6 };

/** 진행 화면(상순·중순·하순)의 시간 배율: 타이핑과 순 사이 쉬는 시간 모두 */
export const PROGRESS_SPEED_MUL: Record<Speed, number> = { slow: 1, normal: 0.6, fast: 0.3 };

/** 진행 화면의 기본 시간(ms, 배율을 곱하기 전) */
export const PROGRESS_TIMING = {
  /** 글자당 */
  perChar: 30,
  /** 화면이 열린 뒤 첫 글까지 */
  startAt: 1200,
  /** 문단 사이 */
  paraGap: 600,
  /** "결정이 필요하다" 띠가 뜬 뒤 결정 팝업이 저절로 열리기까지 */
  decideOpen: 1500,
} as const;

/** 서술이 다 나온 뒤 다음 순으로 저절로 넘어가기까지 쉬는 시간(ms, 진행 화면 배율을 곱하기 전) */
export const AUTO_DELAY_MS: Record<AutoDelay, number> = { short: 800, normal: 1500, long: 3000 };
