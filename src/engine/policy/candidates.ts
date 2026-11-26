// 방침 후보 생성 (DESIGN.md §6, 두 칸은 §6.4)
// 조건 통과 → 원정대 구성 → 상황 점수 → 칸별로: 식량(버티기 보장) / 발전 / 큰 일

import type { ActivityDef, BoundPolicy, ChapterDefinition, GameState, Hint, Id, Person, PersonQuery, PolicySlot, PolicyTemplate } from '../types';
import { canStartCell } from '../tech/tech';
import { findCell, peekCell } from '../tech/query';
import { PHASES } from '../types';
import { allTrue, foodDays, matchPerson } from '../conditions/evaluate';
import { monthDef, nextUid } from '../core/lookup';
import { cannotWork, laborUnits, living, sortForCrew } from '../people/people';
import { nextFloat } from '../rng/rng';
import { hintFor, type ActCtx } from '../outcome/tier';

export interface CrewOpts {
  /** 이미 다른 전략에 뽑힌 사람 (무리와 이끄는 사람) */
  taken?: ReadonlySet<Id>;
  /** 이미 마을 일에서 빠진 일손 (다른 전략의 무리) */
  awayUnits?: number;
  /** 이끄는 사람을 미리 정했다 (두 칸 전략: previewPlan이 식량 → 발전 순으로 먼저 정한다). null = 없음 */
  leader?: Person | null;
}

/** 이끄는 사람: 맞는 사람이 없거나 다른 자리에 있으면 fallback. 난수를 쓰지 않는다 */
export function pickLeader(def: ChapterDefinition, state: GameState, p: PolicyTemplate, taken?: ReadonlySet<Id>): Person | undefined {
  const find = (q: PersonQuery | undefined) => (q ? living(state).find((x) => !taken?.has(x.id) && !cannotWork(def, x) && matchPerson(def, state, x, q)) : undefined);
  return find(p.leader) ?? find(p.leaderFallback);
}

/** 이 턴에 쓰는 무리 규격. 1년차(달 턴)의 칸 무리는 작다: 칸 인원 × monthCrew.share, 내림, 최소 monthCrew.min
 *  (장인 + 1명 수준, 2026-11-26). 진척 속도는 그대로다. 계절 턴과 칸이 아닌 전략은 정의 그대로 */
export function crewSpecFor(def: ChapterDefinition, state: GameState, p: PolicyTemplate): PolicyTemplate['crew'] {
  const spec = p.crew;
  if (!spec || !p.tech || state.work.turn.kind !== 'month') return spec;
  const m = def.balance.tech.monthCrew;
  const n = Math.max(m.min, Math.floor(spec.min * m.share));
  return { ...spec, min: n, max: n };
}

/** 원정대와 이끄는 사람을 정한다. 난수를 쓰지 않는다. 인원이 모자라면 undefined */
export function formCrew(def: ChapterDefinition, state: GameState, p: PolicyTemplate, opts: CrewOpts = {}): { crew: Person[]; leader?: Person } | undefined {
  const free = (x: Person) => !opts.taken?.has(x.id);
  const leaderPick = opts.leader !== undefined ? (opts.leader ?? undefined) : pickLeader(def, state, p, opts.taken);
  if (p.leader && !leaderPick) return undefined;
  if (!p.crew) return leaderPick ? { crew: [], leader: leaderPick } : { crew: [] };

  const spec = crewSpecFor(def, state, p)!;
  const pool = living(state).filter(
    (x) => free(x) && laborUnits(def, state, x) > 0 && (spec.includeChief || !x.isChief) && (spec.band ? matchPerson(def, state, x, { band: spec.band }) : matchPerson(def, state, x, { band: ['adult'] })),
  );
  const totalUnits = living(state).reduce((a, x) => a + laborUnits(def, state, x), 0);
  const room = Math.floor(totalUnits - (opts.awayUnits ?? 0) - spec.keepHome);
  const max = spec.max === 'all' ? pool.length : spec.max;
  const size = Math.min(max, room, pool.length);
  if (size < spec.min) return undefined;

  let crew = sortForCrew(pool, spec.prefer).slice(0, size);
  if (leaderPick && !crew.includes(leaderPick) && pool.includes(leaderPick)) crew = [leaderPick, ...crew.slice(0, size - 1)];
  const leader = leaderPick ?? crew[0];
  return leader ? { crew, leader } : { crew };
}

