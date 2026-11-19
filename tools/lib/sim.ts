// 헤드리스 밸런스 시뮬레이터 (DESIGN.md §12). M1: 역할 배분 전략만. 이벤트·카드 전략은 M2에서 추가한다.
// 시뮬레이터 자신의 결정에도 seeded RNG를 쓴다 → 같은 인자면 같은 리포트.

import {
  createGame,
  nextFloat,
  reduce,
  seedToState,
  type ChapterDefinition,
  type GameState,
  type RngState,
} from '../../src/engine';

export type Strategy = 'random' | 'fixed';

export interface SimOptions {
  games: number;
  strategy: Strategy;
  seed: string;
  checkpoints: number[];
}

export interface Quantiles {
  p10: number;
  p50: number;
  p90: number;
}

export interface SimReport {
  options: SimOptions;
  games: number;
  avgFinalTurn: number;
  endings: Record<string, number>;
  /** 굶주린 턴 비율 (전체 턴 중) */
  hungryTurnRate: number;
  /** 한 번이라도 굶주림으로 인구를 잃은 판 비율 */
  popLossGameRate: number;
  checkpoints: Record<number, Record<string, Quantiles>>;
}

function quantiles(xs: number[]): Quantiles {
  if (xs.length === 0) return { p10: 0, p50: 0, p90: 0 };
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
  const r = (v: number) => Math.round(v * 10) / 10;
  return { p10: r(q(0.1)), p50: r(q(0.5)), p90: r(q(0.9)) };
}

/** 전략: 인구를 역할에 나눈다 */
function allocate(def: ChapterDefinition, s: GameState, strategy: Strategy, rng: RngState): Record<string, number> {
  const pop = s.tribe.population;
  const roles = def.roles.map((r) => r.id);
  const out: Record<string, number> = Object.fromEntries(roles.map((r) => [r, 0]));
  if (strategy === 'fixed') {
    // 시작 프리셋 비율을 유지
    const preset = def.startPresets[0]!;
    const total = preset.population;
    let given = 0;
    for (const r of roles) {
      const n = Math.floor(((preset.roles[r] ?? 0) / total) * pop);
      out[r] = n;
      given += n;
    }
    out[def.balance.newcomerRole] = (out[def.balance.newcomerRole] ?? 0) + (pop - given);
    return out;
  }
  // random: 역할마다 무작위 가중치
  const weights = roles.map(() => nextFloat(rng));
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  let given = 0;
  roles.forEach((r, i) => {
    const n = Math.floor((weights[i]! / wsum) * pop);
    out[r] = n;
    given += n;
  });
  for (let i = 0; i < pop - given; i++) {
    const r = roles[Math.floor(nextFloat(rng) * roles.length)]!;
    out[r] = (out[r] ?? 0) + 1;
  }
  return out;
}

export function runSim(def: ChapterDefinition, opts: SimOptions): SimReport {
  const endings: Record<string, number> = {};
  const samples: Record<number, Record<string, number[]>> = {};
  let finalTurns = 0;
  let hungryTurns = 0;
  let totalTurns = 0;
  let popLossGames = 0;

  const record = (s: GameState) => {
    if (!opts.checkpoints.includes(s.turn)) return;
    const bucket = (samples[s.turn] ??= {});
    const put = (k: string, v: number) => (bucket[k] ??= []).push(v);
    put('population', s.tribe.population);
    for (const [k, v] of Object.entries(s.tribe.resources)) put(k, v);
  };

  for (let g = 0; g < opts.games; g++) {
    const rng = seedToState(`${opts.seed}:strategy:${g}`);
    let s = createGame(def, { kind: 'preset', presetId: def.startPresets[0]!.id, tribeTraits: [], seed: `${opts.seed}:${g}` });
    let lostPop = false;
    record(s);
    while (s.phase !== 'ended') {
      const alloc = reduce(def, s, { type: 'setRoles', roles: allocate(def, s, opts.strategy, rng) });
      if (alloc.error) throw new Error(`sim allocation rejected: ${alloc.error}`);
      const r = reduce(def, alloc.state, { type: 'endActionPhase' });
      if (r.error) throw new Error(`sim endActionPhase rejected: ${r.error}`);
      s = r.state;
      totalTurns++;
      const last = s.history[s.history.length - 1]!;
      if (last.log.some((l) => l.kind === 'population' && l.source === 'starvation')) lostPop = true;
      if (s.tribe.hunger > 0) hungryTurns++;
      if (s.phase !== 'ended') record(s);
    }
    if (lostPop) popLossGames++;
    finalTurns += s.turn;
    const id = s.ending?.id ?? 'none';
    endings[id] = (endings[id] ?? 0) + 1;
  }

  const checkpoints: SimReport['checkpoints'] = {};
  for (const [turn, bucket] of Object.entries(samples)) {
    checkpoints[Number(turn)] = Object.fromEntries(Object.entries(bucket).map(([k, v]) => [k, quantiles(v)]));
  }

  return {
    options: opts,
    games: opts.games,
    avgFinalTurn: Math.round((finalTurns / Math.max(1, opts.games)) * 10) / 10,
    endings,
    hungryTurnRate: Math.round((hungryTurns / Math.max(1, totalTurns)) * 1000) / 1000,
    popLossGameRate: Math.round((popLossGames / Math.max(1, opts.games)) * 1000) / 1000,
    checkpoints,
  };
}
