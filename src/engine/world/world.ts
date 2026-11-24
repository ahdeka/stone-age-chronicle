// 월초의 세계 갱신: 날씨, 동물, 장소 회복, 기억 장부 (DESIGN.md §4.1, §8)

import type { ChapterDefinition, GameState, Id } from '../types';
import { monthDef } from '../core/lookup';
import { chance, weightedIndex } from '../rng/rng';
import { takeFraction } from '../stores/food';
import { rollAmount } from '../effects/apply';
import { stat } from '../stats/stats';

export function rollWeather(def: ChapterDefinition, state: GameState): [Id, Id, Id] {
  const table = Object.entries(monthDef(def, state).weather);
  const pick = (): Id => table[weightedIndex(state.rng, table.map(([, w]) => w))]?.[0] ?? table[0]![0];
  return [pick(), pick(), pick()];
}

export function updateAnimals(def: ChapterDefinition, state: GameState): void {
  const mId = monthDef(def, state).id;
  for (const a of def.animals) {
    const st = state.animals[a.id];
    if (!st) continue;
    for (const s of a.schedule) {
      if (s.month !== mId || !chance(state.rng, s.chance)) continue;
      st.state = s.to;
      if (s.at === null) delete st.at;
      else if (s.at !== undefined) st.at = s.at;
      break;
    }
  }
}

export function recoverPlaces(def: ChapterDefinition, state: GameState): void {
  for (const p of def.places) {
    const st = state.places[p.id];
    if (!st) continue;
    for (const [y, max] of Object.entries(p.stockMax)) {
      if (max === undefined) continue;
      st.stock[y] = Math.min(max, (st.stock[y] ?? max) + max * p.recoverPerMonth);
    }
  }
}

/** 은닉물: 냄새가 쌓이고, 근처의 짐승이 노린다. 플레이어는 확인하기 전까지 모른다 */
export function updateCaches(def: ChapterDefinition, state: GameState): void {
  const b = def.balance.cache;
  for (const c of state.caches) {
    c.scent += b.scentPerMonth;
    const raider = state.animals[b.raidAnimal];
    const near = raider?.at === c.place;
    if (chance(state.rng, c.scent * b.raidChancePerScent * (near ? 2 : 1) * stat(def, state, 'cache.raid'))) {
      takeFraction(c.lots, rollAmount(state, b.raidLoss));
    }
  }
  state.caches = state.caches.filter((c) => c.lots.length > 0 || state.month - c.checkedMonth < b.staleAfterMonths);
}

export function expireTemporary(state: GameState): void {
  state.clues = state.clues.filter((c) => c.until === undefined || c.until >= state.month);
  state.modifiers = state.modifiers.filter((m) => m.until >= state.month);
}