export function activities(p: PolicyTemplate): ActivityDef[] {
  const out: ActivityDef[] = [];
  for (const ph of PHASES) for (const s of p.steps[ph] ?? []) if (s.kind === 'activity') out.push(s.activity);
  return out;
}

const HINT_RANK: Record<Hint, number> = { sure: 0, fair: 1, risky: 2, unknown: 3 };

/** 방침의 위험 단서 = 그 안의 활동 중 가장 나쁜 것 */
export function policyHint(def: ChapterDefinition, state: GameState, p: PolicyTemplate, ctx: ActCtx): Hint {
  for (const h of p.hintWhen ?? []) if (allTrue(def, state, h.when, ctx.actors)) return h.hint;
  let worst: Hint = 'sure';
  for (const a of activities(p)) {
    const h = hintFor(def, state, a, ctx);
    if (HINT_RANK[h] > HINT_RANK[worst]) worst = h;
  }
  return worst;
}

/** 이 전략이 지금 턴 종류(달 / 철)에 나오는가 */
export function fitsTurn(state: GameState, p: PolicyTemplate): boolean {
  const t = p.turn ?? 'month';
  return t === 'any' || t === state.work.turn.kind;
}

export function isAvailable(def: ChapterDefinition, state: GameState, p: PolicyTemplate): boolean {
  if (!fitsTurn(state, p)) return false;
  if (p.tech && !canStartCell(def, state, p.tech)) return false;
  if (p.once && state.usedOnce.includes(p.id)) return false;
  // 다 지은 시설을 또 짓지 않는다
  if (p.builds && (state.facilities[p.builds.facility] ?? 0) >= facilityMax(def, p.builds.facility)) return false;
  if ((state.cooldowns[p.id] ?? 0) > state.turn) return false;
  return allTrue(def, state, p.appearsWhen);
}

export function facilityMax(def: ChapterDefinition, id: Id): number {
  const f = def.facilities.find((x) => x.id === id);
  if (!f) throw new Error(`unknown facility: ${id}`);
  return f.max;
}

/** 묻어 둔 고기가 있는 곳: 많이 묻은 곳 → 가까운 곳 순, 최대 maxCacheTargets곳 */
export function cacheTargets(def: ChapterDefinition, state: GameState): string[] {
  const byPlace = new Map<string, number>();
  for (const c of state.caches) byPlace.set(c.place, (byPlace.get(c.place) ?? 0) + c.lots.reduce((a, l) => a + l.kg, 0));
  const travel = (id: string) => def.places.find((x) => x.id === id)?.travelDays ?? 0;
  return [...byPlace.entries()]
    .sort((a, b) => b[1] - a[1] || travel(a[0]) - travel(b[0]) || (a[0] < b[0] ? -1 : 1))
    .slice(0, def.balance.policy.maxCacheTargets)
    .map(([id]) => id);
}

