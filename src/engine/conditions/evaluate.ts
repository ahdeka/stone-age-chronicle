// 단일 조건 평가기 (DESIGN.md §4.1). 난수를 쓰지 않는다.

import type { ChapterDefinition, Condition, GameState, NumRange, Person, PersonQuery } from '../types';
import { findRegion } from '../core/lookup';

export function inRange(value: number, r: NumRange): boolean {
  if (r.min !== undefined && value < r.min) return false;
  if (r.max !== undefined && value > r.max) return false;
  return true;
}

export function matchPerson(p: Person, q: PersonQuery): boolean {
  if (p.alive !== (q.alive ?? true)) return false;
  if (q.office !== undefined && p.office !== q.office) return false;
  if (q.trait !== undefined && !p.traits.includes(q.trait)) return false;
  if (q.stage !== undefined && !q.stage.includes(p.stage)) return false;
  if (q.relation !== undefined && !inRange(p.relation, q.relation)) return false;
  return true;
}

export function findChief(def: ChapterDefinition, state: GameState): Person | undefined {
  const chiefOffice = def.offices.find((o) => o.isChief)?.id;
  if (chiefOffice === undefined) return undefined;
  return Object.values(state.people).find((p) => p.alive && p.office === chiefOffice);
}

export function evaluate(def: ChapterDefinition, state: GameState, c: Condition): boolean {
  const t = state.tribe;
  switch (c.type) {
    case 'resource':
      return inRange(t.resources[c.key] ?? 0, c);
    case 'population':
      return inRange(t.population, c);
    case 'role':
      return inRange(t.roles[c.role] ?? 0, c);
    case 'axis':
      return inRange(t.axes[c.axis] ?? 0, c);
    case 'lifestyle':
      return t.lifestyle === c.is;
    case 'tribeTrait':
      return t.traits.includes(c.id);
    case 'season':
      return c.in.includes(state.season);
    case 'turn':
      return inRange(state.turn, c);
    case 'reign':
      return inRange(state.reign, c);
    case 'era':
      return state.eraId === c.is;
    case 'flag': {
      const setTurn = state.flags[c.id];
      const present = setTurn !== undefined;
      if (present !== (c.present ?? true)) return false;
      if (present && c.sinceTurns) return inRange(state.turn - setTurn, c.sinceTurns);
      return true;
    }
    case 'counter':
      return inRange(state.counters[c.id] ?? 0, c);
    case 'eventSeen':
      return (state.events.history[c.id] !== undefined) === (c.present ?? true);
    case 'knowledge':
      return state.knowledge.includes(c.id) === (c.has ?? true);
    case 'tradition':
      return Object.values(state.traditions).some((tr) => tr?.id === c.id);
    case 'region': {
      const r = findRegion(def, state.regions.current);
      if (!r) return false;
      if (c.current !== undefined && r.id !== c.current) return false;
      if (c.special !== undefined && !r.specials.includes(c.special)) return false;
      if (c.tag !== undefined && !r.tags.includes(c.tag)) return false;
      if (c.depth !== undefined && !inRange(r.depth, c.depth)) return false;
      return true;
    }
    case 'regionDiscovered':
      return state.regions.discovered.includes(c.id);
    case 'person': {
      const n = Object.values(state.people).filter((p) => matchPerson(p, c.match)).length;
      return inRange(n, c.count ?? { min: 1 });
    }
    case 'chief': {
      const chief = findChief(def, state);
      return chief !== undefined && matchPerson(chief, c.match);
    }
    case 'all':
      return c.of.every((x) => evaluate(def, state, x));
    case 'any':
      return c.of.some((x) => evaluate(def, state, x));
    case 'not':
      return !evaluate(def, state, c.of);
    default: {
      const never: never = c;
      throw new Error(`unknown condition: ${JSON.stringify(never)}`);
    }
  }
}

export interface EvalResult {
  ok: boolean;
  /** 실패한 최상위 조건. 잠긴 선택지 힌트를 만들 때 쓴다. */
  failed: Condition[];
}

/** 목록은 AND. 실패한 조건을 모두 모은다. */
export function evaluateAll(def: ChapterDefinition, state: GameState, conds: readonly Condition[] | undefined): EvalResult {
  const failed: Condition[] = [];
  for (const c of conds ?? []) if (!evaluate(def, state, c)) failed.push(c);
  return { ok: failed.length === 0, failed };
}

export function allTrue(def: ChapterDefinition, state: GameState, conds: readonly Condition[] | undefined): boolean {
  return (conds ?? []).every((c) => evaluate(def, state, c));
}
