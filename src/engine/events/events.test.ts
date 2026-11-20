import { describe, expect, it } from 'vitest';
import { newGame, run, tweakDef } from '../../test/fixtures';
import type { ChapterDefinition, EventDef, GameState } from '../types';
import { optionStatuses } from './events';

function ev(id: string, patch: Partial<EventDef> = {}): EventDef {
  return {
    id,
    tags: [id],
    trigger: {},
    mode: 'pool',
    weight: 1,
    cooldown: 0,
    once: false,
    options: [
      { id: 'a', effects: [{ type: 'resource', key: 'food', delta: -1 }] },
      { id: 'b', effects: [{ type: 'resource', key: 'tools', delta: -1 }] },
    ],
    ...patch,
  };
}

const withEvents = (events: EventDef[], patch?: (d: ChapterDefinition) => void) =>
  tweakDef((d) => {
    d.content.events = events;
    d.balance.events.secondEventChance = 0;
    patch?.(d);
  });

const choose = (def: ChapterDefinition, s: GameState, optionId = 'a') =>
  run(def, s, { type: 'chooseOption', eventUid: s.events.pending[0]!.uid, optionId });

/** 턴마다 "시작 직후"의 이벤트 목록을 기록한다 (기록한 뒤에 해결하고 턴을 넘긴다) */
function pendingByTurn(def: ChapterDefinition, start: GameState, turns: number): string[][] {
  let s = start;
  const out: string[][] = [];
  for (let i = 0; i < turns; i++) {
    out.push(s.events.pending.map((p) => p.eventId));
    while (s.phase === 'event') s = choose(def, s);
    s = run(def, s, { type: 'endActionPhase' });
  }
  return out;
}

