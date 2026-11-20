import { describe, expect, it } from 'vitest';
import { ch1, newGame, tweakDef } from '../../test/fixtures';
import { seedToState } from '../rng/rng';
import { TIERS, type ActivityDef, type Tier } from '../types';
import { hintFor, rollTier, successChance, tierProbabilities, triCdf } from './tier';

const B = ch1.balance.tier;

describe('결과 등급', () => {
  it('삼각 분포 누적 함수: 양 끝 0과 1, 가운데 0.5', () => {
    expect(triCdf(-B.spread, B.spread)).toBe(0);
    expect(triCdf(0, B.spread)).toBeCloseTo(0.5);
    expect(triCdf(B.spread, B.spread)).toBe(1);
  });

  it('등급 확률은 합이 1이고, 여유가 클수록 좋은 등급이 늘어난다', () => {
    let prev = -1;
    for (const m of [-4, -2, 0, 2, 4]) {
      const p = tierProbabilities(m, B);
      expect(TIERS.reduce((a, t) => a + p[t], 0)).toBeCloseTo(1, 9);
      for (const t of TIERS) expect(p[t]).toBeGreaterThanOrEqual(-1e-12);
      const good = successChance(m, B);
      expect(good).toBeGreaterThanOrEqual(prev);
      prev = good;
    }
  });

  it('닫힌 식의 확률이 실제 굴림 분포와 맞는다', () => {
    const rng = seedToState('tier');
    const m = 0.3;
    const n = 100_000;
    const counts: Record<Tier, number> = { triumph: 0, success: 0, costly: 0, failure: 0, disaster: 0 };
    for (let i = 0; i < n; i++) counts[rollTier(rng, m, B)]++;
    const p = tierProbabilities(m, B);
    for (const t of TIERS) expect(counts[t] / n).toBeCloseTo(p[t], 2);
  });

  it('숨은 변수가 있으면 "결과를 알 수 없다", 단서가 밝히면 세 단계 중 하나로 바뀐다', () => {
    const def = tweakDef((d) => {
      d.clues.push({ id: 'test_clue', reveals: ['bear_depth'] });
    });
    const act: ActivityDef = {
      power: [{ src: 'const', value: 5 }],
      difficulty: 0,
      hidden: [{ id: 'bear_depth', knownWhen: [{ type: 'flag', id: 'scouted' }] }],
      outcomes: Object.fromEntries(TIERS.map((t) => [t, { effects: [] }])) as unknown as ActivityDef['outcomes'],
    };
    const s = newGame('hint', def);
    const ctx = { crew: [], actors: {} };
    expect(hintFor(def, s, act, ctx)).toBe('unknown');
    s.flags['scouted'] = 1;
    expect(hintFor(def, s, act, ctx)).toBe('sure');
    delete s.flags['scouted'];
    s.clues.push({ id: 'test_clue' });
    expect(hintFor(def, s, act, ctx)).toBe('sure');
  });

  it('단서 단계의 경계는 balance를 따른다', () => {
    const def = ch1;
    const s = newGame();
    const mk = (power: number): ActivityDef => ({
      power: [{ src: 'const', value: power }],
      difficulty: 0,
      outcomes: Object.fromEntries(TIERS.map((t) => [t, { effects: [] }])) as unknown as ActivityDef['outcomes'],
    });
    const ctx = { crew: [], actors: {} };
    for (const m of [-3, -1.5, -0.5, 0, 1, 3]) {
      const p = successChance(m, B);
      const expected = p >= def.balance.hint.sure ? 'sure' : p >= def.balance.hint.fair ? 'fair' : 'risky';
      expect(hintFor(def, s, mk(m), ctx)).toBe(expected);
    }
  });
});
