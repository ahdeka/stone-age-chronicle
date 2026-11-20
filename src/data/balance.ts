// 장 공통 수치. 장 전용 수치는 chapters/<id>/balance.ts에 둔다. (매직 넘버 금지)

export const commonBalance = {
  /** 공통 스탯 기본값. 장 balance의 stats가 같은 키를 덮어쓸 수 있다. */
  stats: {
    /** check 효과의 로지스틱 폭: (힘 − 난이도) / scale */
    'check.scale': 4,
  },

  /** 불확실성 단서 4단계 (DESIGN.md §4.3). 위에서부터 minP 이상이면 그 단계. */
  uncertainty: {
    tiers: [
      { id: 'sure', minP: 0.8 },
      { id: 'fair', minP: 0.5 },
      { id: 'risky', minP: 0.2 },
      { id: 'reckless', minP: 0 },
    ],
    /** 선견 인물이 보여 주는 확률 범위의 폭 */
    foresightBucket: 0.2,
  },

  events: {
    maxPerTurn: 2,
    secondEventChance: 0.5,
    /** 같은 태그는 연속 2턴까지만 */
    tagStreakMax: 2,
  },

  axis: {
    /** 이 값을 넘으면 그 성향의 이벤트·전통이 열리기 시작한다 */
    lean: 30,
    /** 극단 위기 임계값 */
    extreme: 70,
  },

  ui: {
    /** 다음 생애 단계까지 이 턴 수 이하면 "노년이 가까워 보인다" 같은 단서를 보인다 */
    stageHintTurns: 3,
  },
} as const;
