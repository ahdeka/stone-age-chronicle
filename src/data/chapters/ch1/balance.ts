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
  /** 1년차는 한 달 한 턴, 2년차부터 한 철 한 턴 (DESIGN.md §B2) */
  turn: { seasonFromYear: 2, maxSeasonMonths: 3, eventsPerSeason: 1 },
  stats: {
    'firewood.burnMul': 1,
    'yield.wood': 1,
    'yield.gather': 1,
    'yield.fish': 1,
    /** 계절 수확: 기본 0, 장 전역 모디파이어가 철에 맞춰 켠다 (world.ts ch1GlobalMods). 올가미는 올가미 방침만 켠다 */
    'yield.fish_run': 0,
    'yield.eggs': 0,
    'yield.greens': 0,
    'yield.nuts': 0,
    'yield.snare': 0,
    /** 마을 일손 배율 (장례 등으로 한동안 일손이 빠질 때 낮춘다) */
    'village.labor': 1,
    /** 겨울 여울목 물고기 (겨울 수확에만 있다) */
    'yield.winter_fish': 1,
    /** 묻어 둔 고기를 짐승이 노리는 정도 (저장 구덩이가 줄인다) */
    'cache.raid': 1,
    /** 쌓아 둘 수 있는 장작 kg (천막 기준. 바위굴 +900, 장작 덧집 +600) */
    'firewood.cap': 700,
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
    starveRatio: 0.4,
    starveAfterPhases: 3,
    /** 배급이 다 차면 결속이 평소(봄 시작값 55)까지 돌아온다 (DESIGN.md §10.6, ③a) */
    recoverCohesion: { perPhase: 1, upTo: 55 },
    recoverPerPhase: 5,
    collapseDays: { vulnerable: 12, others: 25 },
    collapseChance: 0.03,
    collapseSlopeDays: 30,
    collapseMax: 0.25,
    efficiency: [1, 0.9, 0.7],
    cohesionPerPhase: [0, -1, -3],
    sicknessChance: 0.06,
    sickness: 'cough',
    sickDeathMul: 2,
  },
  cold: { sickChance: 0.15, sickness: 'cough', deathChance: 0.02, cohesion: -4 },
  chores: { firewoodTargetPhases: 2, firewoodShareLow: 0.3, firewoodShareNormal: 0.15 },
  carry: {
    multiTripMaxDays: 2,
    maxTrips: 3,
    askLeftoverKg: 30,
    dryYield: 0.8,
    dryKind: 'dried_meat',
    dryKnowledge: 'meat_drying',
    abandonCohesion: -2,
    portersMaxDays: 4,
    porters: 8,
    porterTrips: 1,
    porterVillageMul: 0.5,
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
