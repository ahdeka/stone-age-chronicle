// 사람: 나이, 연령대, 노동, 소비 (DESIGN.md §3.2, §10.1)

import type { AgeBand, AgeBandDef, ChapterDefinition, GameState, Person } from '../types';
import { findAilment } from '../core/lookup';

export function ageYears(state: GameState, p: Person, month = state.month): number {
  return Math.floor((month - p.birthMonth) / 12);
}

export function bandDef(def: ChapterDefinition, age: number): AgeBandDef {
  let found = def.ageBands[0];
  for (const b of def.ageBands) if (age >= b.fromAge && (!found || b.fromAge >= found.fromAge)) found = b;
  if (!found) throw new Error('no age bands');
  return found;
}

export function band(def: ChapterDefinition, state: GameState, p: Person, month = state.month): AgeBand {
  return bandDef(def, ageYears(state, p, month)).id;
}

export function living(state: GameState): Person[] {
  return Object.values(state.people).filter((p) => p.alive);
}

export function population(state: GameState): number {
  let n = 0;
  for (const p of Object.values(state.people)) if (p.alive) n++;
  return n;
}

export function countBand(def: ChapterDefinition, state: GameState, b: AgeBand): number {
  return living(state).filter((p) => band(def, state, p) === b).length;
}

export function isVulnerable(def: ChapterDefinition, state: GameState, p: Person): boolean {
  return bandDef(def, ageYears(state, p)).vulnerable || p.ailments.length > 0;
}

export function cannotWork(def: ChapterDefinition, p: Person): boolean {
  return p.ailments.some((a) => findAilment(def, a.kind).noLabor);
}

/** 한 사람의 노동 단위 (아이 0, 노인 0.5, 다치거나 아프면 0) */
export function laborUnits(def: ChapterDefinition, state: GameState, p: Person): number {
  if (!p.alive || cannotWork(def, p)) return 0;
  return bandDef(def, ageYears(state, p)).labor;
}

/** 일할 수 있는 성인 = 화면의 "일할 사람" (§B4.3): 무리에 붙일 수 있는 성인 — 다치거나 아프지 않고, 족장이 아닌 사람
 *  (족장은 무리에 뽑지 않는다, crew.includeChief). 노인은 들지 않는다(마을 일에 0.5로 보탠다). 줄기로 떠난 사람은 R3에서 뺀다.
 *  지표 바·전략 팝업 막대·막힘 이유·인원 상한이 모두 이 값을 쓴다(R2-b). 노동 값의 합(workers)은 마을 수확·조건에만 쓴다 */
export function workingAdults(def: ChapterDefinition, state: GameState): number {
  return living(state).filter((p) => !p.isChief && band(def, state, p) === 'adult' && laborUnits(def, state, p) > 0).length;
}

/** "일할 사람"에 들지 않지만 마을 일을 하는 사람: 일할 수 있는 족장 + 일할 수 있는 노인 */
export function villageHelpers(def: ChapterDefinition, state: GameState): number {
  return living(state).filter((p) => laborUnits(def, state, p) > 0 && (p.isChief || band(def, state, p) !== 'adult')).length;
}

/** 하루 소비 kg */
export function dailyFood(def: ChapterDefinition, state: GameState, p: Person): number {
  return bandDef(def, ageYears(state, p)).foodPerMonth / 30;
}

export function dailyFoodTotal(def: ChapterDefinition, state: GameState): number {
  return living(state).reduce((a, p) => a + dailyFood(def, state, p), 0);
}

export function chief(state: GameState): Person | undefined {
  return living(state).find((p) => p.isChief);
}

/** 원정대를 고르는 순서: 선호 숙련 높은 순 → id 순 (난수 없음, 미리보기와 실제가 같다) */
export function sortForCrew(people: Person[], prefer?: string): Person[] {
  return people.slice().sort((a, b) => {
    const sa = prefer ? (a.skills[prefer] ?? 0) : 0;
    const sb = prefer ? (b.skills[prefer] ?? 0) : 0;
    if (sa !== sb) return sb - sa;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
