// 이번 달 전략(plan)의 지금 맥락. 다른 엔진 모듈이 두루 쓰므로 타입 외에는 아무것도 가져오지 않는다.

import type { FoodLot, GameState, Id, PlanEntry } from '../types';

/** 지금 단계를 실행하는 전략. 마을 살림·마을 소식 중에는 주 전략(plan[0]) */
export function currentEntry(state: GameState): PlanEntry | undefined {
  const w = state.work;
  return (w.active !== undefined ? w.plan[w.active] : undefined) ?? w.plan[0];
}

/** '$place': 후보를 만들 때는 그 후보의 곳, 진행 중에는 지금 전략의 원정지 */
export function currentPlace(state: GameState): Id | undefined {
  return state.work.probePlace ?? currentEntry(state)?.place;
}

/** 지금 전략의 짐 (전략이 없으면 따로 두는 짐) */
export function currentHaul(state: GameState): FoodLot[] {
  return currentEntry(state)?.haul ?? state.work.haul;
}

/** 마을 일에서 빠진 사람: 모든 전략의 무리 (원정과 마을 안 작업 무리) */
export function planCrew(state: GameState): Set<Id> {
  const out = new Set<Id>();
  for (const e of state.work.plan) for (const id of e.bound.crew) out.add(id);
  return out;
}
