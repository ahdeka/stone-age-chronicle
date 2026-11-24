// 사건 고르기와 선택 처리 (DESIGN.md §4.2, §8)

import type { ChapterDefinition, EventDef, EventOption, EventSlot, GameState, Hint, Id, Person } from '../types';
import { hintFor } from '../outcome/tier';
import { allTrue, matchPerson } from '../conditions/evaluate';
import { findEvent } from '../core/lookup';
import { living } from '../people/people';
import { currentEntry } from '../policy/current';
import { nextInt, weightedIndex } from '../rng/rng';

export function eventOnCooldown(state: GameState, ev: EventDef): boolean {
  if (ev.once && state.usedOnce.includes(ev.id)) return true;
  return (state.cooldowns[ev.id] ?? 0) > state.month;
}

/** 인물 슬롯을 묶는다. 묶을 수 없는 슬롯이 있으면 undefined */
export function bindActors(def: ChapterDefinition, state: GameState, ev: EventDef, base: Record<string, Id>): Record<string, Id> | undefined {
  const actors: Record<string, Id> = { ...base };
  const used = new Set(Object.values(actors));
  for (const [slot, q] of Object.entries(ev.actors ?? {})) {
    const pool = living(state).filter((p) => !used.has(p.id) && matchPerson(def, state, p, q));
    if (pool.length === 0) return undefined;
    const p = pool[nextInt(state.rng, 0, pool.length - 1)]!;
    actors[slot] = p.id;
    used.add(p.id);
  }
  return actors;
}

/** 조건을 만족하는 사건 하나를 가중치로 고른다 */
export function pickEvent(
  def: ChapterDefinition,
  state: GameState,
  slot: EventSlot,
  ids: readonly Id[],
  base: Record<string, Id>,
): { event: EventDef; actors: Record<string, Id> } | undefined {
  const eligible = ids
    .map((id) => findEvent(def, id))
    .filter((ev) => ev.slots.includes(slot) && !eventOnCooldown(state, ev) && allTrue(def, state, ev.when, base));
  const weights = eligible.map((e) => e.weight);
  while (eligible.length > 0) {
    const i = weightedIndex(state.rng, weights);
    if (i < 0) return undefined;
    const ev = eligible[i]!;
    const actors = bindActors(def, state, ev, base);
    if (actors) return { event: ev, actors };
    eligible.splice(i, 1);
    weights.splice(i, 1);
  }
  return undefined;
}

export function villageEventIds(def: ChapterDefinition): Id[] {
  return def.content.events.filter((e) => e.scope === 'village').map((e) => e.id);
}

export interface OptionStatus {
  option: EventOption;
  available: boolean;
  /** 판정이 있으면 계산한 단서, 없으면 작가가 정한 단서 (기본: 거의 확실하다) */
  hint: Hint;
}

export function optionStatuses(def: ChapterDefinition, state: GameState, ev: EventDef, actors: Record<string, Id>): OptionStatus[] {
  const chosen = currentEntry(state)?.bound;
  const crew = (chosen?.crew ?? []).map((id) => state.people[id]).filter((p): p is Person => !!p && p.alive);
  const leaderId = actors['leader'] ?? chosen?.leaderId;
  const leader = leaderId ? state.people[leaderId] : undefined;
  const all = { ...(chosen?.leaderId ? { leader: chosen.leaderId } : {}), ...actors };
  return ev.options.map((option) => ({
    option,
    available: allTrue(def, state, option.requires, all),
    hint: option.activity ? hintFor(def, state, option.activity, { crew, ...(leader ? { leader } : {}), actors: all }) : (option.hint ?? 'sure'),
  }));
}

export function markUsed(state: GameState, ev: EventDef): void {
  if (ev.cooldown > 0) state.cooldowns[ev.id] = state.month + ev.cooldown;
  if (ev.once && !state.usedOnce.includes(ev.id)) state.usedOnce.push(ev.id);
}
