import { describe, expect, it } from 'vitest';
import { ch1, newGame } from '../../test/fixtures';
import { dailyFoodTotal } from '../people/people';
import { totalKg } from '../stores/food';
import { evaluate, foodDays } from './evaluate';

describe('조건 평가', () => {
  it('며칠분 = 식량 / 하루 소비 (성인 30, 노인 25, 아이 18kg/달)', () => {
    const s = newGame();
    expect(dailyFoodTotal(ch1, s) * 30).toBeCloseTo(18 * 30 + 4 * 25 + 12 * 18);
    expect(foodDays(ch1, s)).toBeCloseTo(totalKg(s.stores.food) / dailyFoodTotal(ch1, s));
    expect(evaluate(ch1, s, { type: 'foodDays', min: 17, max: 19 })).toBe(true);
  });

  it('연령대와 조언자 자리로 사람을 찾는다', () => {
    const s = newGame();
    expect(evaluate(ch1, s, { type: 'population', band: 'child', min: 12, max: 12 })).toBe(true);
    expect(evaluate(ch1, s, { type: 'person', match: { seat: 'hunt_leader', band: ['adult'] } })).toBe(true);
    expect(evaluate(ch1, s, { type: 'person', match: { seat: 'hunt_leader', band: ['elder'] } })).toBe(false);
  });

  it('깃발의 세운 달을 묻는다 (이번 달에 세웠는가)', () => {
    const s = newGame();
    s.flags['x'] = s.month;
    expect(evaluate(ch1, s, { type: 'flag', id: 'x', sinceMonths: { max: 0 } })).toBe(true);
    s.month += 2;
    expect(evaluate(ch1, s, { type: 'flag', id: 'x', sinceMonths: { max: 0 } })).toBe(false);
    expect(evaluate(ch1, s, { type: 'flag', id: 'x' })).toBe(true);
  });

  it('은닉물: 한 달이 지나면 상태를 모른다', () => {
    const s = newGame();
    s.caches.push({ id: 'k1', place: 'reindeer_ford', lots: [{ kind: 'raw_meat', kg: 100 }], month: 1, scent: 0, checkedMonth: s.month });
    expect(evaluate(ch1, s, { type: 'cache', at: 'reindeer_ford', known: true })).toBe(true);
    s.month += ch1.balance.cache.staleAfterMonths;
    expect(evaluate(ch1, s, { type: 'cache', at: 'reindeer_ford', known: true })).toBe(false);
    expect(evaluate(ch1, s, { type: 'cache', at: 'reindeer_ford', known: false })).toBe(true);
    expect(evaluate(ch1, s, { type: 'cache', at: 'north_cave' })).toBe(false);
  });

  it('동물 상태와 논리 결합', () => {
    const s = newGame();
    const migrating = { type: 'animal' as const, id: 'reindeer', state: ['migrating'] };
    expect(evaluate(ch1, s, migrating)).toBe(true);
    expect(evaluate(ch1, s, { type: 'not', of: migrating })).toBe(false);
    expect(evaluate(ch1, s, { type: 'any', of: [{ type: 'not', of: migrating }, { type: 'season', in: ['autumn'] }] })).toBe(true);
    expect(evaluate(ch1, s, { type: 'all', of: [migrating, { type: 'monthOfYear', in: ['leaf'] }] })).toBe(true);
  });
});
