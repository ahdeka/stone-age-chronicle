// 밸런스 시뮬레이터 (DESIGN.md §10.8). 헤드리스로 자동 플레이하고 지표를 모은다.
// M1: 겨울별 사망·굶주림, 결말, 방침 선택률, 사건 발생. 목표치 비교와 greedy 전략은 M2 이후.

import {
  applyCommand,
  availableOptions,
  candidatesBySlot,
  firstChoice,
  planWith,
  createGame,
  findEvent,
  optionStatuses,
  nextInt,
  population,
  seedToState,
  type ChapterDefinition,
  type GameState,
  type RngState,
  type Strategy,
} from '../../src/engine';

export type StrategyName = 'random' | 'first' | 'sure';

export function makeStrategy(name: StrategyName, rng: RngState): Strategy {
  // 두 칸 전략 (M2 ③에서 foodmax·greedy를 더하고 리포트를 준비 정도별로 나눈다)
  if (name === 'first') {
    return { pickPlan: firstChoice.pickPlan, pickOption: (_d, _s, _x, o) => o[0]! };
  }
  if (name === 'sure') {
    // 식량 칸: "거의 확실하다" 중 먹을거리를 모으는 분야 먼저 / 발전 칸: "거의 확실하다"인 첫 번째. 사건 선택지도 '거의 확실하다' 중 첫 번째
    return {
      pickPlan: (def, s) => {
        const by = candidatesBySlot(def, s);
        const sure = by.food.filter((c) => c.hint === 'sure');
        const food = sure.find((c) => ['fish', 'gather', 'trap'].includes(def.content.policies.find((p) => p.id === c.policyId)!.category));
        const pick = food ?? sure[0] ?? by.food[by.food.length - 1]!;
        return planWith(def, s, pick.uid, by.growth.find((c) => c.hint === 'sure')?.uid);
      },
      pickOption: (def, s, d, o) => {
        if (d.kind !== 'event') return o.includes('porters') ? 'porters' : o[0]!;
        const st = optionStatuses(def, s, findEvent(def, d.eventId), d.actors).filter((x) => x.available && x.hint === 'sure');
        return st[0]?.option.id ?? o[0]!;
      },
    };
  }
  return {
    // 식량 하나를 무작위로, 발전은 후보 + "하지 않는다" 중 무작위로. 큰 일은 식량 후보와 같은 자리로 친다
    pickPlan: (def, s) => {
      const by = candidatesBySlot(def, s);
      const main = [...by.food, ...by.major];
      const first = main[nextInt(rng, 0, main.length - 1)]!;
      if (by.major.includes(first)) return [first.uid];
      const g = nextInt(rng, 0, by.growth.length);
      return planWith(def, s, first.uid, by.growth[g]?.uid);
    },
    pickOption: (_d, _s, _x, o) => o[nextInt(rng, 0, o.length - 1)]!,
  };
}

/** 겨울 구간 (시작 달 기준): 첫 겨울 1~5달, 둘째 겨울 13~17달 ... */
export const WINTERS = [
  { name: 'winter1', from: 1, to: 5 },
  { name: 'winter2', from: 13, to: 17 },
  { name: 'winter3', from: 25, to: 29 },
];

export interface GameRecord {
  seed: string;
  ending: string;
  months: number;
  winters: Record<string, { reached: boolean; deaths: number; hungryPhases: number; minFoodDays: number }>;
  picks: Record<string, number>;
  presented: Record<string, number>;
  events: Record<string, number>;
  quietMonths: number;
}

function foodDaysOf(s: GameState, def: ChapterDefinition): number {
  const daily = Object.values(s.people)
    .filter((p) => p.alive)
    .reduce((a, p) => {
      const age = Math.floor((s.month - p.birthMonth) / 12);
      const band = def.ageBands.filter((b) => age >= b.fromAge).sort((x, y) => y.fromAge - x.fromAge)[0]!;
      return a + band.foodPerMonth / 30;
    }, 0);
  const kg = s.stores.food.reduce((a, l) => a + l.kg, 0);
  return daily > 0 ? kg / daily : 0;
}

