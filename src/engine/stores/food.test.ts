import { describe, expect, it } from 'vitest';
import { ch1 } from '../../test/fixtures';
import { addLot, carryWeight, eat, spoil, totalKg } from './food';

describe('식량 묶음', () => {
  it('같은 종류는 합친다', () => {
    const lots = [{ kind: 'raw_meat', kg: 10 }];
    addLot(lots, 'raw_meat', 5);
    addLot(lots, 'roots', 3);
    expect(lots).toEqual([
      { kind: 'raw_meat', kg: 15 },
      { kind: 'roots', kg: 3 },
    ]);
  });

  it('상하기 쉬운 것부터 먹는다', () => {
    const lots = [
      { kind: 'dried_meat', kg: 50 },
      { kind: 'raw_meat', kg: 30 },
    ];
    const eaten = eat(ch1, lots, 40, 'cold');
    expect(eaten).toBe(40);
    expect(lots).toEqual([{ kind: 'dried_meat', kg: 40 }]);
  });

  it('모자라면 있는 만큼만 먹는다', () => {
    const lots = [{ kind: 'roots', kg: 12 }];
    expect(eat(ch1, lots, 40, 'cold')).toBe(12);
    expect(lots).toEqual([]);
  });

  it('부패는 종류와 온도를 따른다: 날고기는 여름에 빨리, 말린 고기는 느리게', () => {
    const raw = ch1.foodKinds.find((f) => f.id === 'raw_meat')!;
    const dried = ch1.foodKinds.find((f) => f.id === 'dried_meat')!;
    const lots = [
      { kind: 'raw_meat', kg: 100 },
      { kind: 'dried_meat', kg: 100 },
    ];
    const lost = spoil(ch1, lots, 'warm');
    expect(lost).toBeCloseTo(100 * raw.spoil.warm + 100 * dried.spoil.warm);
    expect(raw.spoil.warm).toBeGreaterThan(raw.spoil.frozen * 10);
    expect(totalKg(lots)).toBeCloseTo(200 - lost);
  });

  it('말린 고기는 같은 양이라도 가볍다', () => {
    expect(carryWeight(ch1, { kind: 'dried_meat', kg: 100 })).toBeLessThan(carryWeight(ch1, { kind: 'raw_meat', kg: 100 }));
  });
});
