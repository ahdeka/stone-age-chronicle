import { describe, expect, it } from 'vitest';
import { ch1, newGame } from '../../test/fixtures';
import type { Condition } from '../types';
import { evaluate, evaluateAll } from './evaluate';

const s = newGame();
const ev = (c: Condition) => evaluate(ch1, s, c);

describe('condition evaluator', () => {
  it('resource / population / role / axis 범위', () => {
    expect(ev({ type: 'resource', key: 'food', min: 30, max: 30 })).toBe(true);
    expect(ev({ type: 'resource', key: 'food', min: 31 })).toBe(false);
    expect(ev({ type: 'resource', key: 'nope', max: 0 })).toBe(true); // 없는 자원은 0
    expect(ev({ type: 'population', min: 12 })).toBe(true);
    expect(ev({ type: 'role', role: 'hunt', min: 4, max: 4 })).toBe(true);
    expect(ev({ type: 'axis', axis: 'share_hierarchy', min: 1 })).toBe(false);
  });

  it('season / turn / reign / era / lifestyle', () => {
    expect(ev({ type: 'season', in: ['spring'] })).toBe(true);
    expect(ev({ type: 'season', in: ['winter'] })).toBe(false);
    expect(ev({ type: 'turn', min: 1, max: 1 })).toBe(true);
    expect(ev({ type: 'reign', min: 1, max: 1 })).toBe(true);
    expect(ev({ type: 'era', is: 'paleolithic' })).toBe(true);
    expect(ev({ type: 'lifestyle', is: 'settled' })).toBe(false);
  });

  it('flag: 존재, 부재, 경과 턴', () => {
    const st = structuredClone(s);
    st.flags['met_red_ford'] = 1;
    st.turn = 5;
    expect(evaluate(ch1, st, { type: 'flag', id: 'met_red_ford' })).toBe(true);
    expect(evaluate(ch1, st, { type: 'flag', id: 'met_red_ford', present: false })).toBe(false);
    expect(evaluate(ch1, st, { type: 'flag', id: 'other', present: false })).toBe(true);
    expect(evaluate(ch1, st, { type: 'flag', id: 'met_red_ford', sinceTurns: { min: 4 } })).toBe(true);
    expect(evaluate(ch1, st, { type: 'flag', id: 'met_red_ford', sinceTurns: { min: 5 } })).toBe(false);
  });

  it('counter / knowledge / eventSeen / tradition', () => {
    const st = structuredClone(s);
    st.counters['great_tales'] = 2;
    st.knowledge.push('stone_knapping');
    st.events.history['hungry_neighbors'] = { count: 1, lastTurn: 1 };
    st.traditions['share'] = { id: 'fair_share', adoptedTurn: 1 };
    expect(evaluate(ch1, st, { type: 'counter', id: 'great_tales', min: 2 })).toBe(true);
    expect(evaluate(ch1, st, { type: 'knowledge', id: 'stone_knapping' })).toBe(true);
    expect(evaluate(ch1, st, { type: 'knowledge', id: 'pottery', has: false })).toBe(true);
    expect(evaluate(ch1, st, { type: 'eventSeen', id: 'hungry_neighbors' })).toBe(true);
    expect(evaluate(ch1, st, { type: 'tradition', id: 'fair_share' })).toBe(true);
  });

  it('region / regionDiscovered', () => {
    expect(ev({ type: 'region', current: 'grey_wolf_hill', special: 'cave', depth: { max: 0 } })).toBe(true);
    expect(ev({ type: 'region', tag: 'river' })).toBe(false);
    expect(ev({ type: 'regionDiscovered', id: 'grey_wolf_hill' })).toBe(true);
  });

  it('person / chief 질의', () => {
    expect(ev({ type: 'person', match: { trait: 'herbalist' } })).toBe(true);
    expect(ev({ type: 'person', match: { stage: ['youth'] }, count: { min: 2, max: 2 } })).toBe(true);
    expect(ev({ type: 'person', match: { office: 'shaman' } })).toBe(false);
    expect(ev({ type: 'chief', match: { trait: 'cautious', stage: ['adult'] } })).toBe(true);
    const st = structuredClone(s);
    st.people['p_maru']!.alive = false;
    expect(evaluate(ch1, st, { type: 'chief', match: {} })).toBe(false);
    expect(evaluate(ch1, st, { type: 'person', match: { office: 'chief', alive: false } })).toBe(true);
  });

  it('all / any / not', () => {
    const yes: Condition = { type: 'population', min: 1 };
    const no: Condition = { type: 'population', max: 0 };
    expect(ev({ type: 'all', of: [yes, yes] })).toBe(true);
    expect(ev({ type: 'all', of: [yes, no] })).toBe(false);
    expect(ev({ type: 'any', of: [no, yes] })).toBe(true);
    expect(ev({ type: 'not', of: no })).toBe(true);
  });

  it('evaluateAll은 실패한 조건만 모아 돌려준다 (잠금 힌트용)', () => {
    const fail: Condition = { type: 'knowledge', id: 'herb_lore' };
    const r = evaluateAll(ch1, s, [{ type: 'population', min: 1 }, fail]);
    expect(r.ok).toBe(false);
    expect(r.failed).toEqual([fail]);
    expect(evaluateAll(ch1, s, undefined).ok).toBe(true);
  });
});
