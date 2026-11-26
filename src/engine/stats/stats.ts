// 스탯 = 기본값(balance) → add 합 → mul 곱 (DESIGN.md §4.4)
// 출처: 장 전역, 달, 지금 순의 날씨, 거처, 지식, 시설, 단서, 이번 달 전략(두 칸 모두), 임시 모디파이어.
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
  for (const [id, level] of Object.entries(state.facilities)) if (level > 0) push(`facility.${id}`, byId(def.facilities, id, 'facility').mods);
  for (const c of state.clues) push(`clue.${c.id}`, byId(def.clues, c.id, 'clue').mods);
  for (const e of state.work.plan) push(`policy.${e.bound.policyId}`, findPolicy(def, e.bound.policyId).monthMods);
  // 켜진 발전 칸의 덧붙는 보정 (§B1: 새 행동에 덧붙을 때만)
  for (const cell of def.tech.cells) if (state.tech[cell.id]?.status === 'done') push(`tech.${cell.id}`, cell.mods);
  // 계절 턴의 "발전하지 않는다": 발전 인원이 식량에 붙는다 (식량 전략만 고른 턴, §B4.1)
  const plan = state.work.plan;
  if (state.work.turn.kind === 'season' && plan.length > 0 && plan.every((e) => e.slot === 'food')) push('tech.none', def.balance.tech.noGrowthMods);
  for (const t of state.modifiers) out.push({ source: t.source, mod: t.mod });
  return out;
}

/** 빼고 계산할 출처 (발전 덕분에 얼마나 늘었는지 잴 때) */
export type SourceFilter = (source: string) => boolean;

export function getStat(def: ChapterDefinition, state: GameState, key: StatKey, exclude?: SourceFilter): StatValue {
  const base = def.balance.stats[key];
  if (base === undefined) throw new Error(`unknown stat: ${key}`);
  const parts: StatPart[] = [{ source: 'base', op: 'base', value: base }];
  let add = 0;
  let mul = 1;
  for (const { source, mod } of collect(def, state)) {
    if (mod.stat !== key) continue;
    if (exclude?.(source)) continue;
    if (mod.when && !allTrue(def, state, mod.when)) continue;
    if (mod.op === 'add') add += mod.value;
    else mul *= mod.value;
    parts.push({ source, op: mod.op, value: mod.value });
  }
  return { value: (base + add) * mul, parts };
}

export function stat(def: ChapterDefinition, state: GameState, key: StatKey, exclude?: SourceFilter): number {
  return getStat(def, state, key, exclude).value;
}

/** 하루 장작 소모 kg: 달 기준 × 거처 × 스탯(날씨, 옷 등) */
export function firewoodPerDay(def: ChapterDefinition, state: GameState, exclude?: SourceFilter): number {
  const shelter = exclude?.(`shelter.${state.shelter.kind}`) ? 1 : findShelter(def, state.shelter.kind).firewoodMul;
  return monthDef(def, state).firewoodPerDay * shelter * stat(def, state, 'firewood.burnMul', exclude);
}
