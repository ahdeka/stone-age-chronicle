import { describe, expect, it } from 'vitest';
import { ch1, newGame, tweakDef } from '../../test/fixtures';
import { monthDef } from '../core/lookup';
import { firewoodPerDay, getStat, stat } from './stats';

describe('스탯', () => {
  it('기본값 → add 합 → mul 곱', () => {
    const def = tweakDef((d) => {
      d.globalMods.push({ stat: 'yield.wood', op: 'mul', value: 2 }, { stat: 'yield.wood', op: 'add', value: 0.5 });
    });
    expect(stat(def, newGame('x', def), 'yield.wood')).toBeCloseTo((ch1.balance.stats['yield.wood']! + 0.5) * 2);
  });

  it('날씨 모디파이어는 그 순에만 켜진다', () => {
    const s = newGame();
    s.work.weather = ['blizzard', 'clear', 'clear'];
    s.work.phasesDone = 0;
    const blizzard = getStat(ch1, s, 'firewood.burnMul');
    expect(blizzard.parts.map((p) => p.source)).toContain('weather.blizzard');
    s.work.phasesDone = 1;
    expect(stat(ch1, s, 'firewood.burnMul')).toBeLessThan(blizzard.value);
  });

  it('장작 소모 = 달 기준 × 거처 배율 (바위굴은 절반)', () => {
    const s = newGame();
    s.work.weather = ['clear', 'clear', 'clear'];
    const tent = firewoodPerDay(ch1, s);
    expect(tent).toBeCloseTo(monthDef(ch1, s).firewoodPerDay);
    s.shelter.kind = 'rock_cave';
    expect(firewoodPerDay(ch1, s)).toBeCloseTo(tent * 0.5);
  });

  it('지식은 조건부 모디파이어를 건다 (끌개는 겨울에만)', () => {
    const s = newGame();
    s.knowledge.has.push('sled');
    expect(stat(ch1, s, 'carry.perPerson')).toBeCloseTo(ch1.balance.stats['carry.perPerson']!);
    s.month += 1; // 서리달 (겨울)
    expect(stat(ch1, s, 'carry.perPerson')).toBeGreaterThan(ch1.balance.stats['carry.perPerson']!);
  });

  it('모르는 스탯 키는 오류', () => {
    expect(() => stat(ch1, newGame(), 'nope')).toThrow(/unknown stat/);
  });
});
