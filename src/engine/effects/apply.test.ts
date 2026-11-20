import { describe, expect, it } from 'vitest';
import { ch1, endTurns, newGame } from '../../test/fixtures';
import type { Effect, GameState } from '../types';
import { applyEffects, checkProbability } from './apply';

function apply(effects: Effect[], s: GameState = newGame()): GameState {
  applyEffects({ def: ch1, state: s, source: 'test' }, effects);
  return s;
}

describe('effects', () => {
  it('resource: 범위로 자르고 실제 적용량을 로그에 남긴다', () => {
    const s = apply([
      { type: 'resource', key: 'cohesion', delta: 100 },
      { type: 'resource', key: 'food', delta: -999 },
    ]);
    expect(s.tribe.resources['cohesion']).toBe(100);
    expect(s.tribe.resources['food']).toBe(0);
    expect(s.turnLog).toEqual([
      { kind: 'resource', key: 'cohesion', delta: 40, source: 'test' },
      { kind: 'resource', key: 'food', delta: -30, source: 'test' },
    ]);
  });

  it('axis: −100..100으로 자른다', () => {
    const s = apply([{ type: 'axis', axis: 'harmony_force', delta: -150 }]);
    expect(s.tribe.axes['harmony_force']).toBe(-100);
  });

  it('population: 역할 배분 합계를 유지하며 손실 순서대로 뺀다', () => {
    const s = apply([{ type: 'population', delta: -3 }]);
    expect(s.tribe.population).toBe(9);
    // 의례 1 → 제작 1 → 경계 1 순서로 빠진다
    expect(s.tribe.roles).toEqual({ gather: 5, hunt: 4, craft: 0, ritual: 0, guard: 0 });
    const s2 = apply([{ type: 'population', delta: 2 }]);
    expect(s2.tribe.roles['gather']).toBe(7);
  });

  it('flag / counter', () => {
    const s = apply([
      { type: 'flag', id: 'a', set: true },
      { type: 'counter', id: 'great_tales', delta: 1 },
      { type: 'counter', id: 'great_tales', delta: 1 },
    ]);
    expect(s.flags['a']).toBe(1);
    expect(s.counters['great_tales']).toBe(2);
    apply([{ type: 'flag', id: 'a', set: false }], s);
    expect(s.flags['a']).toBeUndefined();
  });

  it('modifier: 지정한 턴 수만큼 유지되고 만료된다', () => {
    let s = apply([{ type: 'modifier', mod: { stat: 'yield.craft', op: 'add', value: 1 }, duration: 2 }]);
    expect(s.modifiers).toHaveLength(1);
    s = endTurns(ch1, s, 1); // 2턴째: 아직 유효
    expect(s.modifiers).toHaveLength(1);
    s = endTurns(ch1, s, 1); // 3턴째: 만료
    expect(s.modifiers).toHaveLength(0);
  });

  it('delayed: 1턴에 지연 2로 등록하면 3턴 결산에서 발동한다', () => {
    let s = apply([{ type: 'delayed', delay: 2, effects: [{ type: 'flag', id: 'returned', set: true }] }]);
    s = endTurns(ch1, s, 2); // 1, 2턴 결산
    expect(s.flags['returned']).toBeUndefined();
    s = endTurns(ch1, s, 1); // 3턴 결산
    expect(s.flags['returned']).toBe(3);
    expect(s.delayed).toHaveLength(0);
  });

  it('schedule: 예약 목록에 들어간다', () => {
    const s = apply([{ type: 'schedule', eventId: 'red_ford_repays', delay: 6, chance: 0.5 }]);
    expect(s.events.scheduled).toEqual([{ eventId: 'red_ford_repays', dueTurn: 7, chance: 0.5, seq: expect.any(Number) }]);
  });

  it('random: 같은 시드면 같은 결과', () => {
    const eff: Effect[] = [
      {
        type: 'random',
        outcomes: [
          { weight: 1, effects: [{ type: 'flag', id: 'a', set: true }] },
          { weight: 1, effects: [{ type: 'flag', id: 'b', set: true }] },
        ],
      },
    ];
    const results = new Set<string>();
    for (const seed of ['1', '2', '3', '4', '5', '6', '7', '8']) {
      const x = apply(eff, newGame(seed));
      const y = apply(eff, newGame(seed));
      expect(Object.keys(x.flags)).toEqual(Object.keys(y.flags));
      results.add(Object.keys(x.flags).join());
    }
    expect(results.size).toBe(2); // 두 결과가 모두 나온다
  });

  it('check: 힘이 난이도보다 클수록 성공 확률이 높고, 로그에 확률을 남긴다', () => {
    const s = newGame();
    const ctx = { def: ch1, state: s, source: 'test' };
    const strong = checkProbability(ctx, [{ source: 'role', id: 'hunt', weight: 3 }], 0);
    const weak = checkProbability(ctx, [{ source: 'const', value: 0 }], 12);
    expect(strong).toBeGreaterThan(0.9);
    expect(weak).toBeLessThan(0.1);
    apply([{ type: 'check', power: [{ source: 'const', value: 0 }], difficulty: 0, success: [], failure: [] }], s);
    const roll = s.turnLog.find((l) => l.kind === 'roll');
    expect(roll).toMatchObject({ kind: 'roll', p: 0.5 });
  });

  it('if: 조건에 따라 분기한다', () => {
    const s = apply([
      {
        type: 'if',
        when: [{ type: 'season', in: ['winter'] }],
        then: [{ type: 'flag', id: 'winter', set: true }],
        else: [{ type: 'flag', id: 'notWinter', set: true }],
      },
    ]);
    expect(Object.keys(s.flags)).toEqual(['notWinter']);
  });

  it('chronicle: 연대기 후보 로그를 남기고, 족장 이름을 그 시점 값으로 굳힌다', () => {
    const s = apply([{ type: 'chronicle', key: 'chron.test', importance: 3 }]);
    expect(s.turnLog).toContainEqual({
      kind: 'chronicle',
      key: 'chron.test',
      importance: 3,
      source: 'test',
      params: expect.objectContaining({ chief: { key: 'person.ch1.maru' }, reign: 1 }),
    });
  });

  it('person: 바인딩된 인물의 관계와 특성을 바꾼다 (범위 −100..100)', () => {
    const s = newGame();
    applyEffects({ def: ch1, state: s, source: 'test', actors: { a: 'p_bawi' } }, [
      { type: 'person', ref: { actor: 'a' }, change: { relation: -500, addTrait: 'restless' } },
      { type: 'person', ref: { actor: 'missing' }, change: { relation: 10 } },
    ]);
    expect(s.people['p_bawi']!.relation).toBe(-100);
    expect(s.people['p_bawi']!.traits).toContain('restless');
  });

  it('addCard / removeCard: 덱에 카드를 넣고 뺀다', () => {
    const s = newGame();
    const total = () => s.deck.draw.length + s.deck.hand.length + s.deck.discard.length;
    const before = total();
    apply([{ type: 'addCard', id: 'share_feast', count: 2 }], s);
    expect(total()).toBe(before + 2);
    apply([{ type: 'removeCard', id: 'share_feast' }], s);
    expect(total()).toBe(before + 1);
  });
});
