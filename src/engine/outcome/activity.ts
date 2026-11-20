// 활동 실행: 등급을 굴리고, 등급별 결과와 대가를 적용한다 (DESIGN.md §7.1, §7.3)

import type { ActivityDef, CostEntry, Person, Tier } from '../types';
import { allTrue } from '../conditions/evaluate';
import { applyEffects, applyNarrative, currentReport, type RunCtx } from '../effects/apply';
import { weightedIndex } from '../rng/rng';
import { margin, rollTier, type ActCtx } from './tier';

export function actCtx(ctx: RunCtx): ActCtx {
  const crew = ctx.crew.map((id) => ctx.state.people[id]).filter((p): p is Person => !!p && p.alive);
  const leaderId = ctx.actors['leader'];
  const leader = leaderId ? ctx.state.people[leaderId] : undefined;
  return { crew, ...(leader ? { leader } : {}), actors: ctx.actors };
}

function pickCosts(ctx: RunCtx, costs: readonly CostEntry[], n: number): CostEntry[] {
  const pool = costs.filter((c) => allTrue(ctx.def, ctx.state, c.when, ctx.actors));
  const out: CostEntry[] = [];
  for (let k = 0; k < n && pool.length > 0; k++) {
    const i = weightedIndex(ctx.state.rng, pool.map((c) => c.weight));
    if (i < 0) break;
    out.push(pool[i]!);
    pool.splice(i, 1);
  }
  return out;
}

export function runActivity(ctx: RunCtx, a: ActivityDef): Tier {
  const { def, state } = ctx;
  const m = margin(def, state, a, actCtx(ctx));
  const tier = rollTier(state.rng, m, def.balance.tier);
  const report = currentReport(state);
  report.tier = tier;
  state.work.tiers.push(tier);
  if (tier !== 'success' && tier !== 'triumph') state.work.notable = true;

  const out = a.outcomes[tier];
  if (out.scene) report.scene = out.scene;
  // 결과 변수는 활동마다 새로 센다. 효과를 먼저 적용해야 서술이 $caught 같은 값을 쓸 수 있다
  delete state.work.vars['caught'];
  delete state.work.vars['meat'];
  delete state.work.vars['found'];
  applyEffects(ctx, out.effects);
  if (out.narrative) applyNarrative(ctx, out.narrative);

  const nCosts = tier === 'costly' ? 1 : tier === 'disaster' ? 2 : 0;
  for (const c of pickCosts(ctx, a.costs ?? [], nCosts)) applyEffects(ctx, c.effects);
  return tier;
}
