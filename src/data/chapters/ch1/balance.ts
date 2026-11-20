// 1장 수치 (DESIGN.md §10). 기준점은 docs/playtest-log.md의 시험 플레이다.

import type { AgeBandDef, ChapterBalance } from '../../../engine';
import { commonBalance } from '../../balance';

/** 월 소비: 성인 30kg, 노인 25kg, 아이 18kg (시험 플레이 규칙) */
export const ch1AgeBands: AgeBandDef[] = [
  { id: 'child', fromAge: 0, foodPerMonth: 18, labor: 0, vulnerable: true },
  { id: 'adult', fromAge: 14, foodPerMonth: 30, labor: 1, vulnerable: false },
  { id: 'elder', fromAge: 50, foodPerMonth: 25, labor: 0.5, vulnerable: true },
];

export const ch1Balance: ChapterBalance = {
  ...commonBalance,
  monthLimit: 60,
  stats: {
    'firewood.burnMul': 1,
    'yield.wood': 1,
    'yield.gather': 1,
    'yield.fish': 1,
    /** 한 사람이 나르는 kg (시험 플레이: 14명이 450kg) */
    'carry.perPerson': 32,
    'spoil.mul': 1,
    /** 배급 상한 (배급 줄이기 방침이 낮춘다) */
    'ration.cap': 1,
    /** 날씨가 사냥에 주는 힘 보정 */
    'hunt.weather': 0,
    /** 단서·사건이 사냥에 주는 힘 보정 */
    'hunt.bonus': 0,
  },
  ration: {
    reduced: 0.75,
    recoverPerPhase: 5,
    collapseDays: { vulnerable: 12, others: 25 },
    collapseChance: 0.03,
    collapseSlopeDays: 30,
    collapseMax: 0.25,
    efficiency: [1, 0.9, 0.7],
    cohesionPerPhase: [0, -2, -5],
    sicknessChance: 0.06,
    sickness: 'cough',
    sickDeathMul: 2,
  },
  cold: { sickChance: 0.15, sickness: 'cough', deathChance: 0.02, cohesion: -4 },
  chores: { firewoodTargetPhases: 2, firewoodShareLow: 0.4, firewoodShareNormal: 0.15 },
  carry: {
    multiTripMaxDays: 2,
    maxTrips: 3,
    askLeftoverKg: 30,
    dryYield: 0.8,
    dryKind: 'dried_meat',
    dryKnowledge: 'meat_drying',
    abandonCohesion: -2,
  },
  cache: {
    spoilMul: 1.5,
    scentPerMonth: 1,
    raidAnimal: 'wolves',
    raidChancePerScent: 0.15,
    raidLoss: [0.3, 0.8],
    staleAfterMonths: 1,
  },
};
