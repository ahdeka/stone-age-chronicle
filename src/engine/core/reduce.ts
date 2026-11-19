// (state, command) => newState — 엔진의 유일한 상태 변경 진입점.
// 입력 상태는 절대 바꾸지 않는다. 거부된 커맨드는 입력 상태를 그대로 돌려준다.

import type { ChapterDefinition, Command, DebugOp, GameState, ReduceResult } from '../types';
import { addAxis, addResource, setFlag } from '../effects/apply';
import { changePopulation, rolesTotal } from './population';
import { resolveTurn } from './turn';

function validateRoles(def: ChapterDefinition, state: GameState, roles: Record<string, number>): string | undefined {
  const known = new Set(def.roles.map((r) => r.id));
  for (const [id, n] of Object.entries(roles)) {
    if (!known.has(id)) return 'error.roles.unknown';
    if (!Number.isInteger(n) || n < 0) return 'error.roles.invalid';
  }
  if (rolesTotal(roles) !== state.tribe.population) return 'error.roles.sum';
  return undefined;
}

function applyDebug(def: ChapterDefinition, s: GameState, d: DebugOp): void {
  const ctx = { def, state: s, source: 'debug' };
  switch (d.op) {
    case 'setResource':
      addResource(ctx, d.key, d.value - (s.tribe.resources[d.key] ?? 0));
      return;
    case 'setAxis':
      addAxis(ctx, d.axis, d.value - (s.tribe.axes[d.axis] ?? 0));
      return;
    case 'setFlag':
      setFlag(ctx, d.id, d.set);
      return;
    case 'setPopulation':
      changePopulation(def, s, d.value - s.tribe.population);
      return;
  }
}

export function reduce(def: ChapterDefinition, state: GameState, cmd: Command): ReduceResult {
  if (state.chapterId !== def.id) return { state, error: 'error.chapterMismatch' };
  if (state.phase === 'ended') return { state, error: 'error.gameEnded' };

  switch (cmd.type) {
    case 'setRoles': {
      const err = validateRoles(def, state, cmd.roles);
      if (err) return { state, error: err };
      const s = structuredClone(state);
      for (const r of def.roles) s.tribe.roles[r.id] = cmd.roles[r.id] ?? 0;
      return { state: s };
    }
    case 'endActionPhase': {
      if (state.phase !== 'action') return { state, error: 'error.wrongPhase' };
      const s = structuredClone(state);
      resolveTurn(def, s);
      return { state: s };
    }
    case 'debug': {
      const s = structuredClone(state);
      applyDebug(def, s, cmd.debug);
      return { state: s };
    }
    default: {
      const never: never = cmd;
      return { state, error: `error.unknownCommand:${JSON.stringify(never)}` };
    }
  }
}