export function generateCandidates(def: ChapterDefinition, state: GameState): BoundPolicy[] {
  const b = def.balance.policy;
  const scored: { p: PolicyTemplate; bound: BoundPolicy; offered: boolean }[] = [];
  const savedPlace = state.work.probePlace;
  for (const p of def.content.policies) {
    // 다른 턴 종류의 전략은 버티기 방침이라도 넣지 않는다
    if (!fitsTurn(state, p)) continue;
    // 버티기 방침은 등장 조건이 안 맞아도 계산해 둔다: 식량 후보가 하나도 없을 때 넣는다
    const offered = isAvailable(def, state, p);
    if (!offered && !p.fallback) continue;
    const formed = formCrew(def, state, p);
    if (!formed) continue;
    const actors: Record<string, string> = formed.leader ? { leader: formed.leader.id } : {};
    // 묻어 둔 고기마다 후보 하나 (그 곳을 이번 달의 곳으로 놓고 단서와 점수를 계산한다)
    const targets: (string | undefined)[] = p.bindCache ? cacheTargets(def, state) : [undefined];
    for (const place of targets) {
      if (place) state.work.probePlace = place;
      const hint = policyHint(def, state, p, { crew: formed.crew, ...(formed.leader ? { leader: formed.leader } : {}), actors });
      let score = p.priority + (nextFloat(state.rng) * 2 - 1) * b.jitter;
      for (const r of p.relevance ?? []) if (allTrue(def, state, r.when, actors)) score += r.add;
      if (p.builds && (state.projects[p.builds.facility] ?? 0) > 0) score += b.projectBonus;
      // 칸의 이어 가기: 부족이 직접 일한 칸만 (선물·저절로 나아간 몫만 있는 칸은 아니다. 1년차 칸의 가산은 이것뿐)
      if (p.tech && peekCell(state, p.tech).status === 'active' && peekCell(state, p.tech).log.some((l) => l.kind === 'work')) score += b.projectBonus;
      // 1년차 겨울 준비: 가을·겨울에 가산 (칸이 늘 이기지 않게)
      const prep = def.balance.tech.prepBonus;
      if (p.prep === 'winter' && state.work.turn.kind === 'month' && prep.seasons.includes(monthDef(def, state).season)) score += prep.add;
      if (place) {
        if (savedPlace === undefined) delete state.work.probePlace;
        else state.work.probePlace = savedPlace;
      }
      scored.push({
        p,
        bound: {
          uid: nextUid(state, 'p'),
          policyId: p.id,
          crew: formed.crew.map((x) => x.id),
          ...(formed.leader ? { leaderId: formed.leader.id } : {}),
          hint,
          score,
          ...(place ? { place } : {}),
        },
        offered,
      });
    }
  }
  scored.sort((x, y) => y.bound.score - x.bound.score);

  const urgent = foodDays(def, state) < b.urgentFoodDays;
  const take = (slot: PolicySlot, n: number, keep: (s: (typeof scored)[number]) => boolean = () => true) => {
    const picked: typeof scored = [];
    const perCat: Record<string, number> = {};
    for (const s of scored) {
      if (s.p.slot !== slot || !s.offered || !keep(s)) continue;
      if (picked.length >= n) break;
      if ((perCat[s.p.category] ?? 0) >= b.maxPerCategory) continue;
      picked.push(s);
      perCat[s.p.category] = (perCat[s.p.category] ?? 0) + 1;
    }
    return picked;
  };
  const foodN = urgent ? b.urgentFoodSlots : b.foodSlots;
  const food = take('food', foodN);
  // 버티기 방침: 나올 때(식량이 모자랄 때)는 늘 하나 넣는다 (자리가 차 있으면 마지막 자리를 내준다).
  // 식량 후보가 하나도 없으면 등장 조건과 무관하게 넣는다
  if (!food.some((s) => s.p.fallback)) {
    const fb = scored.find((s) => s.p.fallback && (s.offered || food.length === 0));
    if (fb) {
      if (food.length >= foodN) food.pop();
      food.push(fb);
    }
  }
  // 발전: 열린 칸 먼저(턴 종류별 칸 자리 수까지, 진척이 많은 칸 → 앞 칸 → 갈래 순), 남는 자리에 작은 발전 (§B3.6, §B4.2)
  const growthN = urgent ? b.urgentGrowthSlots : b.growthSlots;
  const cellRank = (s: (typeof scored)[number]) => {
    const cell = findCell(def, s.p.tech!);
    return [-peekCell(state, cell.id).progress, cell.order, def.tech.branches.indexOf(cell.branch)];
  };
  // 1년차: 부족이 새로 시작하는 칸은 하나 (2026-11-26). 부족이 일한 칸이 하나라도 있으면(진행 중이든 마쳤든)
  // 그 뒤로는 진행 중인 칸만 후보다 — 선물로 진척이 생긴 칸은 이어 갈 수 있다
  const started = state.work.turn.kind === 'month' && def.tech.cells.some((c) => peekCell(state, c.id).log.some((l) => l.kind === 'work'));
  const cells = scored
    .filter((s) => s.p.slot === 'growth' && s.offered && s.p.tech && (!started || peekCell(state, s.p.tech).status === 'active'))
    .sort((x, y) => {
      const a = cellRank(x);
      const c = cellRank(y);
      return a[0]! - c[0]! || a[1]! - c[1]! || a[2]! - c[2]!;
    })
    .slice(0, Math.min(growthN, def.balance.tech.cellSlots[state.work.turn.kind]));
  const small = take('growth', growthN, (s) => !s.p.tech).slice(0, growthN - cells.length);
  // 화면과 자동 플레이 모두 점수 순 (칸이 고정으로 먼저 오지 않는다)
  const growth = [...cells, ...small].sort((x, y) => y.bound.score - x.bound.score);
  const major = take('major', 1);
  // 화면 순서: 큰 일(맨 위 한 줄) → 식량 → 발전
  return [...major, ...food, ...growth].map((s) => s.bound);
}
