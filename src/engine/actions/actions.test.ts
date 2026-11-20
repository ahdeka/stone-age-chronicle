import { describe, expect, it } from 'vitest';
import { ch1, newGame, run, tweakDef } from '../../test/fixtures';
import type { ActionCardDef, ChapterDefinition, GameState } from '../types';
import { cardStatus } from './actions';

const card = (id: string, patch: Partial<ActionCardDef> = {}): ActionCardDef => ({
  id,
  icon: 'craft',
  tags: [],
  cost: [{ type: 'resource', key: 'food', delta: -2 }],
  effects: [{ type: 'resource', key: 'tools', delta: 3 }],
  ...patch,
});

function deckOf(cards: ActionCardDef[], deck: string[]): ChapterDefinition {
  return tweakDef((d) => {
    d.content.actions = cards;
    d.startingDeck = deck;
  });
}

const play = (def: ChapterDefinition, s: GameState, cardId: string, personId?: string) => {
  const c = s.deck.hand.find((x) => x.cardId === cardId)!;
  return run(def, s, { type: 'playAction', cardUid: c.uid, personId });
};

describe('action cards', () => {
  it('행동 단계에 손패를 5장 채우고 행동 수는 2', () => {
    const s = newGame();
    expect(s.deck.hand).toHaveLength(5);
    expect(s.deck.draw.length + s.deck.hand.length).toBe(ch1.startingDeck.length);
    expect(s.actions.playsLeft).toBe(2);
  });

  it('카드를 쓰면 비용을 내고 효과를 얻고, 버림 더미로 간다', () => {
    const def = deckOf([card('make')], ['make', 'make', 'make', 'make', 'make', 'make']);
    let s = newGame('a1', def);
    s = play(def, s, 'make');
    expect(s.tribe.resources['food']).toBe(28);
    expect(s.tribe.resources['tools']).toBe(11);
    expect(s.actions.playsLeft).toBe(1);
    expect(s.deck.hand).toHaveLength(4);
    expect(s.deck.discard).toHaveLength(1);
  });

  it('행동 수를 다 쓰면 더 쓸 수 없다', () => {
    const def = deckOf([card('make')], Array(6).fill('make'));
    let s = newGame('a2', def);
    s = play(def, s, 'make');
    s = play(def, s, 'make');
    expect(() => play(def, s, 'make')).toThrow(/noPlays/);
  });

  it('비용을 낼 수 없으면 쓸 수 없다', () => {
    const def = deckOf([card('pricey', { cost: [{ type: 'resource', key: 'food', delta: -999 }] })], Array(5).fill('pricey'));
    const s = newGame('a3', def);
    expect(cardStatus(def, s, s.deck.hand[0]!).reason).toBe('error.action.cannotAfford');
  });

  it('조건이 맞지 않으면 잠기고 실패 조건을 알려 준다', () => {
    const cond = { type: 'person' as const, match: { office: 'shaman' } };
    const def = deckOf([card('rite', { requires: [cond] })], Array(5).fill('rite'));
    const st = cardStatus(def, newGame('a4', def), newGame('a4', def).deck.hand[0]!);
    expect(st.reason).toBe('error.action.locked');
    expect(st.failed).toEqual([cond]);
  });

  it('배정한 인물은 assignee 슬롯으로 효과에 쓰이고, 같은 계절에 두 번 맡길 수 없다', () => {
    const c = card('craft', {
      assign: { required: false, match: { stage: ['youth', 'adult', 'elder'] } },
      effects: [
        { type: 'resource', key: 'tools', delta: 1 },
        { type: 'if', when: [{ type: 'actor', slot: 'assignee', match: { trait: 'crafty' } }], then: [{ type: 'resource', key: 'tools', delta: 10 }] },
      ],
    });
    const def = deckOf([c], Array(6).fill('craft'));
    let s = newGame('a5', def);
    s = play(def, s, 'craft', 'p_ikki'); // 손재주
    expect(s.tribe.resources['tools']).toBe(8 + 11);
    expect(s.actions.busy).toEqual(['p_ikki']);
    expect(() => play(def, s, 'craft', 'p_ikki')).toThrow(/badAssignee/);
  });

  it('배정이 필수인데 사람을 고르지 않으면 거부', () => {
    const def = deckOf([card('lead', { assign: { required: true } })], Array(5).fill('lead'));
    const s = newGame('a6', def);
    expect(() => play(def, s, 'lead')).toThrow(/needsAssignee/);
  });

  it('턴이 끝나면 남은 손패를 버리고, 뽑을 더미가 비면 버림 더미를 섞어 다시 뽑는다', () => {
    const def = deckOf([card('a'), card('b')], ['a', 'a', 'a', 'b', 'b', 'b', 'b']);
    let s = newGame('a7', def);
    expect(s.deck.draw).toHaveLength(2);
    s = run(def, s, { type: 'endActionPhase' });
    expect(s.deck.hand).toHaveLength(5);
    expect(s.deck.draw.length + s.deck.hand.length + s.deck.discard.length).toBe(7);
  });

  it('exhaust 카드는 쓰면 덱에서 사라진다', () => {
    const def = deckOf([card('once', { exhaust: true }), card('x')], ['once', 'x', 'x', 'x', 'x']);
    let s = newGame('a8', def);
    s = play(def, s, 'once');
    const all = [...s.deck.draw, ...s.deck.hand, ...s.deck.discard].map((c) => c.cardId);
    expect(all).not.toContain('once');
  });
});
