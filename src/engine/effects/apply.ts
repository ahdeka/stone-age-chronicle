// 효과 적용기 (DESIGN.md §5.2). 모든 수치 변화는 정산 장부(ledger)와 단계 증감(deltas)에 남는다.

import type {
  Amount,
  ChapterDefinition,
  Effect,
  GameState,
  Id,
  Label,
  LineParam,
  LineParamValue,
  Person,
  PhaseReport,
  WhoRef,
} from '../types';
import { allTrue, matchPerson, type Actors } from '../conditions/evaluate';
import { findAilment, findAnimal, findNarrative, nextUid, phaseNo } from '../core/lookup';
import { living, sortForCrew } from '../people/people';
import { nextFloat, nextInt, weightedIndex } from '../rng/rng';
import { addLot } from '../stores/food';

export interface RunCtx {
  def: ChapterDefinition;
  state: GameState;
  /** 사건 슬롯과 'leader' */
  actors: Actors;
  crew: Id[];
  /** 장부에 남을 출처 키 (예: 'policy.big_hunt', 'event.wolves.fire') */
  source: string;
}

// ── 보고 ──

export function currentReport(state: GameState): PhaseReport {
  const r = state.work.reports[state.work.reports.length - 1];
  if (!r) throw new Error('no report in progress');
  return r;
}

export function ledger(state: GameState, res: Id, delta: number, source: string): void {
  if (Math.abs(delta) < 1e-9) return;
  state.work.ledger.push({ res, source, delta });
  const r = state.work.reports[state.work.reports.length - 1];
  if (r) r.deltas[res] = (r.deltas[res] ?? 0) + delta;
}

export function personLabel(p: Person): Label {
  return p.name;
}

/** '$'로 시작하는 문장 변수를 진행 맥락에서 채운다 */
export function resolveParams(ctx: RunCtx, params: Record<string, LineParam> | undefined): Record<string, LineParamValue> {
  const { state } = ctx;
  const base: Record<string, LineParamValue> = {};
  const leaderId = ctx.actors['leader'];
  const leader = leaderId ? state.people[leaderId] : undefined;
  if (leader) base['leader'] = leader.name;
  base['crew'] = ctx.crew.length;
  if (state.work.place) base['place'] = { key: `place.${state.work.place}` };
  for (const [k, v] of Object.entries(state.work.vars)) base[k] = Math.round(v);
  for (const [slot, id] of Object.entries(ctx.actors)) {
    const p = state.people[id];
    if (p) base[`actor:${slot}`] = p.name;
  }
  for (const [k, v] of Object.entries(params ?? {})) {
    if (typeof v === 'string' && v.startsWith('$')) {
      const ref = base[v.slice(1)];
      if (ref !== undefined) base[k] = ref;
    } else base[k] = v;
  }
  return base;
}

export function pushLine(ctx: RunCtx, key: string, params?: Record<string, LineParam>): void {
  currentReport(ctx.state).lines.push({ key, params: resolveParams(ctx, params) });
}

// ── 수량 ──

export function rollAmount(state: GameState, a: Amount): number {
  if (typeof a === 'number') return a;
  const [lo, hi] = a;
  if (Number.isInteger(lo) && Number.isInteger(hi)) return nextInt(state.rng, lo, hi);
  return lo + nextFloat(state.rng) * (hi - lo);
}

// ── 사람 ──

export function resolveWho(ctx: RunCtx, who: WhoRef): Person | undefined {
  const { def, state } = ctx;
  const alive = (id: Id | undefined) => {
    const p = id ? state.people[id] : undefined;
    return p && p.alive ? p : undefined;
  };
  if (who === 'chief') return living(state).find((p) => p.isChief);
  if (who === 'leader') return alive(ctx.actors['leader']);
  if ('actor' in who) return alive(ctx.actors[who.actor]);
  if ('person' in who) return alive(who.person);
  if ('crew' in who) {
    const crew = ctx.crew.map((id) => alive(id)).filter((p): p is Person => p !== undefined);
    if (crew.length === 0) return undefined;
    if (who.crew === 'random') return crew[nextInt(state.rng, 0, crew.length - 1)];
    const sorted = sortForCrew(crew, 'hunt');
    return who.crew === 'front' ? sorted[0] : sorted[sorted.length - 1];
  }
  const pool = living(state).filter((p) => matchPerson(def, state, p, who.anyone));
  if (pool.length === 0) return undefined;
  if (who.pick === 'random') return pool[nextInt(state.rng, 0, pool.length - 1)];
  return pool.slice().sort((a, b) => b.hungerDays - a.hungerDays || b.ailments.length - a.ailments.length || (a.id < b.id ? -1 : 1))[0];
}

