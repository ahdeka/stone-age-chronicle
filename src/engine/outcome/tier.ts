// 결과 등급 (DESIGN.md §7)
// 값 v = (힘 − 난이도) + r,  r = (u1 + u2 − 1) × spread  (삼각 분포)
// 삼각 분포라 등급별 확률을 닫힌 식으로 계산할 수 있다 → 위험 단서가 실제 굴림과 정확히 맞는다.

import type { ActivityDef, ChapterBalance, ChapterDefinition, GameState, Hint, Person, PowerTerm, RngState, Tier } from '../types';
import { TIERS } from '../types';
import { allTrue, type Actors } from '../conditions/evaluate';
import { nextFloat } from '../rng/rng';
import { stat } from '../stats/stats';

export interface ActCtx {
  crew: Person[];
  leader?: Person;
  actors: Actors;
}

export function termValue(def: ChapterDefinition, state: GameState, t: PowerTerm, ctx: ActCtx): number {
  switch (t.src) {
    case 'crew':
      return ctx.crew.reduce((a, p) => a + (1 + (t.skill ? (p.skills[t.skill] ?? 0) * (t.skillWeight ?? 0) : 0)) * t.weight, 0);
    case 'goods': {
      const n = state.stores.goods[t.id] ?? 0;
      if (t.perCrew) return ctx.crew.length > 0 ? Math.min(1, n / ctx.crew.length) * t.weight : 0;
      return Math.min(n, t.cap ?? Infinity) * t.weight;
    }
    case 'stat':
      return stat(def, state, t.id) * t.weight;
    case 'when':
      return allTrue(def, state, t.when, ctx.actors) ? t.value : 0;
    case 'leader': {
      const l = ctx.leader;
      if (!l || !l.alive) return 0;
      let v = 0;
      if (t.skill) v += (l.skills[t.skill] ?? 0) * t.weight;
      if (t.trait && l.traits.includes(t.trait)) v += t.weight;
      if (!t.skill && !t.trait) v += t.weight;
      return v;
    }
    case 'const':
      return t.value;
  }
}

export function margin(def: ChapterDefinition, state: GameState, a: ActivityDef, ctx: ActCtx): number {
  const power = a.power.reduce((sum, t) => sum + termValue(def, state, t, ctx), 0);
  return power - a.difficulty;
}

/** 삼각 분포 [-s, s]의 누적 분포 */
export function triCdf(x: number, s: number): number {
  if (x <= -s) return 0;
  if (x >= s) return 1;
  if (x <= 0) return (x + s) ** 2 / (2 * s * s);
  return 1 - (s - x) ** 2 / (2 * s * s);
}

/** 등급별 확률 (합 1) */
export function tierProbabilities(m: number, b: ChapterBalance['tier']): Record<Tier, number> {
  const atLeast = (t: number) => 1 - triCdf(t - m, b.spread);
  const pT = atLeast(b.thresholds.triumph);
  const pS = atLeast(b.thresholds.success);
  const pC = atLeast(b.thresholds.costly);
  const pF = atLeast(b.thresholds.failure);
  return { triumph: pT, success: pS - pT, costly: pC - pS, failure: pF - pC, disaster: 1 - pF };
}

export function tierOf(v: number, b: ChapterBalance['tier']): Tier {
  const th = b.thresholds;
  if (v >= th.triumph) return 'triumph';
  if (v >= th.success) return 'success';
  if (v >= th.costly) return 'costly';
  if (v >= th.failure) return 'failure';
  return 'disaster';
}

export function rollTier(rng: RngState, m: number, b: ChapterBalance['tier']): Tier {
  const r = (nextFloat(rng) + nextFloat(rng) - 1) * b.spread;
  return tierOf(m + r, b);
}

/** 대가 있는 성공 이상이 나올 확률 */
export function successChance(m: number, b: ChapterBalance['tier']): number {
  const p = tierProbabilities(m, b);
  return p.triumph + p.success + p.costly;
}

/** 아직 밝혀지지 않은 숨은 변수가 있는가 */
export function hasUnknown(def: ChapterDefinition, state: GameState, a: ActivityDef, actors: Actors): boolean {
  return (a.hidden ?? []).some((h) => !isRevealed(def, state, h.id) && !allTrue(def, state, h.knownWhen, actors));
}

/** 단서가 숨은 변수를 밝혔는가 */
export function isRevealed(def: ChapterDefinition, state: GameState, hiddenId: string): boolean {
  return state.clues.some((c) => def.clues.find((d) => d.id === c.id)?.reveals?.includes(hiddenId));
}

export function hintFor(def: ChapterDefinition, state: GameState, a: ActivityDef, ctx: ActCtx): Hint {
  if (hasUnknown(def, state, a, ctx.actors)) return 'unknown';
  const p = successChance(margin(def, state, a, ctx), def.balance.tier);
  if (p >= def.balance.hint.sure) return 'sure';
  if (p >= def.balance.hint.fair) return 'fair';
  return 'risky';
}

export const TIER_ORDER: readonly Tier[] = TIERS;
