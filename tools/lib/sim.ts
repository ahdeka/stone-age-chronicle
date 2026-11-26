// 밸런스 시뮬레이터 (DESIGN.md §10.8). 헤드리스로 자동 플레이하고 지표를 모은다.
// ③a(2026-11-25): 겨울 구간은 달력 기준(11~2월, §10.7), sure는 "거의 확실하다" 중 기대 식량이 가장 큰 전략,
// 결속 경로별 집계(work.cohesionBy), 겨울 전(봄~가을) 사망과 월초 식량 며칠치.
// R1-c(2026-11-26): 턴 단위로 돈다(1년차 달 12턴 + 2년차부터 철). 해별 지표: 사망, 배급 감축·굶주림 순 비율,
// 해 끝 켜진 칸 수와 결속, 신석기. 목표치는 R5에서 정한다(DESIGN.md §B7).

import {
  applyCommand,
  availableOptions,
  calendarDate,
  candidatesBySlot,
  firstChoice,
  planWith,
  createGame,
  findEvent,
  foodDays,
  monthDef,
  optionStatuses,
  nextInt,
  playMonth,
  population,
  seedToState,
  type BoundPolicy,
  type ChapterDefinition,
  type GameState,
  type Id,
  type RngState,
  type Strategy,
} from '../../src/engine';

export type StrategyName = 'random' | 'first' | 'sure';

/** 첫 겨울 구간의 달 (달력 숫자): 1년차 11월(낙엽달) ~ 2월(얼음달). DESIGN.md §10.7 */
export const WINTER_MONTHS = [11, 12, 1, 2];
/** 겨울 몇 번째까지 따로 잰다 */
const WINTER_COUNT = 3;
/** sure 전략이 식량 전략의 기대 식량을 재는 표본 수 (상태를 복사해 다른 난수로 한 달을 돌려 본다) */
const PROBE_SAMPLES = 2;

/** 사건 선택지: '거의 확실하다' 중 첫 번째. 남은 고기는 짐꾼 */
const surePickOption: Strategy['pickOption'] = (def, s, d, o) => {
  if (d.kind !== 'event') return o.includes('porters') ? 'porters' : o[0]!;
  const st = optionStatuses(def, s, findEvent(def, d.eventId), d.actors).filter((x) => x.available && x.hint === 'sure');
  return st[0]?.option.id ?? o[0]!;
};

/** 이 전략으로 한 달을 돌렸을 때 들어온 식량 (먹은 것 빼기 전, 상한 것은 뺀다). 상태를 복사해 다른 난수로 돌린다 */
function probeIncome(def: ChapterDefinition, s: GameState, uids: Id[], tag: string): number {
  let sum = 0;
  for (let k = 0; k < PROBE_SAMPLES; k++) {
    const c = JSON.parse(JSON.stringify(s)) as GameState;
    c.rng = seedToState(`probe:${tag}:${s.month}:${k}`);
    if (applyCommand(def, c, { type: 'choosePlan', uids })) return -Infinity;
    playMonth(def, c, { pickPlan: () => uids, pickOption: surePickOption });
    const ledger = c.history[c.history.length - 1]?.ledger ?? [];
    sum += ledger.filter((l) => l.res === 'food' && l.source !== 'upkeep.food').reduce((a, l) => a + l.delta, 0);
  }
  return sum / PROBE_SAMPLES;
}

