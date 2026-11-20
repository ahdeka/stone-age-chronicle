// 스탯 = 기본값(balance) → add 합 → mul 곱 (DESIGN.md §4.4)
// 출처: 장 전역, 달, 지금 순의 날씨, 거처, 지식, 단서, 이번 달 방침, 임시 모디파이어.
// 출처가 기록되므로 UI에서 "왜 이 값인가"를 보여 줄 수 있다.

import type { ChapterDefinition, GameState, ModifierDef, StatKey } from '../types';
import { allTrue } from '../conditions/evaluate';
import { byId, currentWeather, findPolicy, findShelter, findWeather, monthDef } from '../core/lookup';

export interface StatPart {
  source: string;
  op: 'base' | 'add' | 'mul';
  value: number;
}

export interface StatValue {
  value: number;
  parts: StatPart[];
}

interface SourcedMod {
  source: string;
  mod: ModifierDef;
}

function collect(def: ChapterDefinition, state: GameState): SourcedMod[] {
  const out: SourcedMod[] = [];
  const push = (source: string, mods: readonly ModifierDef[] | undefined) => {
    for (const mod of mods ?? []) out.push({ source, mod });
  };
  push('global', def.globalMods);
  const m = monthDef(def, state);
  push(`month.${m.id}`, m.mods);
  const w = currentWeather(state);
  if (w) push(`weather.${w}`, findWeather(def, w).mods);
  push(`shelter.${state.shelter.kind}`, findShelter(def, state.shelter.kind).mods);
  for (const k of state.knowledge.has) push(`knowledge.${k}`, byId(def.knowledge, k, 'knowledge').mods);
  for (const c of state.clues) push(`clue.${c.id}`, byId(def.clues, c.id, 'clue').mods);
  const chosen = state.work.chosen;
  if (chosen) push(`policy.${chosen.policyId}`, findPolicy(def, chosen.policyId).monthMods);
  for (const t of state.modifiers) out.push({ source: t.source, mod: t.mod });
  return out;
}

export function getStat(def: ChapterDefinition, state: GameState, key: StatKey): StatValue {
  const base = def.balance.stats[key];
  if (base === undefined) throw new Error(`unknown stat: ${key}`);
  const parts: StatPart[] = [{ source: 'base', op: 'base', value: base }];
  let add = 0;
  let mul = 1;
  for (const { source, mod } of collect(def, state)) {
    if (mod.stat !== key) continue;
    if (mod.when && !allTrue(def, state, mod.when)) continue;
    if (mod.op === 'add') add += mod.value;
    else mul *= mod.value;
    parts.push({ source, op: mod.op, value: mod.value });
  }
  return { value: (base + add) * mul, parts };
}

export function stat(def: ChapterDefinition, state: GameState, key: StatKey): number {
  return getStat(def, state, key).value;
}

/** 하루 장작 소모 kg: 달 기준 × 거처 × 스탯(날씨, 옷 등) */
export function firewoodPerDay(def: ChapterDefinition, state: GameState): number {
  return monthDef(def, state).firewoodPerDay * findShelter(def, state.shelter.kind).firewoodMul * stat(def, state, 'firewood.burnMul');
}
