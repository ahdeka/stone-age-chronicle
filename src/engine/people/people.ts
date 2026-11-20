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
