import { describe, expect, it } from 'vitest';
import { ch1, newGame, tweakDef } from '../../test/fixtures';
import { getStat, stat } from './stats';

describe('stats', () => {
  it('기본값 → add 합 → mul 곱 순서로 계산한다', () => {
    const def = tweakDef((d) => {
      d.balance.globalModifiers.push(
        { stat: 'yield.craft', op: 'mul', value: 2 },
        { stat: 'yield.craft', op: 'add', value: 0.5 },
      );
    });
    const s = newGame('x', def);
    // (0.5 + 0.5) × 2
    expect(stat(def, s, 'yield.craft')).toBeCloseTo(2);
  });

  it('계절 모디파이어는 그 계절에만 켜진다', () => {
    const s = newGame();
    expect(s.season).toBe('spring');
    expect(stat(ch1, s, 'consume.food')).toBeCloseTo(1.0);
    const winter = structuredClone(s);
    winter.season = 'winter';
    expect(stat(ch1, winter, 'consume.food')).toBeCloseTo(1.3);
  });

  it('when 조건이 맞을 때만 적용한다 (결속에 따른 행동 수)', () => {
    const s = newGame();
    expect(stat(ch1, s, 'actions.perTurn')).toBe(2);
    const high = structuredClone(s);
    high.tribe.resources['cohesion'] = 70;
    expect(stat(ch1, high, 'actions.perTurn')).toBe(3);
    const low = structuredClone(s);
    low.tribe.resources['cohesion'] = 24.5;
    expect(stat(ch1, low, 'actions.perTurn')).toBe(1);
  });

  it('임시 모디파이어와 생활 방식이 반영되고 출처가 기록된다', () => {
    const s = newGame();
    s.modifiers.push({ mod: { stat: 'storage.food.perPop', op: 'add', value: 1 }, lastTurn: 9, sourceKey: 'test' });
    s.tribe.lifestyle = 'settled';
    const v = getStat(ch1, s, 'storage.food.perPop');
    expect(v.value).toBeCloseTo((4 + 1) * 2);
    expect(v.parts.map((p) => p.source)).toEqual(['base', 'lifestyle.settled', 'test']);
  });

  it('모르는 스탯 키는 오류', () => {
    expect(() => stat(ch1, newGame(), 'nope')).toThrow(/unknown stat/);
  });
});
