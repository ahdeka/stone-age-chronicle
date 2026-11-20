// 행동 카드 덱: 뽑을 더미 → 손패 → 버림 더미. 뽑을 것이 없으면 버림 더미를 섞어 다시 쓴다.

import type { ChapterDefinition, CardInstance, GameState } from '../types';
import { shuffled } from '../rng/rng';
import { stat } from '../stats/stats';

export function newCard(state: GameState, cardId: string): CardInstance {
  return { uid: `c${state.seq++}`, cardId };
}

export function buildStartingDeck(def: ChapterDefinition, state: GameState): void {
  const cards = def.startingDeck.map((id) => newCard(state, id));
  state.deck = { draw: shuffled(state.rng, cards), hand: [], discard: [] };
}

/** C1. 손패를 handSize까지 채운다 */
export function drawHand(def: ChapterDefinition, state: GameState): void {
  const size = Math.max(0, Math.round(stat(def, state, def.balance.hand.sizeStat)));
  const d = state.deck;
  while (d.hand.length < size) {
    if (d.draw.length === 0) {
      if (d.discard.length === 0) break;
      d.draw = shuffled(state.rng, d.discard);
      d.discard = [];
    }
    const card = d.draw.shift();
    if (card) d.hand.push(card);
  }
}

/** D1. 남은 손패를 버린다 */
export function discardHand(state: GameState): void {
  state.deck.discard.push(...state.deck.hand);
  state.deck.hand = [];
}

/** 새 카드는 버림 더미로 들어가 다음 섞기 때 섞인다 */
export function addCardToDeck(state: GameState, cardId: string): void {
  state.deck.discard.push(newCard(state, cardId));
}

/** 한 장 제거: 뽑을 더미 → 버림 더미 → 손패 순으로 찾는다 */
export function removeCardFromDeck(state: GameState, cardId: string): boolean {
  for (const pile of ['draw', 'discard', 'hand'] as const) {
    const i = state.deck[pile].findIndex((c) => c.cardId === cardId);
    if (i >= 0) {
      state.deck[pile].splice(i, 1);
      return true;
    }
  }
  return false;
}
