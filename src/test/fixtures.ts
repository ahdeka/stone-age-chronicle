// 테스트 공용 픽스처.
// - ch1Full: 실제 1장 정의 그대로
// - ch1: 이벤트를 뺀 1장. 경제·턴 처리 테스트가 이벤트 단계에 막히지 않고 정확한 수치를 확인할 수 있다.

import { ch1 as ch1Full } from '../data/chapters/ch1/chapter';
import {
  createGame,
  optionStatuses,
  reduce,
  type ChapterDefinition,
  type Command,
  type GameState,
} from '../engine';

const quiet = structuredClone(ch1Full);
quiet.content.events = [];
export const ch1: ChapterDefinition = quiet;
export { ch1Full };

export function newGame(seed = 'test-seed', def: ChapterDefinition = ch1): GameState {
  return createGame(def, { kind: 'preset', presetId: 'default', tribeTraits: [], seed });
}

/** 정의를 복제해서 고친다 (원본은 건드리지 않는다). 기본은 이벤트 없는 1장 */
export function tweakDef(fn: (d: ChapterDefinition) => void, base: ChapterDefinition = ch1): ChapterDefinition {
  const d = structuredClone(base);
  fn(d);
  return d;
}

export function run(def: ChapterDefinition, state: GameState, cmd: Command): GameState {
  const r = reduce(def, state, cmd);
  if (r.error) throw new Error(`command rejected: ${r.error} (${JSON.stringify(cmd)})`);
  return r.state;
}

/** 이벤트가 있으면 고를 수 있는 첫 선택지로 넘긴다 */
export function resolveEvents(def: ChapterDefinition, state: GameState): GameState {
  let s = state;
  while (s.phase === 'event') {
    const inst = s.events.pending[0]!;
    const opt = optionStatuses(def, s, inst).find((o) => o.available);
    if (!opt) throw new Error(`no available option for ${inst.eventId}`);
    s = run(def, s, { type: 'chooseOption', eventUid: inst.uid, optionId: opt.option.id });
  }
  return s;
}

export function endTurns(def: ChapterDefinition, state: GameState, n: number): GameState {
  let s = state;
  for (let i = 0; i < n && s.phase !== 'ended'; i++) {
    s = resolveEvents(def, s);
    s = run(def, s, { type: 'endActionPhase' });
  }
  return resolveEvents(def, s);
}