export function killPerson(ctx: RunCtx, p: Person, cause: Id): void {
  const { def, state } = ctx;
  if (!p.alive) return;
  p.alive = false;
  p.diedMonth = state.month;
  p.cause = cause;
  p.ailments = [];
  state.work.deaths.push(p.id);
  state.work.notable = true;
  addCohesion(state, def, -def.balance.cohesion.deathCost);
  currentReport(state).lines.push({ key: 'line.death', params: { name: p.name, cause: { key: `cause.${cause}` } } });
  offerChronicle(state, 'chron.death', def.balance.chronicle.deathImportance, { name: p.name, cause: { key: `cause.${cause}` } });
}

export function injurePerson(ctx: RunCtx, p: Person, ailment: Id, severity: 1 | 2 | 3): void {
  const { def, state } = ctx;
  const a = findAilment(def, ailment);
  const span = rollAmount(state, a.phases);
  const healsAt = phaseNo(state) + Math.max(1, Math.round(span * (0.5 + severity * 0.25)));
  p.ailments.push({ kind: ailment, severity, healsAt });
  state.work.notable = true;
  currentReport(state).lines.push({ key: 'line.ailing', params: { name: p.name, ailment: { key: `ailment.${ailment}` } } });
}

// ── 그 밖의 상태 ──

export function addCohesion(state: GameState, def: ChapterDefinition, delta: number): void {
  state.cohesion = Math.max(0, Math.min(def.balance.cohesion.max, state.cohesion + delta));
}

export function setFlag(state: GameState, id: Id, set: boolean): void {
  // 값은 마지막으로 세운 달 (sinceMonths로 "이번 달에 세웠는가"를 물을 수 있다)
  if (set) state.flags[id] = state.month;
  else delete state.flags[id];
}

export function offerChronicle(state: GameState, key: string, importance: number, params?: Record<string, LineParamValue>): void {
  const cur = state.work.chronicle;
  if (!cur || importance > cur.importance) state.work.chronicle = { key, importance, params };
}

export function grantKnowledge(ctx: RunCtx, id: Id): void {
  const { state } = ctx;
  if (state.knowledge.has.includes(id)) return;
  state.knowledge.has.push(id);
  state.work.notable = true;
  currentReport(state).lines.push({ key: 'line.knowledge', params: { knowledge: { key: `knowledge.${id}` } } });
  offerChronicle(state, 'chron.knowledge', 60, { knowledge: { key: `knowledge.${id}` } });
}

export function applyNarrative(ctx: RunCtx, id: Id): void {
  const { def, state } = ctx;
  const n = findNarrative(def, id);
  const ok = n.variants.map((v, i) => ({ v, i })).filter(({ v }) => allTrue(def, state, v.when, ctx.actors));
  if (ok.length > 0) {
    const last = state.narrativeRecent[id];
    const fresh = ok.length > 1 ? ok.filter(({ i }) => i !== last) : ok;
    const pick = fresh[nextInt(state.rng, 0, fresh.length - 1)]!;
    state.narrativeRecent[id] = pick.i;
    pushLine(ctx, pick.v.text);
  }
  if (n.facts) applyEffects(ctx, n.facts);
}

