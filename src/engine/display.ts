// 화면 표시용 계산 (엔진 상태를 바꾸지 않는다)

import type { BoundPolicy, ChapterDefinition, GameState } from './types';
import { findShelter } from './core/lookup';
import { laborUnits, living } from './people/people';
import { stat } from './stats/stats';

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

/** 방침을 고르면 원정에 나가는 사람과 마을에 남아 일하는 사람 수 */
export function crewSplit(def: ChapterDefinition, state: GameState, c: BoundPolicy): { crew: number; village: number } {
  const away = new Set(c.crew);
  const village = living(state).filter((p) => !away.has(p.id) && laborUnits(def, state, p) > 0).length;
  return { crew: c.crew.length, village };
}

/** 다친 사람·아픈 사람 수 */
export function ailingCount(state: GameState): number {
  return living(state).filter((p) => p.ailments.length > 0).length;
}
