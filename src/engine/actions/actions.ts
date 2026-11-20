// 행동 카드 사용 (DESIGN.md §7.5). 검증을 모두 끝낸 뒤에 상태를 바꾼다.

import type { ActionCardDef, CardInstance, ChapterDefinition, Condition, GameState, Id } from '../types';
import { evaluateAll, matchPerson } from '../conditions/evaluate';
import { applyEffects, type EffectCtx } from '../effects/apply';

export function findAction(def: ChapterDefinition, id: string): ActionCardDef | undefined {
  return def.content.actions.find((a) => a.id === id);
}

export interface CardStatus {
  card: CardInstance;
  def: ActionCardDef | undefined;
  available: boolean;
  /** 'error.action.*' 키 또는 null */
  reason: string | null;
  failed: Condition[];
}

/** 자원 비용을 낼 수 있는가 (음수 자원 효과만 본다) */
export function canAfford(def: ActionCardDef, state: GameState): boolean {
  for (const e of def.cost ?? []) {
    if (e.type === 'resource' && e.delta < 0 && (state.tribe.resources[e.key] ?? 0) < -e.delta) return false;
    if (e.type === 'population' && e.delta < 0 && state.tribe.population <= -e.delta) return false;
  }
  return true;
}

/** 이 인물을 이 카드에 배정할 수 있는가 */
export function canAssign(def: ActionCardDef, state: GameState, personId: Id): boolean {
  const p = state.people[personId];
  if (!def.assign || !p || !p.alive) return false;
  if (state.actions.busy.includes(personId)) return false;
  return def.assign.match ? matchPerson(p, def.assign.match) : true;
}

export function cardStatus(def: ChapterDefinition, state: GameState, card: CardInstance, personId?: Id): CardStatus {
  const a = findAction(def, card.cardId);
  const no = (reason: string, failed: Condition[] = []): CardStatus => ({ card, def: a, available: false, reason, failed });
  if (!a) return no('error.action.unknown');
  if (state.phase !== 'action') return no('error.wrongPhase');
  if (state.actions.playsLeft <= 0) return no('error.action.noPlays');
  if (personId !== undefined && !canAssign(a, state, personId)) return no('error.action.badAssignee');
  if (personId === undefined && a.assign?.required) return no('error.action.needsAssignee');
  const actors: Record<string, Id> = personId !== undefined ? { assignee: personId } : {};
  const r = evaluateAll(def, state, a.requires, actors);
  if (!r.ok) return no('error.action.locked', r.failed);
  if (!canAfford(a, state)) return no('error.action.cannotAfford');
  return { card, def: a, available: true, reason: null, failed: [] };
}

export function playAction(def: ChapterDefinition, state: GameState, cardUid: string, personId?: Id): string | undefined {
  const card = state.deck.hand.find((c) => c.uid === cardUid);
  if (!card) return 'error.action.notInHand';
  const st = cardStatus(def, state, card, personId);
  if (!st.available || !st.def) return st.reason ?? 'error.action.locked';
  const a = st.def;

  const ctx: EffectCtx = {
    def,
    state,
    source: `action.${a.id}`,
    actors: personId !== undefined ? { assignee: personId } : {},
  };
  state.turnLog.push({ kind: 'action', cardId: a.id, personId: personId ?? null, source: ctx.source });
  applyEffects(ctx, a.cost ?? []);
  applyEffects(ctx, a.effects);
  if (a.chronicle) applyEffects(ctx, [{ type: 'chronicle', key: `action.${a.id}.chron`, importance: a.chronicle.importance }]);

  state.deck.hand = state.deck.hand.filter((c) => c.uid !== cardUid);
  if (!a.exhaust) state.deck.discard.push(card);
  state.actions.playsLeft -= 1;
  if (personId !== undefined) state.actions.busy.push(personId);
  return undefined;
}