export function makeStrategy(name: StrategyName, rng: RngState, seed = ''): Strategy {
  if (name === 'first') {
    return { pickPlan: firstChoice.pickPlan, pickOption: (_d, _s, _x, o) => o[0]! };
  }
  if (name === 'sure') {
    // 식량 칸: "거의 확실하다"인 식량·큰 일 중 기대 식량이 가장 큰 것 (없으면 마지막 식량 후보)
    // 발전 칸: "거의 확실하다" 중 점수가 가장 높은 것. 사건 선택지는 '거의 확실하다' 중 첫 번째
    return {
      pickPlan: (def, s) => {
        const by = candidatesBySlot(def, s);
        // 발전: "거의 확실하다" 중 점수(가산 포함)가 가장 높은 것 — 칸을 고정으로 먼저 고르지 않는다
        const growth = by.growth.filter((c) => c.hint === 'sure').sort((a, b) => b.score - a.score)[0]?.uid;
        const plans = [...by.food, ...by.major]
          .filter((c) => c.hint === 'sure')
          .map((c: BoundPolicy) => (by.major.includes(c) ? [c.uid] : planWith(def, s, c.uid, growth)));
        if (plans.length === 0) return planWith(def, s, by.food[by.food.length - 1]!.uid, growth);
        if (plans.length === 1) return plans[0]!;
        let best = plans[0]!;
        let bestKg = -Infinity;
        for (const p of plans) {
          const kg = probeIncome(def, s, p, seed);
          if (kg > bestKg) {
            best = p;
            bestKg = kg;
          }
        }
        return best;
      },
      pickOption: surePickOption,
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

export interface WinterRecord {
  reached: boolean;
  deaths: number;
  /** 겨울 중 가장 심한 배급 단계 (0 정상, 1 감축, 2 굶주림) */
  maxHunger: number;
  minFoodDays: number;
}

/** 해(년차)마다의 기록. 1년차는 달 턴, 2년차부터 철 턴 */
export interface YearRecord {
  turns: number;
  deaths: number;
  /** 배급 단계별 순 수 [다 먹음, 감축, 굶주림] */
  rationPhases: [number, number, number];
  /** 해가 끝날 때(또는 마지막 턴) 켜진 칸 수와 결속 */
  cellsDone: number;
  cohesionEnd: number;
}

export interface GameRecord {
  seed: string;
  ending: string;
  /** 마지막 턴이 끝난 달 (state.month) */
  months: number;
  /** 진행한 턴 수 */
  turns: number;
  years: Record<number, YearRecord>;
  /** 신석기 깃발이 선 턴 (없으면 undefined) */
  neolithicTurn?: number;
  /** 첫 겨울 전(봄 시작이면 3~10월) 사망 */
  preWinterDeaths: number;
  winters: Record<string, WinterRecord>;
  /** 첫 해 달력 숫자별 월초 식량 며칠치 */
  startFoodDays: Record<number, number>;
  /** 첫 해 달력 숫자별 결속 변화 (출처별) */
  cohesion: Record<number, Record<string, number>>;
  picks: Record<string, number>;
  presented: Record<string, number>;
  events: Record<string, number>;
  quietMonths: number;
}

/** 턴 maxTurns개를 진행한다 (1년차 한 달 = 1턴, 2년차부터 한 철 = 1턴). 결말이 나면 멈춘다 */
export function playGame(def: ChapterDefinition, seed: string, strategy: StrategyName, maxTurns: number, presetId?: string): GameRecord {
  const s = createGame(def, { seed, ...(presetId ? { presetId } : {}) });
  const strat = makeStrategy(strategy, seedToState(`strategy:${seed}`), seed);
  const rec: GameRecord = {
    seed,
    ending: 'none',
    months: 0,
    turns: 0,
    years: {},
    preWinterDeaths: 0,
    winters: Object.fromEntries(
      Array.from({ length: WINTER_COUNT }, (_, i) => [`winter${i + 1}`, { reached: false, deaths: 0, maxHunger: 0, minFoodDays: Infinity }]),
    ),
    startFoodDays: {},
    cohesion: {},
    picks: {},
    presented: {},
    events: {},
    quietMonths: 0,
  };
  let winterNo = 0;
  let inWinter = false;
  for (let t = 0; t < maxTurns && s.step !== 'ended'; t++) {
    if (s.step === 'settlement') applyCommand(def, s, { type: 'nextMonth' });
    const cal = monthDef(def, s).number;
    const year = calendarDate(def, s).year;
    const firstYear = year === 1;
    const winterNow = WINTER_MONTHS.includes(cal);
    if (winterNow && !inWinter) winterNo += 1;
    inWinter = winterNow;
    const w = winterNow ? rec.winters[`winter${winterNo}`] : undefined;
    if (firstYear) rec.startFoodDays[cal] = foodDays(def, s);
    for (const c of s.work.candidates) rec.presented[c.policyId] = (rec.presented[c.policyId] ?? 0) + 1;
    if (w) w.minFoodDays = Math.min(w.minFoodDays, foodDays(def, s));
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
    if (firstYear) rec.cohesion[cal] = { ...(s.work.cohesionBy ?? {}) };
    if (w) {
      w.reached = true;
      w.deaths += s.work.deaths.length;
      w.maxHunger = Math.max(w.maxHunger, s.work.maxHunger);
      w.minFoodDays = Math.min(w.minFoodDays, foodDays(def, s));
    } else if (winterNo === 0) rec.preWinterDeaths += s.work.deaths.length;
    const y = (rec.years[year] ??= { turns: 0, deaths: 0, rationPhases: [0, 0, 0], cellsDone: 0, cohesionEnd: 0 });
    y.turns += 1;
    y.deaths += s.work.deaths.length;
    const rp = s.work.rationPhases ?? [0, 0, 0];
    for (const i of [0, 1, 2] as const) y.rationPhases[i] += rp[i];
    y.cellsDone = Object.values(s.tech).filter((c) => c.status === 'done').length;
    y.cohesionEnd = s.cohesion;
    if (rec.neolithicTurn === undefined && s.flags['neolithic'] !== undefined) rec.neolithicTurn = s.turn;
    rec.months = s.month;
    rec.turns = s.turn;
  }
  rec.ending = s.ending?.id ?? (population(s) === 0 ? 'extinct?' : 'running');
  return rec;
}

const pct = (xs: number[], p: number) => {
  if (xs.length === 0) return NaN;
  const sorted = xs.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
};

/** 첫 해 달 순서 (봄 시작 기준 화면 순서) */
export const CAL_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2];

export function summarize(def: ChapterDefinition, recs: GameRecord[]) {
  const n = recs.length;
  const endings: Record<string, number> = {};
  for (const r of recs) endings[r.ending] = (endings[r.ending] ?? 0) + 1;
  const winters = Object.fromEntries(
    Object.keys(recs[0]?.winters ?? {}).map((name) => {
      const reached = recs.filter((r) => r.winters[name]!.reached);
      const ws = reached.map((r) => r.winters[name]!);
      const deaths = ws.map((w) => w.deaths);
      return [
        name,
        {
          reached: reached.length / n,
          deaths: { p10: pct(deaths, 0.1), p50: pct(deaths, 0.5), p90: pct(deaths, 0.9) },
          anyDeath: ws.filter((w) => w.deaths > 0).length / Math.max(1, ws.length),
          /** 배급 감축 이상을 겪은 판 */
          hungry: ws.filter((w) => w.maxHunger >= 1).length / Math.max(1, ws.length),
          /** 굶주림(2단계)을 겪은 판 */
          starved: ws.filter((w) => w.maxHunger >= 2).length / Math.max(1, ws.length),
          minFoodDaysP50: pct(ws.map((w) => w.minFoodDays), 0.5),
        },
      ];
    }),
  );
  const preWinter = recs.map((r) => r.preWinterDeaths);
  const startFoodDaysP50 = Object.fromEntries(
    CAL_ORDER.map((c) => [c, pct(recs.filter((r) => r.startFoodDays[c] !== undefined).map((r) => r.startFoodDays[c]!), 0.5)]),
  );
  // 결속 경로: 출처별, 달별 판당 평균 (그 달에 닿은 판 기준)
  const sources = new Set<string>();
  for (const r of recs) for (const by of Object.values(r.cohesion)) for (const k of Object.keys(by)) sources.add(k);
  const cohesionPaths: Record<string, Record<number, number> & { total: number }> = {};
  for (const src of [...sources].sort()) {
    const row = { total: 0 } as Record<number, number> & { total: number };
    for (const c of CAL_ORDER) {
      const had = recs.filter((r) => r.cohesion[c] !== undefined);
      const v = had.reduce((a, r) => a + (r.cohesion[c]![src] ?? 0), 0) / Math.max(1, had.length);
      row[c] = v;
      row.total += v;
    }
    cohesionPaths[src] = row;
  }
  const firstWinterExtinct = recs.filter((r) => r.ending === 'ruin_extinct' && r.winters['winter1']?.reached && !r.winters['winter2']?.reached).length / n;
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
  // 해별: 그 해에 닿은 판 기준
  const yearIds = [...new Set(recs.flatMap((r) => Object.keys(r.years).map(Number)))].sort((a, b) => a - b);
  const years = Object.fromEntries(
    yearIds.map((yr) => {
      const ys = recs.map((r) => r.years[yr]).filter((y): y is YearRecord => y !== undefined);
      const phases = ys.reduce((a, y) => a + y.rationPhases[0] + y.rationPhases[1] + y.rationPhases[2], 0);
      return [
        yr,
        {
          reached: ys.length / n,
          turnsP50: pct(ys.map((y) => y.turns), 0.5),
          deaths: { p50: pct(ys.map((y) => y.deaths), 0.5), p90: pct(ys.map((y) => y.deaths), 0.9) },
          /** 순 중 배급 감축(1단계) · 굶주림(2단계) 비율 */
          reducedRate: ys.reduce((a, y) => a + y.rationPhases[1], 0) / Math.max(1, phases),
          starveRate: ys.reduce((a, y) => a + y.rationPhases[2], 0) / Math.max(1, phases),
          cellsDone: { p10: pct(ys.map((y) => y.cellsDone), 0.1), p50: pct(ys.map((y) => y.cellsDone), 0.5), p90: pct(ys.map((y) => y.cellsDone), 0.9) },
          cohesionEndP50: pct(ys.map((y) => y.cohesionEnd), 0.5),
        },
      ];
    }),
  );
  const neo = recs.filter((r) => r.neolithicTurn !== undefined).map((r) => r.neolithicTurn!);
  return {
    games: n,
    endings,
    turns: { p10: pct(recs.map((r) => r.turns), 0.1), p50: pct(recs.map((r) => r.turns), 0.5), p90: pct(recs.map((r) => r.turns), 0.9) },
    years,
    neolithic: { rate: neo.length / Math.max(1, n), turnP50: pct(neo, 0.5) },
    months: { p10: pct(recs.map((r) => r.months), 0.1), p50: pct(recs.map((r) => r.months), 0.5), p90: pct(recs.map((r) => r.months), 0.9) },
    preWinterDeaths: { p50: pct(preWinter, 0.5), p90: pct(preWinter, 0.9), anyDeath: preWinter.filter((x) => x > 0).length / Math.max(1, n) },
    startFoodDaysP50,
    firstWinterExtinct,
    winters,
    cohesionPaths,
    pickRate,
    eventsPerGame: Object.fromEntries(Object.entries(events).map(([k, v]) => [k, v / n])),
    neverFired,
    quietMonthRate: recs.reduce((a, r) => a + r.quietMonths, 0) / Math.max(1, totalMonths),
  };
}
