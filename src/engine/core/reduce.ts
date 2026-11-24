// (state, command) => newState — 엔진의 유일한 상태 변경 진입점.
// 입력 상태는 절대 바꾸지 않는다. 거부된 명령은 입력 상태를 그대로 돌려준다.

import type { ChapterDefinition, Command, DebugOp, GameState, ReduceResult } from '../types';
import { addCohesion, killPerson, setFlag } from '../effects/apply';
import { choosePlan, chooseOption, forceEvent, nextMonth, runCtx } from '../month/month';

function applyDebug(def: ChapterDefinition, s: GameState, d: DebugOp): string | undefined {
  switch (d.op) {
    case 'setFood':
      s.stores.food = s.stores.food.filter((l) => l.kind !== d.kind);
      if (d.kg > 0) s.stores.food.push({ kind: d.kind, kg: d.kg });
      return undefined;
    case 'setFirewood':
      s.stores.firewood = Math.max(0, d.kg);
      return undefined;
    case 'setCohesion':
      addCohesion(s, def, d.value - s.cohesion);
      return undefined;
    case 'setFlag':
      setFlag(s, d.id, d.set);
      return undefined;
    case 'kill': {
      const p = s.people[d.personId];
      if (!p || !p.alive) return 'error.unknownPerson';
      killPerson(runCtx(def, s, {}, 'debug'), p, 'debug');
      return undefined;
    }
    case 'forceEvent':
      return forceEvent(def, s, d.eventId);
  }
}

/**
 * 명령을 상태에 제자리 적용한다. 모든 처리기는 검증을 먼저 끝내고 나서 상태를 바꾸므로,
 * 오류를 돌려줄 때 상태는 바뀌지 않았다. 시뮬레이터처럼 복제 비용을 아끼려는 곳에서만 직접 쓴다.
 */
export function applyCommand(def: ChapterDefinition, s: GameState, cmd: Command): string | undefined {
  if (s.chapterId !== def.id) return 'error.chapterMismatch';
  if (s.step === 'ended') return 'error.gameEnded';
  switch (cmd.type) {
    case 'choosePlan':
      return choosePlan(def, s, cmd.uids);
    case 'chooseOption':
      return chooseOption(def, s, cmd.uid, cmd.optionId);
    case 'nextMonth':
      return nextMonth(def, s);
    case 'debug':
      return applyDebug(def, s, cmd.debug);
    default: {
      const never: never = cmd;
      return `error.unknownCommand:${JSON.stringify(never)}`;
    }
  }
}

export function reduce(def: ChapterDefinition, state: GameState, cmd: Command): ReduceResult {
  const s = structuredClone(state);
  const error = applyCommand(def, s, cmd);
  return error ? { state, error } : { state: s };
}
