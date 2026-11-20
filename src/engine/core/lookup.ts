// 장 정의에서 id로 찾기. 없는 id는 콘텐츠 오류이므로 예외를 던진다 (검증기가 미리 잡는다).

import type { ChapterDefinition, GameState, MonthDef, Phase } from '../types';
import { PHASES } from '../types';

export function byId<T extends { id: string }>(list: readonly T[], id: string, what: string): T {
  const found = list.find((x) => x.id === id);
  if (!found) throw new Error(`unknown ${what}: ${id}`);
  return found;
}

export const findPolicy = (def: ChapterDefinition, id: string) => byId(def.content.policies, id, 'policy');
export const findEvent = (def: ChapterDefinition, id: string) => byId(def.content.events, id, 'event');
export const findNarrative = (def: ChapterDefinition, id: string) => byId(def.content.narratives, id, 'narrative');
export const findPlace = (def: ChapterDefinition, id: string) => byId(def.places, id, 'place');
export const findAnimal = (def: ChapterDefinition, id: string) => byId(def.animals, id, 'animal');
export const findFoodKind = (def: ChapterDefinition, id: string) => byId(def.foodKinds, id, 'food kind');
export const findAilment = (def: ChapterDefinition, id: string) => byId(def.ailments, id, 'ailment');
export const findShelter = (def: ChapterDefinition, id: string) => byId(def.shelters, id, 'shelter');
export const findWeather = (def: ChapterDefinition, id: string) => byId(def.weather, id, 'weather');

// ── 시간 ──

export function monthIndex(state: GameState, month = state.month): number {
  return (state.startMonthIndex + month - 1) % 12;
}

export function monthDef(def: ChapterDefinition, state: GameState, month = state.month): MonthDef {
  const m = def.calendar.months[monthIndex(state, month) % def.calendar.months.length];
  if (!m) throw new Error('calendar has no months');
  return m;
}

export interface CalendarDate {
  /** 1년차부터. 년차는 calendar.yearStartsAt 달에 바뀐다 */
  year: number;
  season: string;
  /** 화면에 쓰는 달 숫자 (MonthDef.number) */
  number: number;
  monthId: string;
}

/** 화면 날짜 "1년차 · 봄 · 3월"의 재료 (DESIGN.md §3.1). 연대기처럼 지난 달도 month로 물을 수 있다 */
export function calendarDate(def: ChapterDefinition, state: GameState, month = state.month): CalendarDate {
  const len = def.calendar.months.length;
  const ys = Math.max(0, def.calendar.months.findIndex((m) => m.id === def.calendar.yearStartsAt));
  const startAbs = state.startMonthIndex;
  const abs = startAbs + Math.max(1, month) - 1;
  const year = 1 + Math.floor((abs - ys) / len) - Math.floor((startAbs - ys) / len);
  const m = monthDef(def, state, Math.max(1, month));
  return { year, season: m.season, number: m.number, monthId: m.id };
}

export function season(def: ChapterDefinition, state: GameState): string {
  return monthDef(def, state).season;
}

/** 진행 중인 순 (정산 중이면 마지막 순) */
export function currentPhase(state: GameState): Phase {
  return PHASES[Math.min(state.work.phasesDone, 2)] ?? 'late';
}

/** 게임 시작부터의 절대 순 번호 (1달 1순 = 0) */
export function phaseNo(state: GameState): number {
  return (state.month - 1) * 3 + Math.min(state.work.phasesDone, 2);
}

export function currentWeather(state: GameState): string {
  return state.work.weather[Math.min(state.work.phasesDone, 2)] ?? state.work.weather[0];
}

export function nextUid(state: GameState, prefix: string): string {
  state.seq += 1;
  return `${prefix}${state.seq}`;
}
