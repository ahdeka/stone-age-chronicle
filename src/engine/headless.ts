// 헤드리스 진행: UI 없이 전략 함수로 끝까지 진행한다 (시뮬레이터, 디버그 "달 건너뛰기", 재현 테스트)

import type { BoundPolicy, ChapterDefinition, Decision, GameState, Id, PolicySlot } from './types';
import { applyCommand } from './core/reduce';
import { findEvent, findPolicy } from './core/lookup';
import { previewPlan } from './policy/plan';
import { optionStatuses } from './events/events';
import { LEFTOVER_OPTIONS, leftoverAvailable } from './month/month';

export interface Strategy {
  /** 이번 달 전략: 식량 uid + 발전 uid(없어도 됨), 또는 큰 일 uid 하나 */
  pickPlan(def: ChapterDefinition, s: GameState): Id[];
  /** 고를 수 있는 선택지 id 목록 중 하나 */
  pickOption(def: ChapterDefinition, s: GameState, d: Decision, options: Id[]): Id;
}

export function availableOptions(def: ChapterDefinition, s: GameState, d: Decision): Id[] {
  if (d.kind === 'leftover') return LEFTOVER_OPTIONS.filter((o) => leftoverAvailable(def, s, o));
  const ev = findEvent(def, d.eventId);
  return optionStatuses(def, s, ev, d.actors)
    .filter((x) => x.available)
    .map((x) => x.option.id);
}

function must(err: string | undefined): void {
  if (err) throw new Error(`headless: ${err}`);
}

/** 이번 턴(달 또는 철)을 정산까지 진행한다 (제자리 변경) */
export function playMonth(def: ChapterDefinition, s: GameState, strat: Strategy): void {
  for (let guard = 0; guard < 50; guard++) {
    if (s.step === 'settlement' || s.step === 'ended') return;
    if (s.step === 'decision') {
      const d = s.work.decision!;
      const opts = availableOptions(def, s, d);
      must(applyCommand(def, s, { type: 'chooseOption', uid: d.uid, optionId: strat.pickOption(def, s, d, opts) }));
    } else {
      must(applyCommand(def, s, { type: 'choosePlan', uids: strat.pickPlan(def, s) }));
    }
  }
  throw new Error('headless: month did not finish');
}

/** n턴을 진행한다 (1년차는 달, 2년차부터 철. 제자리 변경). 정산 상태에서 시작해도 된다 */
export function playMonths(def: ChapterDefinition, s: GameState, strat: Strategy, n: number): void {
  for (let i = 0; i < n && s.step !== 'ended'; i++) {
    if (s.step === 'settlement') must(applyCommand(def, s, { type: 'nextMonth' }));
    playMonth(def, s, strat);
  }
}

/** 칸별 후보 (칸 안에서는 점수 순) */
export function candidatesBySlot(def: ChapterDefinition, s: GameState): Record<PolicySlot, BoundPolicy[]> {
  const out: Record<PolicySlot, BoundPolicy[]> = { food: [], growth: [], major: [] };
  for (const c of s.work.candidates) out[findPolicy(def, c.policyId).slot].push(c);
  return out;
}

/** 식량 하나에 발전을 붙여 본다: 같이 고를 수 없으면 식량만 */
export function planWith(def: ChapterDefinition, s: GameState, food: Id, growth?: Id): Id[] {
  if (growth && !previewPlan(def, s, [food, growth]).error) return [food, growth];
  return [food];
}

/** 첫 번째 식량 후보 + 첫 번째 발전 후보(같이 고를 수 있으면), 첫 번째 선택지만 고르는 전략 */
export const firstChoice: Strategy = {
  pickPlan: (def, s) => {
    const by = candidatesBySlot(def, s);
    return planWith(def, s, by.food[0]!.uid, by.growth[0]?.uid);
  },
  pickOption: (_def, _s, _d, opts) => opts[0]!,
};

/** 턴 하나를 정산까지 (달 턴이면 한 달, 계절 턴이면 한 철). playMonth와 같다 */
export const playTurn = playMonth;
/** n턴을 진행한다 (제자리 변경). 정산 상태에서 시작해도 된다 */
export const playTurns = playMonths;
