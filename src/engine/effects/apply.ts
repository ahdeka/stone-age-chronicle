// 단일 효과 적용기 (DESIGN.md §4.2). 상태를 제자리에서 바꾼다 — reduce가 넘겨준 복제본에만 호출할 것.
// 효과는 목록 순서대로 적용하고, 모든 변화는 turnLog에 남긴다.

import type { ChapterDefinition, Effect, GameState, Person, PersonRef, PowerTerm } from '../types';
import { allTrue, findChief, type Actors } from '../conditions/evaluate';
import { addCardToDeck, removeCardFromDeck } from '../actions/deck';
import { chronicleParams } from '../chronicle/chronicle';
import { axisRange, clamp, resourceRange, round4 } from '../core/lookup';
import { changePopulation } from '../core/population';
import { chance, weightedIndex } from '../rng/rng';
import { stat } from '../stats/stats';

export interface EffectCtx {
  def: ChapterDefinition;
  state: GameState;
  /** 로그 출처 (예: 'season.winter', 'event.hungry_neighbors.share') */
  source: string;
  actors?: Actors;
}

const RELATION_MIN = -100;
const RELATION_MAX = 100;

export function addResource(ctx: EffectCtx, key: string, delta: number): number {
  const { def, state } = ctx;
  const { min, max } = resourceRange(def, key);
  const before = state.tribe.resources[key] ?? 0;
  const after = round4(clamp(before + delta, min, max));
  state.tribe.resources[key] = after;
  const applied = round4(after - before);
  if (applied !== 0) state.turnLog.push({ kind: 'resource', key, delta: applied, source: ctx.source });
  // 얻은 양을 누적 카운터에 더한다 (출처와 상관없이: 역할, 카드, 이벤트 모두)
  const counter = def.balance.totalCounters[key];
  if (counter !== undefined && applied > 0) state.counters[counter] = round4((state.counters[counter] ?? 0) + applied);
  return applied;
}

export function addAxis(ctx: EffectCtx, axis: string, delta: number): number {
  const { def, state } = ctx;
  const { min, max } = axisRange(def, axis);
  const before = state.tribe.axes[axis] ?? 0;
  const after = round4(clamp(before + delta, min, max));
  state.tribe.axes[axis] = after;
  const applied = round4(after - before);
  if (applied !== 0) state.turnLog.push({ kind: 'axis', axis, delta: applied, source: ctx.source });
  return applied;
}

export function setFlag(ctx: EffectCtx, id: string, set: boolean): void {
  const { state } = ctx;
  const had = state.flags[id] !== undefined;
  if (set) state.flags[id] = state.turn;
  else delete state.flags[id];
  if (had !== set) state.turnLog.push({ kind: 'flag', id, set, source: ctx.source });
}

export function resolvePerson(ctx: EffectCtx, ref: PersonRef): Person | undefined {
  if (ref === 'chief') return findChief(ctx.def, ctx.state);
  const id = ctx.actors?.[ref.actor];
  const p = id === undefined ? undefined : ctx.state.people[id];
  return p?.alive ? p : undefined;
}

/** check 효과의 힘 */
export function computePower(ctx: EffectCtx, terms: readonly PowerTerm[]): number {
  const { def, state } = ctx;
  let p = 0;
  for (const t of terms) {
    switch (t.source) {
      case 'role':
        p += (state.tribe.roles[t.id] ?? 0) * t.weight;
        break;
      case 'resource':
        p += (state.tribe.resources[t.id] ?? 0) * t.weight;
        break;
      case 'population':
        p += state.tribe.population * t.weight;
        break;
      case 'stat':
        p += stat(def, state, t.id) * t.weight;
        break;
      case 'actor': {
        const person = resolvePerson(ctx, { actor: t.slot });
        if (!person) break;
        if (t.trait !== undefined && !person.traits.includes(t.trait)) break;
        if (t.office !== undefined && person.office !== t.office) break;
        p += t.weight;
        break;
      }
      case 'const':
        p += t.value;
        break;
    }
  }
  return p;
}

/** 성공 확률 = 로지스틱((힘 − 난이도) / scale) */
export function checkProbability(ctx: EffectCtx, terms: readonly PowerTerm[], difficulty: number): number {
  const scale = stat(ctx.def, ctx.state, 'check.scale');
  const x = (computePower(ctx, terms) - difficulty) / scale;
  return 1 / (1 + Math.exp(-x));
}

