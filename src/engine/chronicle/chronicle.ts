// 연대기 (DESIGN.md §10): 매 턴 중요한 일 한 문장. 기록자 시점.

import type { ChapterDefinition, ChronicleParam, GameState, LogEntry } from '../types';
import { allTrue, findChief, type Actors } from '../conditions/evaluate';

/** 이 족장 시절에 같은 계절이 몇 번째로 돌아왔나 (1부터) */
export function seasonIndex(def: ChapterDefinition, state: GameState): number {
  return Math.floor((state.turn - state.reignStartTurn) / def.seasons.length) + 1;
}

/** 템플릿 변수: 그 시점의 이름을 굳혀 둔다 (나중에 족장이 바뀌어도 문장은 그대로) */
export function chronicleParams(def: ChapterDefinition, state: GameState, actors?: Actors): Record<string, ChronicleParam> {
  const params: Record<string, ChronicleParam> = {
    tribe: state.tribe.name,
    region: { key: `region.${state.regions.current}.name` },
    reign: state.reign,
  };
  const chief = findChief(def, state);
  if (chief) params['chief'] = chief.name;
  for (const [slot, id] of Object.entries(actors ?? {})) {
    const p = state.people[id];
    if (p) params[`actor:${slot}`] = p.name;
  }
  return params;
}

/** D12. 이번 턴의 문장 하나를 확정한다. importance가 가장 높은 것, 같으면 먼저 나온 것. */
export function finalizeChronicle(def: ChapterDefinition, state: GameState): void {
  let best: Extract<LogEntry, { kind: 'chronicle' }> | undefined;
  for (const l of state.turnLog) {
    if (l.kind !== 'chronicle') continue;
    if (!best || l.importance > best.importance) best = l;
  }
  let key: string | undefined = best?.key;
  let params = best?.params;
  if (!key) {
    const group = def.chronicleFallbacks.find((g) => allTrue(def, state, g.when));
    if (group && group.keys.length > 0) {
      key = group.keys[(state.turn - 1) % group.keys.length];
      params = chronicleParams(def, state);
    }
  }
  if (!key || !params) return;
  state.chronicle.push({
    turn: state.turn,
    reign: state.reign,
    season: state.season,
    seasonIndex: seasonIndex(def, state),
    key,
    params,
  });
}
