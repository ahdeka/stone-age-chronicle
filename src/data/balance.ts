// 장 공통 수치 (DESIGN.md §7, §10). 장별 수치는 chapters/<id>/balance.ts에 둔다.

import type { ChapterBalance } from '../engine';

export const commonBalance = {
  daysPerPhase: 10,
  /** 결과 등급: v = (힘 − 난이도) + 삼각 분포(±spread). 대가 있는 성공 구간(−1 ~ 0.5)을 넓게 잡는다 */
  tier: {
    spread: 3,
    thresholds: { triumph: 2, success: 0.5, costly: -1, failure: -2.2 },
  },
  /** 위험 단서: 대가 있는 성공 이상의 확률 p로 정한다. '결과를 알 수 없다'는 숨은 변수로만 정해진다 */
  hint: { sure: 0.85, fair: 0.55 },
  /** 전략 두 칸 (DESIGN.md §6.4): 식량 3~4개(버티기 포함), 발전 2~3개 + "발전하지 않는다", 큰 일 0~1개 */
  policy: {
    foodSlots: 4,
    urgentFoodSlots: 3,
    growthSlots: 3,
    urgentGrowthSlots: 2,
    urgentFoodDays: 3,
    maxPerCategory: 2,
    jitter: 5,
    maxCacheTargets: 2,
    projectBonus: 30,
  },
  events: { villageChancePerMonth: 0.35, maxPerMonth: 2, maxPerPhase: 1 },
  cohesion: { max: 100, deathCost: 4, lowThreshold: 10, lowWeight: { month: 1, season: 1.5 } },
  chronicle: { deathImportance: 50, builtImportance: 20 },
  /** 화면 기준값 (시안: 식량 16일분 미만이면 경고) */
  ui: {
    foodWarnDays: 16,
    firewoodWarnDays: 10,
    cohesionBands: [
      { min: 75, id: 'firm' },
      { min: 45, id: 'normal' },
      { min: 25, id: 'shaky' },
      { min: 0, id: 'broken' },
    ],
    maxNews: 3,
  },
} satisfies Partial<ChapterBalance>;
