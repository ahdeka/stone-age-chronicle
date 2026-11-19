// 스탯 = 기본값(balance) → add 합 → mul 곱 (DESIGN.md §2.8)
// 출처: 장 전역, 계절, 생활 방식, 현재 지역, 부족 특성, 인물 특성, 임시 모디파이어.
// 지식과 전통 출처는 M4에서 추가한다.

import type { ChapterDefinition, GameState, ModifierDef, StatKey } from '../types';
import { allTrue } from '../conditions/evaluate';
import { findRegion } from '../core/lookup';

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

/** 지역 식량 배율은 계절별 숫자라 모디파이어로 바꿔 끼운다 */
const REGION_FOOD_STATS: readonly StatKey[] = ['yield.gather', 'yield.hunt'];

function collectModifiers(def: ChapterDefinition, state: GameState): SourcedMod[] {
  const out: SourcedMod[] = [];
  const push = (source: string, mods: readonly ModifierDef[]) => {
    for (const mod of mods) out.push({ source, mod });
  };

  push('global', def.balance.globalModifiers);

  const season = def.seasons.find((s) => s.id === state.season);
  if (season) push(`season.${season.id}`, season.modifiers);

  const lifestyle = def.lifestyles.find((l) => l.id === state.tribe.lifestyle);
  if (lifestyle) push(`lifestyle.${lifestyle.id}`, lifestyle.modifiers);

  const region = findRegion(def, state.regions.current);
  if (region) {
    const mul = region.foodMul[state.season] ?? 1;
    for (const stat of REGION_FOOD_STATS) out.push({ source: `region.${region.id}`, mod: { stat, op: 'mul', value: mul } });
  }

  for (const id of state.tribe.traits) {
    const tr = def.content.tribeTraits.find((x) => x.id === id);
    if (tr) push(`tribeTrait.${id}`, tr.modifiers);
  }

  for (const p of Object.values(state.people)) {
    if (!p.alive) continue;
    for (const id of p.traits) {
      const tr = def.content.personTraits.find((x) => x.id === id);
      if (tr) push(`personTrait.${id}`, tr.modifiers);
    }
  }

  for (const m of state.modifiers) out.push({ source: m.sourceKey, mod: m.mod });

  return out;
}

export function getStat(def: ChapterDefinition, state: GameState, key: StatKey): StatValue {
  const base = def.balance.stats[key];
  if (base === undefined) throw new Error(`unknown stat: ${key}`);
  const parts: StatPart[] = [{ source: 'base', op: 'base', value: base }];
  let add = 0;
  let mul = 1;
  for (const { source, mod } of collectModifiers(def, state)) {
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