export function playGame(def: ChapterDefinition, seed: string, strategy: StrategyName, maxMonths: number, presetId?: string): GameRecord {
  const s = createGame(def, { seed, ...(presetId ? { presetId } : {}) });
  const strat = makeStrategy(strategy, seedToState(`strategy:${seed}`));
  const rec: GameRecord = {
    seed,
    ending: 'none',
    months: 0,
    winters: Object.fromEntries(WINTERS.map((w) => [w.name, { reached: false, deaths: 0, hungryPhases: 0, minFoodDays: Infinity }])),
    picks: {},
    presented: {},
    events: {},
    quietMonths: 0,
  };
  for (let m = 0; m < maxMonths && s.step !== 'ended'; m++) {
    if (s.step === 'settlement') applyCommand(def, s, { type: 'nextMonth' });
    for (const c of s.work.candidates) rec.presented[c.policyId] = (rec.presented[c.policyId] ?? 0) + 1;
    const winter = WINTERS.find((w) => s.month >= w.from && s.month <= w.to);
    if (winter) rec.winters[winter.name]!.minFoodDays = Math.min(rec.winters[winter.name]!.minFoodDays, foodDaysOf(s, def));
    for (let guard = 0; guard < 50 && (s.step === 'policy' || s.step === 'decision'); guard++) {
      if (s.step === 'decision') {
        const d = s.work.decision!;
        const err = applyCommand(def, s, { type: 'chooseOption', uid: d.uid, optionId: strat.pickOption(def, s, d, availableOptions(def, s, d)) });
        if (err) throw new Error(err);
      } else {
        const uids = strat.pickPlan(def, s);
        for (const uid of uids) {
          const id = s.work.candidates.find((c) => c.uid === uid)!.policyId;
          rec.picks[id] = (rec.picks[id] ?? 0) + 1;
        }
        const err = applyCommand(def, s, { type: 'choosePlan', uids });
        if (err) throw new Error(err);
      }
    }
    const h = s.history[s.history.length - 1]!;
    if (h.quiet) rec.quietMonths++;
    for (const e of s.work.events) rec.events[e] = (rec.events[e] ?? 0) + 1;
    if (winter) {
      const w = rec.winters[winter.name]!;
      w.reached = true;
      w.deaths += s.work.deaths.length;
      w.hungryPhases += h.reports.filter((r) => r.lines.some((l) => l.key === 'line.hunger.1' || l.key === 'line.hunger.2')).length;
      w.hungryPhases += s.hungerStage > 0 ? 1 : 0;
    }
    rec.months = s.month;
  }
  rec.ending = s.ending?.id ?? (population(s) === 0 ? 'extinct?' : 'running');
  return rec;
}

const pct = (xs: number[], p: number) => {
  if (xs.length === 0) return NaN;
  const sorted = xs.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
};

export function summarize(def: ChapterDefinition, recs: GameRecord[]) {
  const n = recs.length;
  const endings: Record<string, number> = {};
  for (const r of recs) endings[r.ending] = (endings[r.ending] ?? 0) + 1;
  const winters = Object.fromEntries(
    WINTERS.map((w) => {
      const reached = recs.filter((r) => r.winters[w.name]!.reached);
      const deaths = reached.map((r) => r.winters[w.name]!.deaths);
      return [
        w.name,
        {
          reached: reached.length / n,
          deaths: { p10: pct(deaths, 0.1), p50: pct(deaths, 0.5), p90: pct(deaths, 0.9) },
          anyDeath: reached.filter((r) => r.winters[w.name]!.deaths > 0).length / Math.max(1, reached.length),
          hungry: reached.filter((r) => r.winters[w.name]!.hungryPhases > 0).length / Math.max(1, reached.length),
          minFoodDaysP50: pct(reached.map((r) => r.winters[w.name]!.minFoodDays), 0.5),
        },
      ];
    }),
  );
  const firstWinterExtinct = recs.filter((r) => r.ending === 'ruin_extinct' && r.months <= 5).length / n;
  const presented: Record<string, number> = {};
  const picks: Record<string, number> = {};
  const events: Record<string, number> = {};
  for (const r of recs) {
    for (const [k, v] of Object.entries(r.presented)) presented[k] = (presented[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.picks)) picks[k] = (picks[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.events)) events[k] = (events[k] ?? 0) + v;
  }
  const pickRate = Object.fromEntries(Object.keys(presented).map((k) => [k, (picks[k] ?? 0) / presented[k]!]));
  const neverFired = def.content.events.map((e) => e.id).filter((id) => !events[id]);
  const totalMonths = recs.reduce((a, r) => a + r.months, 0);
  return {
    games: n,
    endings,
    months: { p10: pct(recs.map((r) => r.months), 0.1), p50: pct(recs.map((r) => r.months), 0.5), p90: pct(recs.map((r) => r.months), 0.9) },
    firstWinterExtinct,
    winters,
    pickRate,
    eventsPerGame: Object.fromEntries(Object.entries(events).map(([k, v]) => [k, v / n])),
    neverFired,
    quietMonthRate: recs.reduce((a, r) => a + r.quietMonths, 0) / Math.max(1, totalMonths),
  };
}
