// 화면 표시용 계산 (엔진 상태를 바꾸지 않는다)

import type { BoundPolicy, ChapterDefinition, GameState, MonthStart } from './types';
import { findAilment, findShelter } from './core/lookup';
import { foodDays } from './conditions/evaluate';
import { band, laborUnits, living, population, workingAdults } from './people/people';
import { stat } from './stats/stats';
import { totalKg } from './stores/food';

/** 지금 지표 (월초에 work.start로 남기고, 이달의 결과에서 새 값으로 쓴다) */
export function monthStartOf(def: ChapterDefinition, state: GameState): MonthStart {
  let sick = 0;
  let injured = 0;
  for (const p of living(state)) {
    if (p.ailments.length === 0) continue;
    if (p.ailments.some((a) => findAilment(def, a.kind).type === 'injury')) injured++;
    else sick++;
  }
  return {
    food: totalKg(state.stores.food),
    firewood: state.stores.firewood,
    population: population(state),
    foodDays: Math.floor(foodDays(def, state)),
    cohesion: state.cohesion,
    // 화면의 "일할 사람" (R2-b): 노동 값의 합(workers)이 아니라 일할 수 있는 성인 수
    workers: workingAdults(def, state),
    sick,
    injured,
  };
}

/** 새 게임의 빈 시작값 (첫 달을 열 때 채운다) */
export const EMPTY_START: MonthStart = { food: 0, firewood: 0, population: 0, foodDays: 0, cohesion: 0, workers: 0, sick: 0, injured: 0 };

/** 가장 추운 달에 지금 거처로 한 달 동안 태울 장작 (날씨 제외) — "겨울엔 한 달 600kg" */
export function coldestMonthFirewood(def: ChapterDefinition, state: GameState): number {
  const perDay = Math.max(...def.calendar.months.map((m) => m.firewoodPerDay));
  return perDay * findShelter(def, state.shelter.kind).firewoodMul * stat(def, state, 'firewood.burnMul') * 30;
}

/** 결속 구간 이름 id */
export function cohesionBand(def: ChapterDefinition, value: number): string {
  const bands = def.balance.ui.cohesionBands.slice().sort((a, b) => b.min - a.min);
  return (bands.find((b) => value >= b.min) ?? bands[bands.length - 1])?.id ?? '';
}

/** 방침을 고르면 원정에 나가는 사람과 마을에 남는 일할 사람 수 (R2-b: 화면 숫자는 모두 "일할 사람" = workingAdults.
 *  족장과 노인은 세지 않는다) */
export function crewSplit(def: ChapterDefinition, state: GameState, c: BoundPolicy): { crew: number; village: number } {
  const away = new Set(c.crew);
  const village = workingAdults(def, state) - living(state).filter((p) => away.has(p.id) && !p.isChief && band(def, state, p) === 'adult' && laborUnits(def, state, p) > 0).length;
  return { crew: c.crew.length, village };
}

/** 다친 사람·아픈 사람 수 */
export function ailingCount(state: GameState): number {
  return living(state).filter((p) => p.ailments.length > 0).length;
}
