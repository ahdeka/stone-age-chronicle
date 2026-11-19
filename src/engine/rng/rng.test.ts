import { describe, expect, it } from 'vitest';
import { chance, cloneRng, nextFloat, nextInt, seedToState, shuffled, weightedIndex } from './rng';

const take = (seed: string, n: number) => {
  const s = seedToState(seed);
  return Array.from({ length: n }, () => nextFloat(s));
};

describe('rng', () => {
  it('같은 시드는 같은 수열을 만든다', () => {
    expect(take('maru', 50)).toEqual(take('maru', 50));
  });

  it('다른 시드는 다른 수열을 만든다', () => {
    expect(take('maru', 10)).not.toEqual(take('seori', 10));
  });

  it('상태를 JSON으로 저장했다 이어서 뽑아도 같다', () => {
    const a = seedToState('roundtrip');
    for (let i = 0; i < 7; i++) nextFloat(a);
    const b = JSON.parse(JSON.stringify(a)) as typeof a;
    const fromA = Array.from({ length: 20 }, () => nextFloat(a));
    const fromB = Array.from({ length: 20 }, () => nextFloat(b));
    expect(fromB).toEqual(fromA);
  });

  it('nextFloat는 [0,1) 범위이고 대략 고르다', () => {
    const xs = take('uniform', 20000);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });

  it('nextInt는 양끝을 포함한다', () => {
    const s = seedToState('int');
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(nextInt(s, 1, 4));
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  });

  it('weightedIndex는 가중치를 따르고 0 가중치는 뽑지 않는다', () => {
    const s = seedToState('weights');
    const counts = [0, 0, 0];
    for (let i = 0; i < 9000; i++) counts[weightedIndex(s, [1, 0, 2])]! += 1;
    expect(counts[1]).toBe(0);
    expect(counts[2]! / counts[0]!).toBeGreaterThan(1.8);
    expect(counts[2]! / counts[0]!).toBeLessThan(2.2);
    expect(weightedIndex(s, [0, 0])).toBe(-1);
  });

  it('chance의 경계값은 난수를 쓰지 않고 결정된다', () => {
    const s = seedToState('edge');
    const before = cloneRng(s);
    expect(chance(s, 0)).toBe(false);
    expect(chance(s, 1)).toBe(true);
    expect(s).toEqual(before);
  });

  it('shuffled는 원본을 바꾸지 않고 같은 원소를 돌려준다', () => {
    const s = seedToState('shuffle');
    const src = [1, 2, 3, 4, 5, 6];
    const out = shuffled(s, src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(src);
  });
});
