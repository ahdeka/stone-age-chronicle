// (state, command) => newState — 엔진의 유일한 상태 변경 진입점.
// 입력 상태는 절대 바꾸지 않는다. 거부된 커맨드는 입력 상태를 그대로 돌려준다.

import type { ChapterDefinition, Command, DebugOp, GameState, ReduceResult } from '../types';
import { playAction } from '../actions/actions';
import { addAxis, addResource, setFlag } from '../effects/apply';
import { chooseOption, forceEvent } from '../events/events';
import { changePopulation, rolesTotal } from './population';
import { resolveTurn, startActionPhase } from './turn';

function validateRoles(def: ChapterDefinition, state: GameState, roles: Record<string, number>): string | undefined {
  const known = new Set(def.roles.map((r) => r.id));
  for (const [id, n] of Object.entries(roles)) {
    if (!known.has(id)) return 'error.roles.unknown';
    if (!Number.isInteger(n) || n < 0) return 'error.roles.invalid';
  }
  if (rolesTotal(roles) !== state.tribe.population) return 'error.roles.sum';
  return undefined;
}

function applyDebug(def: ChapterDefinition, s: GameState, d: DebugOp): string | undefined {
  const ctx = { def, state: s, source: 'debug' };
  switch (d.op) {
    case 'setResource':
      addResource(ctx, d.key, d.value - (s.tribe.resources[d.key] ?? 0));
      return undefined;
    case 'setAxis':
      addAxis(ctx, d.axis, d.value - (s.tribe.axes[d.axis] ?? 0));
      return undefined;
    case 'setFlag':
      setFlag(ctx, d.id, d.set);
      return undefined;
    case 'setPopulation':
      changePopulation(def, s, d.value - s.tribe.population);
      return undefined;
    case 'forceEvent':
      return forceEvent(def, s, d.eventId);
  }
}

/**
 * 커맨드를 상태에 제자리 적용한다. 모든 처리기는 검증을 먼저 끝내고 나서 상태를 바꾸므로,
 * 오류를 돌려줄 때 상태는 바뀌지 않았다. 시뮬레이터처럼 복제 비용을 아끼려는 곳에서만 직접 쓴다.
 */
export function applyCommand(def: ChapterDefinition, s: GameState, cmd: Command): string | undefined {
  if (s.chapterId !== def.id) return 'error.chapterMismatch';
  if (s.phase === 'ended') return 'error.gameEnded';

  switch (cmd.type) {
    case 'setRoles': {
      const err = validateRoles(def, s, cmd.roles);
      if (err) return err;
      for (const r of def.roles) s.tribe.roles[r.id] = cmd.roles[r.id] ?? 0;
      return undefined;
    }
    case 'chooseOption': {
      const err = chooseOption(def, s, cmd.eventUid, cmd.optionId);
      if (err) return err;
      if (s.events.pending.length === 0) startActionPhase(def, s);
      return undefined;
    }
    case 'playAction':
      return playAction(def, s, cmd.cardUid, cmd.personId);
    case 'endActionPhase':
      if (s.phase !== 'action') return 'error.wrongPhase';
      resolveTurn(def, s);
      return undefined;
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