describe('event engine', () => {
  it('조건을 만족하는 풀 이벤트가 있으면 이벤트 단계로 시작하고, 고르면 행동 단계로 간다', () => {
    const def = withEvents([ev('x')]);
    let s = newGame('e1', def);
    expect(s.phase).toBe('event');
    expect(s.events.pending.map((p) => p.eventId)).toEqual(['x']);
    expect(s.deck.hand).toHaveLength(0); // 손패는 이벤트 뒤에 채운다
    s = choose(def, s);
    expect(s.phase).toBe('action');
    expect(s.deck.hand).toHaveLength(5);
    expect(s.tribe.resources['food']).toBe(29);
  });

  it('계절·턴·조건이 맞지 않으면 나오지 않는다', () => {
    const def = withEvents([
      ev('winter_only', { trigger: { seasons: ['winter'] } }),
      ev('late', { trigger: { minTurn: 10 } }),
      ev('flagged', { trigger: { conditions: [{ type: 'flag', id: 'nope' }] } }),
    ]);
    expect(newGame('e2', def).phase).toBe('action');
  });

  it('once는 한 번만, cooldown은 지정한 턴 동안 다시 나오지 않는다', () => {
    const def = withEvents([ev('once', { once: true, weight: 1000 }), ev('cool', { cooldown: 3 })], (d) => {
      d.balance.events.tagStreakMax = 99;
    });
    const seen = pendingByTurn(def, newGame('e3', def), 10);
    expect(seen[0]).toEqual(['once']); // 가중치가 압도적이라 첫 턴에 나온다
    expect(seen.flat().filter((x) => x === 'once')).toHaveLength(1);
    const coolTurns = seen.flatMap((ids, i) => (ids.includes('cool') ? [i + 1] : []));
    expect(coolTurns.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < coolTurns.length; i++) expect(coolTurns[i]! - coolTurns[i - 1]!).toBeGreaterThanOrEqual(3);
  });

  it('후속 이벤트는 정확히 delay 턴 뒤에 나오고 풀에서는 뽑히지 않는다', () => {
    const def = withEvents(
      [
        ev('start', { once: true, options: [{ id: 'a', effects: [], followUps: [{ eventId: 'later', delay: 3 }], freeOk: 't' }, { id: 'b', effects: [] }] }),
        ev('later', { mode: 'followUp', weight: 100 }),
      ],
    );
    let s = choose(def, newGame('e4', def));
    const firedAt: number[] = [];
    for (let i = 0; i < 6; i++) {
      s = run(def, s, { type: 'endActionPhase' });
      if (s.events.pending.some((p) => p.eventId === 'later')) firedAt.push(s.turn);
      while (s.phase === 'event') s = choose(def, s);
    }
    expect(firedAt).toEqual([4]);
  });

  it('한 턴 최대 개수를 넘는 후속 이벤트는 다음 턴으로 미뤄진다 (ignoreCap은 예외)', () => {
    const def = withEvents([ev('f1', { mode: 'followUp' }), ev('f2', { mode: 'followUp' }), ev('f3', { mode: 'followUp' }), ev('urgent', { mode: 'followUp', ignoreCap: true })], (d) => {
      d.balance.events.maxPerTurn = 2;
    });
    let s = newGame('e5', def);
    s.events.scheduled = ['f1', 'f2', 'f3', 'urgent'].map((eventId, seq) => ({ eventId, dueTurn: 2, chance: 1, seq: 100 + seq }));
    s = run(def, s, { type: 'endActionPhase' });
    expect(s.events.pending.map((p) => p.eventId)).toEqual(['f1', 'f2', 'urgent']);
    expect(s.events.scheduled.map((x) => x.eventId)).toEqual(['f3']);
    while (s.phase === 'event') s = choose(def, s);
    s = run(def, s, { type: 'endActionPhase' });
    expect(s.events.pending.map((p) => p.eventId)).toEqual(['f3']);
  });

  it('강제 이벤트는 가중치와 상관없이 조건이 맞으면 나온다', () => {
    const def = withEvents([ev('pool', { weight: 1000 }), ev('crisis', { mode: 'forced', priority: 10 })], (d) => {
      d.balance.events.maxPerTurn = 1;
    });
    const s = newGame('e6', def);
    expect(s.events.pending.map((p) => p.eventId)).toEqual(['crisis']);
  });

  it('같은 태그는 연속 tagStreakMax 턴까지만 나온다', () => {
    const def = withEvents([ev('a1', { tags: ['same'] }), ev('a2', { tags: ['same'] })]);
    const turns = pendingByTurn(def, newGame('e7', def), 6).map((ids) => ids.length > 0);
    // 2턴 연속 나온 뒤에는 한 턴 쉰다
    expect(turns).toEqual([true, true, false, true, true, false]);
  });

  it('필수 인물 슬롯을 채울 수 없으면 나오지 않고, 채우면 바인딩된다', () => {
    const def = withEvents([
      ev('need_shaman', { actors: [{ slot: 's', match: { office: 'shaman' } }] }),
      ev('need_herbalist', { actors: [{ slot: 'h', match: { trait: 'herbalist' } }] }),
    ]);
    const s = newGame('e8', def);
    expect(s.events.pending.map((p) => p.eventId)).toEqual(['need_herbalist']);
    expect(s.events.pending[0]!.actors).toEqual({ h: 'p_noeul' });
  });

  it('본문 변형은 처음 맞는 것을 고른다', () => {
    const def = withEvents([
      ev('v', {
        actors: [{ slot: 'x', match: { office: 'shaman' }, optional: true }],
        textVariants: [
          { id: 'with_shaman', when: [{ type: 'actor', slot: 'x' }] },
          { id: 'spring', when: [{ type: 'season', in: ['spring'] }] },
        ],
      }),
    ]);
    expect(newGame('e9', def).events.pending[0]!.variant).toBe('spring');
  });

  it('잠긴 선택지는 고를 수 없고 실패 조건을 알려 준다, hiddenUnless는 숨긴다', () => {
    const lockedCond = { type: 'resource' as const, key: 'food', min: 999 };
    const def = withEvents([
      ev('locks', {
        options: [
          { id: 'a', effects: [{ type: 'resource', key: 'food', delta: -1 }] },
          { id: 'locked', requires: [lockedCond], effects: [{ type: 'resource', key: 'food', delta: -1 }] },
          { id: 'hidden', hiddenUnless: [lockedCond], effects: [{ type: 'resource', key: 'food', delta: -2 }] },
        ],
      }),
    ]);
    const s = newGame('e10', def);
    const st = optionStatuses(def, s, s.events.pending[0]!);
    expect(st.map((x) => [x.option.id, x.visible, x.available])).toEqual([
      ['a', true, true],
      ['locked', true, false],
      ['hidden', false, false],
    ]);
    expect(st[1]!.failed).toEqual([lockedCond]);
    const r = run.bind(null, def, s);
    expect(() => r({ type: 'chooseOption', eventUid: s.events.pending[0]!.uid, optionId: 'locked' })).toThrow(/optionLocked/);
  });

  it('이벤트 단계에서는 턴을 끝낼 수 없고, 순서가 아닌 이벤트에는 답할 수 없다', () => {
    const def = withEvents([ev('x')]);
    const s = newGame('e11', def);
    expect(() => run(def, s, { type: 'endActionPhase' })).toThrow(/wrongPhase/);
    expect(() => run(def, s, { type: 'chooseOption', eventUid: 'nope', optionId: 'a' })).toThrow(/notCurrent/);
  });

  it('선택지의 setFlags / clearFlags / 연대기 후보가 적용된다', () => {
    const def = withEvents([
      ev('fl', {
        options: [
          { id: 'a', effects: [{ type: 'resource', key: 'food', delta: -1 }], setFlags: ['x'], clearFlags: ['y'], chronicle: { importance: 5 } },
          { id: 'b', effects: [] },
        ],
      }),
    ]);
    let s = newGame('e12', def);
    s.flags['y'] = 0;
    s = choose(def, s);
    expect(s.flags['x']).toBe(1);
    expect(s.flags['y']).toBeUndefined();
    s = run(def, s, { type: 'endActionPhase' });
    expect(s.chronicle.at(-1)).toMatchObject({ turn: 1, key: 'event.fl.opt.a.chron', reign: 1, season: 'spring', seasonIndex: 1 });
  });

  it('디버그 forceEvent는 조건을 무시하고 띄운다', () => {
    const def = withEvents([ev('late', { trigger: { minTurn: 40 } })]);
    let s = newGame('e13', def);
    expect(s.phase).toBe('action');
    s = run(def, s, { type: 'debug', debug: { op: 'forceEvent', eventId: 'late' } });
    expect(s.phase).toBe('event');
    expect(s.events.pending[0]!.eventId).toBe('late');
  });
});
