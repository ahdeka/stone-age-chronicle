// 헤드리스 진행: UI 없이 전략 함수로 끝까지 진행한다 (시뮬레이터, 디버그 "달 건너뛰기", 재현 테스트)

import type { ChapterDefinition, Decision, GameState, Id } from './types';
import { applyCommand } from './core/reduce';
import { findEvent } from './core/lookup';
import { optionStatuses } from './events/events';
import { LEFTOVER_OPTIONS, leftoverAvailable } from './month/month';

export interface Strategy {
  pickPolicy(def: ChapterDefinition, s: GameState): Id;
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

/** 이번 달을 정산까지 진행한다 (제자리 변경) */
export function playMonth(def: ChapterDefinition, s: GameState, strat: Strategy): void {
  for (let guard = 0; guard < 50; guard++) {
    if (s.step === 'settlement' || s.step === 'ended') return;
    if (s.step === 'decision') {
      const d = s.work.decision!;
      const opts = availableOptions(def, s, d);
      must(applyCommand(def, s, { type: 'chooseOption', uid: d.uid, optionId: strat.pickOption(def, s, d, opts) }));
    } else {
      must(applyCommand(def, s, { type: 'choosePolicy', uid: strat.pickPolicy(def, s) }));
    }
  }
  throw new Error('headless: month did not finish');
}

/** n달을 진행한다 (제자리 변경). 정산 상태에서 시작해도 된다 */
export function playMonths(def: ChapterDefinition, s: GameState, strat: Strategy, n: number): void {
  for (let i = 0; i < n && s.step !== 'ended'; i++) {
    if (s.step === 'settlement') must(applyCommand(def, s, { type: 'nextMonth' }));
    playMonth(def, s, strat);
  }
}

/** 첫 번째 후보와 첫 번째 선택지만 고르는 전략 */
export const firstChoice: Strategy = {
  pickPolicy: (_def, s) => s.work.candidates[0]!.uid,
  pickOption: (_def, _s, _d, opts) => opts[0]!,
};
