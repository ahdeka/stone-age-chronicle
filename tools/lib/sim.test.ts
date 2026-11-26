// 시뮬레이터 (R1-c): 헤드리스로 1년차 + 2년(20턴)을 끝까지 돈다 (DESIGN.md §B7 R1 완료 조건)

import { describe, expect, it } from 'vitest';
import { ch1 } from '../../src/test/fixtures';
import { playGame, summarize, type StrategyName } from './sim';

describe('시뮬레이터 20턴', () => {
  for (const strategy of ['first', 'random', 'sure'] as StrategyName[]) {
    it(`${strategy}: 결말이 나지 않으면 20턴(1년차 12달 + 2년차·3년차 철 8개)까지 가고 해별 기록이 남는다`, () => {
      for (const seed of ['r1c-a', 'r1c-b']) {
        const r = playGame(ch1, seed, strategy, 20);
        if (r.ending === 'running') {
          expect(r.turns).toBe(20);
          // 12달 + 철 8개 = 36달
          expect(r.months).toBe(36);
          expect(Object.keys(r.years).map(Number)).toEqual([1, 2, 3]);
          expect(r.years[1]!.turns).toBe(12);
          expect(r.years[2]!.turns).toBe(4);
          expect(r.years[3]!.turns).toBe(4);
        } else expect(r.turns).toBeLessThanOrEqual(20);
        // 1년차 순은 36개 (달 12 × 순 3), 계절 턴 한 철은 순 9개
        const y1 = r.years[1]!.rationPhases.reduce((a, x) => a + x, 0);
        if (r.years[1]!.turns === 12) expect(y1).toBe(36);
        const y2 = r.years[2];
        if (y2 && y2.turns === 4) expect(y2.rationPhases.reduce((a, x) => a + x, 0)).toBe(36);
      }
    });
  }

  it('요약에 해별 지표와 신석기가 있다', () => {
    const recs = ['s-1', 's-2'].map((seed) => playGame(ch1, seed, 'first', 20));
    const sum = summarize(ch1, recs);
    expect(sum.years[1]).toBeDefined();
    expect(sum.years[1]!.reached).toBe(1);
    expect(sum.neolithic.rate).toBeGreaterThanOrEqual(0);
  });
});
