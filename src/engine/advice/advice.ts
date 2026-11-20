// 조언자들의 엇갈린 조언 (DESIGN.md §7.3)
// 조언자마다 입장에 따라 방침 후보에 점수를 매기고, 가장 높게 친 후보에 대한 대사를 말한다.
// 다른 조언자가 이미 고른 후보는 피해서 조언이 엇갈리게 한다. 난수를 쓰지 않는다.

import type { Advice, AdvisorLine, BoundPolicy, ChapterDefinition, GameState, Line, Person } from '../types';
import { allTrue } from '../conditions/evaluate';
import { byId, findPolicy } from '../core/lookup';
import { living } from '../people/people';

function score(def: ChapterDefinition, stanceId: string, c: BoundPolicy): number {
  const st = byId(def.advisors.stances, stanceId, 'stance');
  const cat = findPolicy(def, c.policyId).category;
  return (st.categories[cat] ?? 0) + (st.hints[c.hint] ?? 0);
}

/** 더 구체적인 대사가 먼저: 자리+방침 > 자리+분야 > 입장+방침 > 입장+분야 > 자리 > 입장 */
function specificity(l: AdvisorLine): number {
  const who = l.seat ? 2 : l.stance ? 1 : 0;
  const what = l.policy ? 2 : l.category ? 1 : 0;
  return what * 3 + who + (l.when ? 0.5 : 0);
}

function lineFor(def: ChapterDefinition, state: GameState, p: Person, c: BoundPolicy | undefined): Line {
  const seat = p.advisor!.seat;
  const stance = p.advisor!.stance;
  const policy = c ? findPolicy(def, c.policyId) : undefined;
  const fits = def.advisors.lines.filter(
    (l) =>
      (l.seat === undefined || l.seat === seat) &&
      (l.stance === undefined || l.stance === stance) &&
      (l.seat !== undefined || l.stance !== undefined) &&
      (l.policy === undefined || l.policy === policy?.id) &&
      (l.category === undefined || l.category === policy?.category) &&
      allTrue(def, state, l.when, c?.leaderId ? { leader: c.leaderId } : {}),
  );
  let best: AdvisorLine | undefined;
  for (const l of fits) if (!best || specificity(l) > specificity(best)) best = l;
  const leader = c?.leaderId ? state.people[c.leaderId] : undefined;
  return {
    key: best ? best.text : `advice.generic.${stance}`,
    params: { crew: c?.crew.length ?? 0, ...(leader ? { leader: leader.name } : {}) },
    group: 'info',
  };
}

export function buildAdvice(def: ChapterDefinition, state: GameState): Advice[] {
  const advisors = living(state).filter((p) => p.advisor);
  const taken = new Set<string>();
  const out: Advice[] = [];
  for (const p of advisors) {
    const ranked = state.work.candidates
      .map((c, i) => ({ c, s: score(def, p.advisor!.stance, c) - i * 1e-3 }))
      .sort((a, b) => b.s - a.s);
    const pick = ranked.find((x) => !taken.has(x.c.uid)) ?? ranked[0];
    if (pick) taken.add(pick.c.uid);
    out.push({ personId: p.id, ...(pick ? { policyUid: pick.c.uid } : {}), line: lineFor(def, state, p, pick?.c) });
  }
  return out;
}