export function applyEffect(ctx: EffectCtx, e: Effect): void {
  const { state } = ctx;
  switch (e.type) {
    case 'resource':
      addResource(ctx, e.key, e.delta);
      return;
    case 'population': {
      const applied = changePopulation(ctx.def, state, e.delta);
      if (applied !== 0) state.turnLog.push({ kind: 'population', delta: applied, source: ctx.source });
      return;
    }
    case 'axis':
      addAxis(ctx, e.axis, e.delta);
      return;
    case 'counter':
      state.counters[e.id] = (state.counters[e.id] ?? 0) + e.delta;
      state.turnLog.push({ kind: 'counter', id: e.id, delta: e.delta, source: ctx.source });
      return;
    case 'flag':
      setFlag(ctx, e.id, e.set);
      return;
    case 'modifier':
      state.modifiers.push({ mod: e.mod, lastTurn: state.turn + e.duration - 1, sourceKey: ctx.source });
      state.turnLog.push({ kind: 'modifier', stat: e.mod.stat, turns: e.duration, source: ctx.source });
      return;
    case 'person': {
      const p = resolvePerson(ctx, e.ref);
      if (!p) return;
      const c = e.change;
      if (c.relation !== undefined) {
        const before = p.relation;
        p.relation = clamp(p.relation + c.relation, RELATION_MIN, RELATION_MAX);
        if (p.relation !== before) state.turnLog.push({ kind: 'person', personId: p.id, relation: p.relation - before, source: ctx.source });
      }
      if (c.addTrait !== undefined && !p.traits.includes(c.addTrait)) {
        p.traits.push(c.addTrait);
        state.turnLog.push({ kind: 'trait', personId: p.id, trait: c.addTrait, added: true, source: ctx.source });
      }
      if (c.removeTrait !== undefined && p.traits.includes(c.removeTrait)) {
        p.traits = p.traits.filter((t) => t !== c.removeTrait);
        state.turnLog.push({ kind: 'trait', personId: p.id, trait: c.removeTrait, added: false, source: ctx.source });
      }
      return;
    }
    case 'addCard': {
      const n = e.count ?? 1;
      for (let i = 0; i < n; i++) addCardToDeck(state, e.id);
      state.turnLog.push({ kind: 'card', cardId: e.id, delta: n, source: ctx.source });
      return;
    }
    case 'removeCard':
      if (removeCardFromDeck(state, e.id)) state.turnLog.push({ kind: 'card', cardId: e.id, delta: -1, source: ctx.source });
      return;
    case 'schedule':
      state.events.scheduled.push({
        eventId: e.eventId,
        dueTurn: state.turn + e.delay,
        chance: e.chance ?? 1,
        seq: state.seq++,
      });
      return;
    case 'delayed':
      state.delayed.push({ dueTurn: state.turn + e.delay, effects: e.effects, seq: state.seq++, sourceKey: ctx.source });
      return;
    case 'random': {
      const i = weightedIndex(
        state.rng,
        e.outcomes.map((o) => o.weight),
      );
      const chosen = e.outcomes[i];
      if (chosen) applyEffects(ctx, chosen.effects);
      return;
    }
    case 'check': {
      const p = checkProbability(ctx, e.power, e.difficulty);
      const success = chance(state.rng, p);
      state.turnLog.push({ kind: 'roll', p: round4(p), success, source: ctx.source });
      applyEffects(ctx, success ? e.success : e.failure);
      return;
    }
    case 'if':
      applyEffects(ctx, allTrue(ctx.def, state, e.when, ctx.actors) ? e.then : (e.else ?? []));
      return;
    case 'chronicle':
      state.turnLog.push({
        kind: 'chronicle',
        key: e.key,
        importance: e.importance,
        source: ctx.source,
        params: chronicleParams(ctx.def, state, ctx.actors),
      });
      return;
    default: {
      const never: never = e;
      throw new Error(`unknown effect: ${JSON.stringify(never)}`);
    }
  }
}

export function applyEffects(ctx: EffectCtx, effects: readonly Effect[]): void {
  for (const e of effects) applyEffect(ctx, e);
}
