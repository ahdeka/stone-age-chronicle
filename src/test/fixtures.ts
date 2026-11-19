// 테스트 공용 픽스처. 실제 1장 정의를 쓰고, 필요한 테스트만 복제본을 고친다.

import { ch1 } from '../data/chapters/ch1/chapter';
import { createGame, reduce, type ChapterDefinition, type Command, type GameState } from '../engine';

export function newGame(seed = 'test-seed', def: ChapterDefinition = ch1): GameState {
  return createGame(def, { kind: 'preset', presetId: 'default', tribeTraits: [], seed });
}

/** 정의를 복제해서 고친다 (원본 ch1은 건드리지 않는다) */
export function tweakDef(fn: (d: ChapterDefinition) => void): ChapterDefinition {
  const d = structuredClone(ch1);
  fn(d);
  return d;
}

export function run(def: ChapterDefinition, state: GameState, cmd: Command): GameState {
  const r = reduce(def, state, cmd);
  if (r.error) throw new Error(`command rejected: ${r.error}`);
  return r.state;
}

export function endTurns(def: ChapterDefinition, state: GameState, n: number): GameState {
  let s = state;
  for (let i = 0; i < n && s.phase !== 'ended'; i++) s = run(def, s, { type: 'endActionPhase' });
  return s;
}

export { ch1 };
