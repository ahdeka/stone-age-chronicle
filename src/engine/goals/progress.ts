// 시대 목표의 진행도 (DESIGN.md §13.1)
// 길 데이터는 측정기 id와 목표값만 가진다. 측정기를 늘리거나 바꾸는 것은 여기서만 한다 (M5에서 교체).
// 측정기가 없는 길은 "아직 잴 수 없다"(null) — 화면은 0%가 아니라 흐리게 보여 준다.

import type { ChapterDefinition, GameState } from '../types';
import { dailyFoodTotal } from '../people/people';

type Params = Record<string, string | number> | undefined;
export type Measure = (def: ChapterDefinition, state: GameState, params: Params) => number;

export const MEASURES: Record<string, Measure> = {
  /** 오래 가는 식량(params.kinds, 쉼표 구분)이 며칠분인가 */
  durableFoodDays: (def, state, params) => {
    const kinds = String(params?.['kinds'] ?? '').split(',');
    const kg = state.stores.food.filter((l) => kinds.includes(l.kind)).reduce((a, l) => a + l.kg, 0);
    const per = dailyFoodTotal(def, state);
    return per > 0 ? kg / per : 0;
  },
  /** 거처(params.shelter)에서 지낸 달 수 */
  shelterMonths: (_def, state, params) => state.counters[`shelter_months.${String(params?.['shelter'])}`] ?? 0,
  /** 이번 겨울 굶주림 없이 지낸 달 수. 한 겨울을 다 넘기면 그 뒤로 계속 다 찬 값 */
  winterFedMonths: (_def, state) => (state.flags['winter_fed_full'] !== undefined ? 3 : (state.counters['winter_fed_streak'] ?? 0)),
};

export interface PathProgress {
  id: string;
  /** 0~1, 잴 수 없으면 null */
  pct: number | null;
}

export interface GoalProgress {
  id: string;
  /** 길 중 가장 많이 간 것. 잴 수 있는 길이 없으면 null */
  pct: number | null;
  paths: PathProgress[];
}

export function goalProgress(def: ChapterDefinition, state: GameState): GoalProgress[] {
  return def.goals.map((g) => {
    const paths = g.paths.map((p) => {
      if (!p.measure) return { id: p.id, pct: null };
      const m = MEASURES[p.measure.id];
      if (!m) throw new Error(`unknown goal measure: ${p.measure.id}`);
      return { id: p.id, pct: Math.max(0, Math.min(1, m(def, state, p.measure.params) / p.measure.target)) };
    });
    const known = paths.filter((p): p is { id: string; pct: number } => p.pct !== null);
    return { id: g.id, pct: known.length > 0 ? Math.max(...known.map((p) => p.pct)) : null, paths };
  });
}
