/** 모든 콘텐츠 id. 유효성은 엔진 타입이 아니라 콘텐츠 검증기가 확인한다. */
export type Id = string;

/** 화면에 보일 이름. 엔진은 문장을 만들지 않고 문자열 키나 원문만 들고 다닌다. */
export type Label = { key: string } | { raw: string };

/** sfc32 난수 상태 (uint32 × 4) */
export type RngState = [number, number, number, number];

/** 범위 표기. 둘 다 포함한다. */
export interface NumRange {
  min?: number;
  max?: number;
}

/** 한 달의 세 단계: 상순, 중순, 하순 */
export type Phase = 'early' | 'mid' | 'late';
export const PHASES: readonly Phase[] = ['early', 'mid', 'late'];

export type AgeBand = 'child' | 'adult' | 'elder';
export type Sex = 'f' | 'm';

/** 결과 등급 (DESIGN.md §7) — 좋은 쪽부터 */
export type Tier = 'triumph' | 'success' | 'costly' | 'failure' | 'disaster';
export const TIERS: readonly Tier[] = ['triumph', 'success', 'costly', 'failure', 'disaster'];

/** 위험 단서. unknown은 확률 구간이 아니라 "모르는 정보가 있다"는 뜻이다 (DESIGN.md §7.2) */
export type Hint = 'sure' | 'fair' | 'risky' | 'unknown';

/** 수량: 고정값 또는 [최소, 최대] 균등 범위 */
export type Amount = number | readonly [number, number];
