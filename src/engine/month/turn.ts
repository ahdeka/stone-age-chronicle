// 턴 종류 (DESIGN.md §B2): 1년차는 한 달 한 턴, 2년차부터 한 철 한 턴.
// 엔진의 달(state.month)은 언제나 실제 달이다. 계절 턴은 "전략을 한 번 고르고 달 셋을 잇달아 처리"한다.

import type { ChapterDefinition, GameState, TurnInfo, TurnKind } from '../types';
import { calendarDate, monthDef } from '../core/lookup';

/** 이 달에 시작하는 턴의 종류 */
export function turnKindAt(def: ChapterDefinition, state: GameState, month: number): TurnKind {
  return calendarDate(def, state, month).year >= def.balance.turn.seasonFromYear ? 'season' : 'month';
}

/** 이 달에 시작하는 턴: 계절 턴이면 같은 철이 이어지는 달 수(최대 maxSeasonMonths) */
export function turnAt(def: ChapterDefinition, state: GameState, month: number): TurnInfo {
  const kind = turnKindAt(def, state, month);
  if (kind === 'month') return { kind, months: 1, stage: 0, firstMonth: month };
  const season = monthDef(def, state, month).season;
  let months = 1;
  while (months < def.balance.turn.maxSeasonMonths && monthDef(def, state, month + months).season === season) months++;
  return { kind, months, stage: 0, firstMonth: month };
}

export function isSeasonTurn(state: GameState): boolean {
  return state.work.turn.kind === 'season';
}
