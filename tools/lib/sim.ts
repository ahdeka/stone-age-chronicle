// 헤드리스 밸런스 시뮬레이터 (DESIGN.md §12).
// 전략
//  - random: 이벤트는 고를 수 있는 선택지 중 무작위, 카드는 쓸 수 있는 것 중 무작위(가끔 아낌), 배정도 무작위
//  - fixed:  고를 수 있는 첫 선택지, 쓸 수 있는 첫 카드
// 두 전략 모두 역할 배분은 시작 프리셋 비율을 유지한다 (무작위 배분은 의미 없는 멸족만 만든다 — M1 결과).
// 시뮬레이터 자신의 결정에도 seeded RNG를 쓴다 → 같은 인자면 같은 리포트.

import {
  applyCommand,
  canAssign,
  cardStatus,
  createGame,
  findAction,
  nextFloat,
  optionStatuses,
  seedToState,
  type ChapterDefinition,
  type Command,
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

export interface OptionStat {
  eventId: string;
  optionId: string;
  shown: number;
  picked: number;
  /** 이 선택지를 한 번이라도 고른 판의 평균 최종 인구 / 전체 평균 */
  popLift: number;
}

export interface SimReport {
  options: SimOptions;
  games: number;
  avgFinalTurn: number;
  endings: Record<string, number>;
  hungryTurnRate: number;
  /** 겨울 결산 직후 굶주린 비율 (§18 확인 항목 5) */
  winterHungerRate: number;
  popLossGameRate: number;
  checkpoints: Record<number, Record<string, Quantiles>>;
  eventsPerTurn: number;
  /** 이벤트별 판당 평균 발생 횟수 */
  eventRates: Record<string, number>;
  neverFired: string[];
  optionStats: OptionStat[];
  /** 카드별 판당 평균 사용 횟수 */
  cardRates: Record<string, number>;
  /** M3/M4 이후에 측정할 수 있는 항목 */
  notYetMeasurable: string[];
}

function quantiles(xs: number[]): Quantiles {
  if (xs.length === 0) return { p10: 0, p50: 0, p90: 0 };
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
  const r = (v: number) => Math.round(v * 10) / 10;
  return { p10: r(q(0.1)), p50: r(q(0.5)), p90: r(q(0.9)) };
}

const pick = <T>(rng: RngState, xs: readonly T[]): T | undefined => (xs.length ? xs[Math.floor(nextFloat(rng) * xs.length)] : undefined);

/** 시작 프리셋 비율로 인구를 나눈다 */
function presetAllocation(def: ChapterDefinition, s: GameState): Record<string, number> {
  const preset = def.startPresets[0]!;
  const pop = s.tribe.population;
  const out: Record<string, number> = {};
  let given = 0;
  for (const r of def.roles) {
    const n = Math.floor(((preset.roles[r.id] ?? 0) / preset.population) * pop);
    out[r.id] = n;
    given += n;
  }
  out[def.balance.newcomerRole] = (out[def.balance.newcomerRole] ?? 0) + (pop - given);
  return out;
}

/** 다음 커맨드 하나를 고른다 */
function decide(def: ChapterDefinition, s: GameState, strategy: Strategy, rng: RngState, rolesSet: boolean): Command {
  if (!rolesSet) return { type: 'setRoles', roles: presetAllocation(def, s) };
  if (s.phase === 'event') {
    const inst = s.events.pending[0]!;
    const avail = optionStatuses(def, s, inst).filter((o) => o.available);
    const chosen = strategy === 'fixed' ? avail[0] : pick(rng, avail);
    return { type: 'chooseOption', eventUid: inst.uid, optionId: chosen!.option.id };
  }
  if (s.actions.playsLeft > 0) {
    const playable = s.deck.hand.filter((c) => cardStatus(def, s, c).available);
    // random은 가끔(20%) 카드를 아낀다 — "아무것도 안 하기"도 선택이다
    const skip = strategy === 'random' && nextFloat(rng) < 0.2;
    const card = strategy === 'fixed' ? playable[0] : skip ? undefined : pick(rng, playable);
    if (card) {
      const a = findAction(def, card.cardId);
      let personId: string | undefined;
      if (a?.assign && strategy === 'random' && nextFloat(rng) < 0.5) {
        const candidates = Object.keys(s.people)
          .sort()
          .filter((id) => canAssign(a, s, id));
        personId = pick(rng, candidates);
      }
      return { type: 'playAction', cardUid: card.uid, personId };
    }
  }
  return { type: 'endActionPhase' };
}

export function runSim(def: ChapterDefinition, opts: SimOptions): SimReport {
  const endings: Record<string, number> = {};
  const samples: Record<number, Record<string, number[]>> = {};
  const eventCounts: Record<string, number> = Object.fromEntries(def.content.events.map((e) => [e.id, 0]));
  const cardCounts: Record<string, number> = Object.fromEntries(def.content.actions.map((a) => [a.id, 0]));
  const optShown = new Map<string, number>();
  const optPicked = new Map<string, number>();
  const optGames = new Map<string, number[]>(); // 고른 판들의 최종 인구
  const finalPops: number[] = [];
  let finalTurns = 0;
  let hungryTurns = 0;
  let totalTurns = 0;
  let winterTurns = 0;
  let winterHungry = 0;
  let popLossGames = 0;
  let totalEvents = 0;

  const record = (s: GameState) => {
    if (!opts.checkpoints.includes(s.turn)) return;
    const bucket = (samples[s.turn] ??= {});
    const put = (k: string, v: number) => (bucket[k] ??= []).push(v);
    put('population', s.tribe.population);
    for (const [k, v] of Object.entries(s.tribe.resources)) put(k, v);
    put('lore_total', s.counters['lore_total'] ?? 0);
  };

  for (let g = 0; g < opts.games; g++) {
    const rng = seedToState(`${opts.seed}:strategy:${g}`);
    const s = createGame(def, { kind: 'preset', presetId: def.startPresets[0]!.id, tribeTraits: [], seed: `${opts.seed}:${g}` });
    const pickedThisGame = new Set<string>();
    let lostPop = false;
    let rolesSet = false;
    let lastTurn = 0;
    let steps = 0;

    while (s.phase !== 'ended') {
      if (++steps > 10000) throw new Error('sim: no progress');
      if (s.turn !== lastTurn) {
        // 새 턴 시작: 이벤트 집계, 체크포인트, 역할 재배분
        lastTurn = s.turn;
        rolesSet = false;
        record(s);
        for (const p of s.events.pending) {
          eventCounts[p.eventId] = (eventCounts[p.eventId] ?? 0) + 1;
          totalEvents++;
        }
      }
      const cmd = decide(def, s, opts.strategy, rng, rolesSet);
      if (cmd.type === 'chooseOption') {
        for (const o of optionStatuses(def, s, s.events.pending[0]!)) {
          if (!o.available) continue;
          const k = `${s.events.pending[0]!.eventId}.${o.option.id}`;
          optShown.set(k, (optShown.get(k) ?? 0) + 1);
        }
      }
      const seasonBefore = s.season;
      const err = applyCommand(def, s, cmd);
      if (err) throw new Error(`sim command rejected: ${err} ${JSON.stringify(cmd)}`);
      if (cmd.type === 'setRoles') rolesSet = true;
      if (cmd.type === 'chooseOption') {
        const evId = lastChosen(s);
        if (evId) {
          const k = `${evId}.${cmd.optionId}`;
          optPicked.set(k, (optPicked.get(k) ?? 0) + 1);
          pickedThisGame.add(k);
        }
      }
      if (cmd.type === 'playAction') {
        const used = s.turnLog.filter((l) => l.kind === 'action').at(-1);
        if (used && used.kind === 'action') cardCounts[used.cardId] = (cardCounts[used.cardId] ?? 0) + 1;
      }
      if (cmd.type === 'endActionPhase') {
        totalTurns++;
        const last = s.history[s.history.length - 1]!;
        if (last.log.some((l) => l.kind === 'population' && l.source === 'starvation')) lostPop = true;
        const hungry = s.flags[def.balance.starvation.flag] !== undefined;
        if (hungry) hungryTurns++;
        if (seasonBefore === 'winter') {
          winterTurns++;
          if (hungry) winterHungry++;
        }
      }
    }
    if (lostPop) popLossGames++;
    finalTurns += s.turn;
    finalPops.push(s.tribe.population);
    for (const k of pickedThisGame) (optGames.get(k) ?? optGames.set(k, []).get(k)!).push(s.tribe.population);
    const id = s.ending?.id ?? 'none';
    endings[id] = (endings[id] ?? 0) + 1;
  }

  const checkpoints: SimReport['checkpoints'] = {};
  for (const [turn, bucket] of Object.entries(samples)) {
    checkpoints[Number(turn)] = Object.fromEntries(Object.entries(bucket).map(([k, v]) => [k, quantiles(v)]));
  }
  const avgPop = finalPops.reduce((a, b) => a + b, 0) / Math.max(1, finalPops.length);
  const optionStats: OptionStat[] = [];
  for (const ev of def.content.events) {
    for (const o of ev.options) {
      const k = `${ev.id}.${o.id}`;
      const pops = optGames.get(k) ?? [];
      const mean = pops.length ? pops.reduce((a, b) => a + b, 0) / pops.length : 0;
      optionStats.push({
        eventId: ev.id,
        optionId: o.id,
        shown: optShown.get(k) ?? 0,
        picked: optPicked.get(k) ?? 0,
        popLift: avgPop > 0 && pops.length ? Math.round((mean / avgPop) * 100) / 100 : 0,
      });
    }
  }
  const per = (n: number) => Math.round((n / Math.max(1, opts.games)) * 100) / 100;

  return {
    options: opts,
    games: opts.games,
    avgFinalTurn: Math.round((finalTurns / Math.max(1, opts.games)) * 10) / 10,
    endings,
    hungryTurnRate: Math.round((hungryTurns / Math.max(1, totalTurns)) * 1000) / 1000,
    winterHungerRate: Math.round((winterHungry / Math.max(1, winterTurns)) * 1000) / 1000,
    popLossGameRate: Math.round((popLossGames / Math.max(1, opts.games)) * 1000) / 1000,
    checkpoints,
    eventsPerTurn: Math.round((totalEvents / Math.max(1, totalTurns)) * 100) / 100,
    eventRates: Object.fromEntries(Object.entries(eventCounts).map(([k, v]) => [k, per(v)])),
    neverFired: Object.entries(eventCounts)
      .filter(([, v]) => v === 0)
      .map(([k]) => k),
    optionStats,
    cardRates: Object.fromEntries(Object.entries(cardCounts).map(([k, v]) => [k, per(v)])),
    notYetMeasurable: [
      '판당 계승 횟수, 첫 계승과 시대 전환의 간격 (M3 인물 사망·계승, M4 시대 전환 이후)',
      '시대 전환 턴 분포 (M4)',
      '승리 결말 분포와 지배적 선택지의 승리 상관 (M6 — 지금은 최종 인구로 대신한다)',
    ],
  };
}

/** 방금 답한 이벤트 id: 이번 턴 로그의 마지막 event 항목 */
function lastChosen(s: GameState): string | undefined {
  for (let i = s.turnLog.length - 1; i >= 0; i--) {
    const l = s.turnLog[i]!;
    if (l.kind === 'event') return l.eventId;
  }
  return undefined;
}
