// 인구 증감과 역할 배분 보정. 배분 합계는 항상 인구와 같다 (DESIGN.md §15 가정 2).

import type { ChapterDefinition, GameState } from '../types';

export function changePopulation(def: ChapterDefinition, state: GameState, delta: number): number {
  const t = state.tribe;
  const before = t.population;
  const after = Math.max(0, Math.round(before + delta));
  if (after > before) {
    const role = def.balance.newcomerRole;
    t.roles[role] = (t.roles[role] ?? 0) + (after - before);
  } else if (after < before) {
    let toRemove = before - after;
    const order = [...def.balance.roleLossOrder, ...def.roles.map((r) => r.id)];
    for (const role of order) {
      if (toRemove <= 0) break;
      const have = t.roles[role] ?? 0;
      const take = Math.min(have, toRemove);
      t.roles[role] = have - take;
      toRemove -= take;
    }
  }
  t.population = after;
  return after - before;
}

export function rolesTotal(roles: Record<string, number>): number {
  return Object.values(roles).reduce((a, b) => a + b, 0);
}
