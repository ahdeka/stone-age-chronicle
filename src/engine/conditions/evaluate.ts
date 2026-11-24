// 단일 조건 평가기 (DESIGN.md §5.1). 난수를 쓰지 않는다.

import type { ChapterDefinition, Condition, GameState, NumRange, Person, PersonQuery } from '../types';
import { findPolicy, monthDef } from '../core/lookup';
import { ageYears, bandDef, countBand, dailyFoodTotal, laborUnits, living, population } from '../people/people';
import { totalKg } from '../stores/food';
import { firewoodPerDay } from '../stats/stats';
import { currentEntry, currentPlace } from '../policy/current';

export function inRange(value: number, r: NumRange): boolean {
  if (r.min !== undefined && value < r.min) return false;
  if (r.max !== undefined && value > r.max) return false;
  return true;
}

export function matchPerson(def: ChapterDefinition, state: GameState, p: Person, q: PersonQuery): boolean {
  if (p.alive !== (q.alive ?? true)) return false;
  if (q.band && !q.band.includes(bandDef(def, ageYears(state, p)).id)) return false;
  if (q.sex && p.sex !== q.sex) return false;
  if (q.trait !== undefined && !p.traits.includes(q.trait)) return false;
  if (q.skill && (p.skills[q.skill.id] ?? 0) < q.skill.min) return false;
  if (q.seat !== undefined && p.advisor?.seat !== q.seat) return false;
  if (q.isChief !== undefined && (p.isChief ?? false) !== q.isChief) return false;
  if (q.ailing !== undefined && p.ailments.length > 0 !== q.ailing) return false;
  return true;
}

/** 사건·방침에 바인딩된 인물: 슬롯 → 인물 id. 'leader'는 방침을 이끄는 인물 */
export type Actors = Readonly<Record<string, string>>;
const NO_ACTORS: Actors = {};

export function foodDays(def: ChapterDefinition, state: GameState): number {
  const per = dailyFoodTotal(def, state);
  return per > 0 ? totalKg(state.stores.food) / per : Infinity;
}

export function firewoodDays(def: ChapterDefinition, state: GameState): number {
  const per = firewoodPerDay(def, state);
  return per > 0 ? state.stores.firewood / per : Infinity;
}

export function workers(def: ChapterDefinition, state: GameState): number {
  return living(state).reduce((a, p) => a + laborUnits(def, state, p), 0);
}

export function evaluate(def: ChapterDefinition, state: GameState, c: Condition, actors: Actors = NO_ACTORS): boolean {
  switch (c.type) {
    case 'food': {
      const lots = c.kinds ? state.stores.food.filter((l) => c.kinds!.includes(l.kind)) : state.stores.food;
      return inRange(totalKg(lots), c);
    }
    case 'foodDays':
      return inRange(foodDays(def, state), c);
    case 'firewood':
      return inRange(state.stores.firewood, c);
    case 'firewoodDays':
      return inRange(firewoodDays(def, state), c);
    case 'goods':
      return inRange(state.stores.goods[c.id] ?? 0, c);
    case 'cohesion':
      return inRange(state.cohesion, c);
    case 'hungerStage':
      return inRange(state.hungerStage, c);
    case 'population':
      return inRange(c.band ? countBand(def, state, c.band) : population(state), c);
    case 'workers':
      return inRange(workers(def, state), c);
    case 'person': {
      const n = living(state).filter((p) => matchPerson(def, state, p, c.match)).length;
      return c.count ? inRange(n, c.count) : n > 0;
    }
    case 'actor': {
      const id = actors[c.slot] ?? (c.slot === 'leader' ? currentEntry(state)?.bound.leaderId : undefined);
      const p = id ? state.people[id] : undefined;
      if (!p) return false;
      return c.match ? matchPerson(def, state, p, c.match) : p.alive;
    }
    case 'season':
      return c.in.includes(monthDef(def, state).season);
    case 'monthOfYear':
      return c.in.includes(monthDef(def, state).id);
    case 'month':
      return inRange(state.month, c);
    case 'weather': {
      if (c.at === 'outlook') return state.work.weather.some((w) => c.in.includes(w));
      const w = state.work.weather[Math.min(state.work.phasesDone, 2)];
      return w !== undefined && c.in.includes(w);
    }
    case 'animal': {
      const a = state.animals[c.id];
      if (!a) return false;
      if (c.state && !c.state.includes(a.state)) return false;
      if (c.at !== undefined && a.at !== (c.at === '$place' ? (currentPlace(state) ?? state.campPlace) : c.at)) return false;
      if (c.known !== undefined && a.known !== c.known) return false;
      return true;
    }
    case 'animalVar':
      return inRange(state.animals[c.id]?.vars[c.var] ?? 0, c);
    case 'place': {
      const p = state.places[c.id];
      if (!p) return false;
      if (c.discovered !== undefined && p.discovered !== c.discovered) return false;
      if (c.fact !== undefined && !p.facts.includes(c.fact)) return false;
      return true;
    }
    case 'placeStock':
      return inRange(state.places[c.id]?.stock[c.yield] ?? 0, c);
    case 'shelter':
      return c.in.includes(state.shelter.kind);
    case 'flag': {
      const set = state.flags[c.id];
      const present = set !== undefined;
      if (present !== (c.present ?? true)) return false;
      if (present && c.sinceMonths) return inRange(state.month - set, c.sinceMonths);
      return true;
    }
    case 'counter':
      return inRange(state.counters[c.id] ?? 0, c);
    case 'knowledge':
      return state.knowledge.has.includes(c.id) === (c.has ?? true);
    case 'clue':
      return state.clues.some((x) => x.id === c.id) === (c.has ?? true);
    case 'cache': {
      const stale = def.balance.cache.staleAfterMonths;
      // '$place': 이번 달 방침이 가는 곳 (후보를 만들 때는 그 후보의 곳)
      const at = c.at === '$place' ? (currentPlace(state) ?? state.campPlace) : c.at;
      const found = state.caches.filter(
        (x) => (at === undefined || x.place === at) && (c.known === undefined || state.month - x.checkedMonth < stale === c.known),
      );
      return found.length > 0 === (c.has ?? true);
    }
    case 'policy':
      // 이번 달 전략 중 하나라도 맞으면 (두 칸 모두 본다)
      return state.work.plan.some(
        (e) => (c.id === undefined || e.bound.policyId === c.id) && (c.category === undefined || findPolicy(def, e.bound.policyId).category === c.category),
      );
    case 'facility':
      return inRange(state.facilities[c.id] ?? 0, c.min === undefined && c.max === undefined ? { min: 1 } : c);
    case 'all':
      return c.of.every((x) => evaluate(def, state, x, actors));
    case 'any':
      return c.of.some((x) => evaluate(def, state, x, actors));
    case 'not':
      return !evaluate(def, state, c.of, actors);
    default: {
      const never: never = c;
      throw new Error(`unknown condition: ${JSON.stringify(never)}`);
    }
  }
}

export function allTrue(def: ChapterDefinition, state: GameState, cs: readonly Condition[] | undefined, actors: Actors = NO_ACTORS): boolean {
  if (!cs) return true;
  return cs.every((c) => evaluate(def, state, c, actors));
}

/** 실패한 조건 목록 (잠긴 선택지의 힌트용) */
export function failedConditions(def: ChapterDefinition, state: GameState, cs: readonly Condition[] | undefined, actors: Actors = NO_ACTORS): Condition[] {
  return (cs ?? []).filter((c) => !evaluate(def, state, c, actors));
}
