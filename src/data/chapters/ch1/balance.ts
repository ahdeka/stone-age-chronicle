// 1장 수치 (DESIGN.md §6). 시뮬레이터 결과를 보며 이 파일만 고친다.

import type { ChapterBalance } from '../../../engine';
import { commonBalance } from '../../balance';

export const ch1Numbers = {
  turnLimit: 48,
  warnTurn: 40,

  /** 계절 배율 (채집, 사냥, 소비) */
  season: {
    spring: { gather: 1.2, hunt: 0.9 },
    summer: { gather: 1.4, hunt: 1.0 },
    autumn: { gather: 1.3, hunt: 1.2 },
    winter: { gather: 0.3, hunt: 0.8, consume: 1.3 },
  },

  /** 정착하면 저장 상한 배율 */
  settledStorageMul: 2,

  hunt: { variance: 0.35, toolBonusWeight: 0.3, toolBonusCap: 1 },

  /** 결속에 따른 행동 수 보정 */
  cohesionActions: { highAt: 70, lowBelow: 25 },

  /** 생애 단계 (DESIGN.md §8) */
  lifeStages: {
    child: 10,
    youth: 12,
    adult: 14,
  },

  /** 시대 전환 (DESIGN.md §7.1) — M4에서 사용 */
  transition: { minTurn: 26, targetTurn: 30, deadlineTurn: 33, postponeTurns: 3, postponeLastTurn: 30 },
} as const;

const n = ch1Numbers;

export const ch1Balance: ChapterBalance = {
  turnLimit: n.turnLimit,
  warnTurn: n.warnTurn,
  stats: {
    ...commonBalance.stats,
    'yield.gather': 1.6,
    'yield.hunt': 2.0,
    'yield.craft': 0.5,
    'yield.ritual.lore': 0.5,
    'yield.ritual.cohesion': 0.3,
    'consume.food': 1.0,
    /** 인구 1명당 계절마다 닳는 도구 (10명당 1) */
    'wear.tools': 0.1,
    'storage.food.perPop': 4,
    'spoil.food': 0.1,
    'growth.rate': 0.04,
    'actions.perTurn': 2,
  },
  globalModifiers: [
    {
      stat: 'actions.perTurn',
      op: 'add',
      value: 1,
      when: [{ type: 'resource', key: 'cohesion', min: n.cohesionActions.highAt }],
      sourceKey: 'mod.cohesionHigh',
    },
    {
      stat: 'actions.perTurn',
      op: 'add',
      value: -1,
      when: [{ type: 'not', of: { type: 'resource', key: 'cohesion', min: n.cohesionActions.lowBelow } }],
      sourceKey: 'mod.cohesionLow',
    },
  ],
  upkeep: [
    { resource: 'food', perCapitaStat: 'consume.food' },
    { resource: 'tools', perCapitaStat: 'wear.tools' },
  ],
  storage: [{ resource: 'food', capPerCapitaStat: 'storage.food.perPop', spoilStat: 'spoil.food' }],
  cohesionResource: 'cohesion',
  totalCounters: { lore: 'lore_total' },
  starvation: { resource: 'food', cohesionPerDeficit: 1, popLossRate: 0.1, hungerTurnsForLoss: 2 },
  growth: { cohesionMin: 40, rateStat: 'growth.rate' },
  depletion: { perTurn: 0.03, max: 0.3, recoverPerTurn: 0.05 },
  roleLossOrder: ['ritual', 'craft', 'guard', 'hunt', 'gather'],
  newcomerRole: 'gather',
  actions: { stat: 'actions.perTurn', min: 1, max: 4 },
};