export function applyEffect(ctx: RunCtx, e: Effect): void {
  const { def, state } = ctx;
  switch (e.type) {
    case 'food': {
      const kg = rollAmount(state, e.kg);
      if (e.haul) addLot(state.work.haul, e.kind, kg);
      else if (kg >= 0) {
        addLot(state.stores.food, e.kind, kg);
        ledger(state, 'food', kg, ctx.source);
      } else {
        // 음수: 마을 식량에서 덜어 낸다
        let left = -kg;
        for (const lot of state.stores.food) {
          const take = Math.min(lot.kg, left);
          lot.kg -= take;
          left -= take;
        }
        state.stores.food = state.stores.food.filter((l) => l.kg > 1e-6);
        ledger(state, 'food', -(-kg - left), ctx.source);
      }
      return;
    }
    case 'catch': {
      const a = findAnimal(def, e.animal);
      const n = Math.max(0, Math.round(rollAmount(state, e.count)));
      const meat = n * a.meatKg;
      if (ctx.crew.length > 0) addLot(state.work.haul, a.foodKind, meat);
      else {
        addLot(state.stores.food, a.foodKind, meat);
        ledger(state, 'food', meat, ctx.source);
      }
      for (const [g, per] of Object.entries(a.goods ?? {})) {
        state.stores.goods[g] = (state.stores.goods[g] ?? 0) + per * n;
        ledger(state, g, per * n, ctx.source);
      }
      state.work.vars['caught'] = (state.work.vars['caught'] ?? 0) + n;
      state.work.vars['meat'] = (state.work.vars['meat'] ?? 0) + meat;
      return;
    }
    case 'firewood': {
      const kg = Math.max(-state.stores.firewood, rollAmount(state, e.kg));
      state.stores.firewood += kg;
      ledger(state, 'firewood', kg, ctx.source);
      return;
    }
    case 'goods': {
      const have = state.stores.goods[e.id] ?? 0;
      const d = Math.max(-have, Math.round(rollAmount(state, e.delta)));
      state.stores.goods[e.id] = have + d;
      ledger(state, e.id, d, ctx.source);
      return;
    }
    case 'cohesion':
      addCohesion(state, def, e.delta);
      return;
    case 'injure': {
      const p = resolveWho(ctx, e.who);
      if (p) injurePerson(ctx, p, e.ailment, e.severity ?? 2);
      return;
    }
    case 'death': {
      const p = resolveWho(ctx, e.who);
      if (p) killPerson(ctx, p, e.cause);
      return;
    }
    case 'heal': {
      const p = resolveWho(ctx, e.who);
      if (p) p.ailments = [];
      return;
    }
    case 'animal': {
      const a = state.animals[e.id];
      if (!a) throw new Error(`unknown animal state: ${e.id}`);
      if (e.state !== undefined) a.state = e.state;
      if (e.at !== undefined) {
        if (e.at === null) delete a.at;
        else a.at = e.at;
      }
      if (e.known !== undefined) a.known = e.known;
      for (const [k, d] of Object.entries(e.vars ?? {})) a.vars[k] = (a.vars[k] ?? 0) + d;
      return;
    }
    case 'place': {
      const p = state.places[e.id];
      if (!p) throw new Error(`unknown place state: ${e.id}`);
      if (e.discovered !== undefined) p.discovered = e.discovered;
      if (e.addFact && !p.facts.includes(e.addFact)) {
        p.facts.push(e.addFact);
        state.work.notable = true;
      }
      if (e.stock) p.stock[e.stock.yield] = Math.max(0, (p.stock[e.stock.yield] ?? 0) + e.stock.delta);
      return;
    }
    case 'shelter':
      state.shelter = { kind: e.kind, place: e.place ?? state.shelter.place };
      state.work.notable = true;
      return;
    case 'flag':
      setFlag(state, e.id, e.set);
      return;
    case 'counter':
      state.counters[e.id] = (state.counters[e.id] ?? 0) + e.delta;
      return;
    case 'knowledge': {
      if (e.grant) return grantKnowledge(ctx, e.id);
      state.knowledge.progress[e.id] = (state.knowledge.progress[e.id] ?? 0) + (e.progress ?? 0);
      return;
    }
    case 'clue': {
      state.clues = state.clues.filter((c) => c.id !== e.id);
      if (!e.remove) {
        state.clues.push(e.months !== undefined ? { id: e.id, until: state.month + e.months } : { id: e.id });
        state.work.notable = true;
      }
      return;
    }
    case 'cache': {
      for (const c of state.caches.filter((x) => x.place === e.at)) {
        c.checkedMonth = state.month;
        if (e.action === 'recover') {
          for (const l of c.lots) addLot(state.work.haul, l.kind, l.kg);
          state.work.vars['found'] = (state.work.vars['found'] ?? 0) + c.lots.reduce((a, l) => a + l.kg, 0);
          c.lots = [];
        } else {
          state.work.vars['found'] = (state.work.vars['found'] ?? 0) + c.lots.reduce((a, l) => a + l.kg, 0);
        }
      }
      state.caches = state.caches.filter((c) => c.lots.length > 0);
      state.work.notable = true;
      return;
    }
    case 'schedule': {
      const from = state.month + e.after;
      state.scheduled.push({ uid: nextUid(state, 's'), event: e.event, from, to: from + (e.window ?? 0), ...(e.when ? { when: e.when } : {}) });
      state.work.notable = true;
      return;
    }
    case 'modifier':
      state.modifiers.push({ mod: e.mod, until: state.month + e.months - 1, source: ctx.source });
      return;
    case 'random': {
      const i = weightedIndex(state.rng, e.outcomes.map((o) => o.weight));
      const pick = e.outcomes[i];
      if (pick) applyEffects(ctx, pick.effects);
      return;
    }
    case 'if':
      applyEffects(ctx, allTrue(def, state, e.when, ctx.actors) ? e.then : (e.else ?? []));
      return;
    case 'line':
      pushLine(ctx, e.key, e.params);
      return;
    case 'narrative':
      applyNarrative(ctx, e.id);
      return;
    case 'chronicle':
      offerChronicle(state, e.key, e.importance, resolveParams(ctx, e.params));
      return;
    default: {
      const never: never = e;
      throw new Error(`unknown effect: ${JSON.stringify(never)}`);
    }
  }
}

export function applyEffects(ctx: RunCtx, effects: readonly Effect[] | undefined): void {
  for (const e of effects ?? []) applyEffect(ctx, e);
}
