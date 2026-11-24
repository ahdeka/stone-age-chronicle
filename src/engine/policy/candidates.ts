// 방침 후보 생성 (DESIGN.md §6)
// 조건 통과 → 원정대 구성 → 상황 점수 → 분야 제한과 버티기 방침 보장 → 3~5개

import type { ActivityDef, BoundPolicy, ChapterDefinition, GameState, Hint, Person, PolicyTemplate } from '../types';
import { PHASES } from '../types';
import { allTrue, foodDays, matchPerson } from '../conditions/evaluate';
import { nextUid } from '../core/lookup';
import { cannotWork, laborUnits, living, sortForCrew } from '../people/people';
import { nextFloat } from '../rng/rng';
import { hintFor, type ActCtx } from '../outcome/tier';

/** 원정대와 이끄는 사람을 정한다. 난수를 쓰지 않는다. 인원이 모자라면 undefined */
export function formCrew(def: ChapterDefinition, state: GameState, p: PolicyTemplate): { crew: Person[]; leader?: Person } | undefined {
  const leaderPick = p.leader ? living(state).find((x) => !cannotWork(def, x) && matchPerson(def, state, x, p.leader!)) : undefined;
  if (p.leader && !leaderPick) return undefined;
  if (!p.crew) return leaderPick ? { crew: [], leader: leaderPick } : { crew: [] };

  const spec = p.crew;
  const pool = living(state).filter(
    (x) => laborUnits(def, state, x) > 0 && (spec.includeChief || !x.isChief) && (spec.band ? matchPerson(def, state, x, { band: spec.band }) : matchPerson(def, state, x, { band: ['adult'] })),
  );
  const totalUnits = living(state).reduce((a, x) => a + laborUnits(def, state, x), 0);
  const room = Math.floor(totalUnits - spec.keepHome);
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
  let worst: Hint = 'sure';
  for (const a of activities(p)) {
    const h = hintFor(def, state, a, ctx);
    if (HINT_RANK[h] > HINT_RANK[worst]) worst = h;
  }
  return worst;
}

export function isAvailable(def: ChapterDefinition, state: GameState, p: PolicyTemplate): boolean {
  if (p.once && state.usedOnce.includes(p.id)) return false;
  if ((state.cooldowns[p.id] ?? 0) > state.month) return false;
  return allTrue(def, state, p.appearsWhen);
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
  const scored: { p: PolicyTemplate; bound: BoundPolicy }[] = [];
  const savedPlace = state.work.place;
  for (const p of def.content.policies) {
    if (!isAvailable(def, state, p)) continue;
    const formed = formCrew(def, state, p);
    if (!formed) continue;
    const actors: Record<string, string> = formed.leader ? { leader: formed.leader.id } : {};
    // 묻어 둔 고기마다 후보 하나 (그 곳을 이번 달의 곳으로 놓고 단서와 점수를 계산한다)
    const targets: (string | undefined)[] = p.bindCache ? cacheTargets(def, state) : [undefined];
    for (const place of targets) {
      if (place) state.work.place = place;
      const hint = policyHint(def, state, p, { crew: formed.crew, ...(formed.leader ? { leader: formed.leader } : {}), actors });
      let score = p.priority + (nextFloat(state.rng) * 2 - 1) * b.jitter;
      for (const r of p.relevance ?? []) if (allTrue(def, state, r.when, actors)) score += r.add;
      if (place) {
        if (savedPlace === undefined) delete state.work.place;
        else state.work.place = savedPlace;
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
      });
    }
  }
  scored.sort((x, y) => y.bound.score - x.bound.score);

  const slots = foodDays(def, state) < b.urgentFoodDays ? b.urgentSlots : b.slots;
  const picked: typeof scored = [];
  const perCat: Record<string, number> = {};
  for (const s of scored) {
    if (picked.length >= slots) break;
    if ((perCat[s.p.category] ?? 0) >= b.maxPerCategory) continue;
    picked.push(s);
    perCat[s.p.category] = (perCat[s.p.category] ?? 0) + 1;
  }
  // 버티기 방침을 늘 하나 넣는다 (자리가 차 있으면 마지막 자리를 내준다)
  if (!picked.some((s) => s.p.fallback)) {
    const fb = scored.find((s) => s.p.fallback);
    if (fb) {
      if (picked.length >= slots) picked.pop();
      picked.push(fb);
    }
  }
  return picked.map((s) => s.bound);
}
