// 콘텐츠 작성용 짧은 헬퍼. 결과는 평범한 Effect/Condition 데이터다 (함수가 상태에 남지 않는다).

import type { Condition, Effect, ModifierDef, PersonQuery, PowerTerm } from '../../engine';

export const res = (key: string, delta: number): Effect => ({ type: 'resource', key, delta });
export const food = (d: number) => res('food', d);
export const tools = (d: number) => res('tools', d);
export const lore = (d: number) => res('lore', d);
export const cohesion = (d: number) => res('cohesion', d);
export const pop = (delta: number): Effect => ({ type: 'population', delta });

export const axis = (id: string, delta: number): Effect => ({ type: 'axis', axis: id, delta });
/** 음수 = 나눔, 양수 = 위계 */
export const shareHier = (d: number) => axis('share_hierarchy', d);
/** 음수 = 전통, 양수 = 새로움 */
export const tradNov = (d: number) => axis('tradition_novelty', d);
/** 음수 = 화합, 양수 = 무력 */
export const harmForce = (d: number) => axis('harmony_force', d);
/** 음수 = 유랑, 양수 = 정착 */
export const nomadSettle = (d: number) => axis('nomad_settle', d);

export const flag = (id: string, set = true): Effect => ({ type: 'flag', id, set });
export const counter = (id: string, delta = 1): Effect => ({ type: 'counter', id, delta });
export const mod = (stat: string, op: ModifierDef['op'], value: number, duration: number): Effect => ({
  type: 'modifier',
  mod: { stat, op, value },
  duration,
});
export const relActor = (slot: string, relation: number): Effect => ({ type: 'person', ref: { actor: slot }, change: { relation } });
export const traitActor = (slot: string, t: { add?: string; remove?: string }): Effect => ({
  type: 'person',
  ref: { actor: slot },
  change: { addTrait: t.add, removeTrait: t.remove },
});
export const schedule = (eventId: string, delay: number, chanceP?: number): Effect => ({ type: 'schedule', eventId, delay, chance: chanceP });
export const random = (...outcomes: [number, Effect[], string?][]): Effect => ({
  type: 'random',
  outcomes: outcomes.map(([weight, effects, labelKey]) => ({ weight, effects, labelKey })),
});
export const check = (power: PowerTerm[], difficulty: number, success: Effect[], failure: Effect[]): Effect => ({
  type: 'check',
  power,
  difficulty,
  success,
  failure,
});
export const when = (conds: Condition[], then: Effect[], otherwise?: Effect[]): Effect => ({ type: 'if', when: conds, then, else: otherwise });
export const chron = (key: string, importance: number): Effect => ({ type: 'chronicle', key, importance });

// 힘 항목
export const pRole = (id: string, weight: number): PowerTerm => ({ source: 'role', id, weight });
export const pRes = (id: string, weight: number): PowerTerm => ({ source: 'resource', id, weight });
export const pStat = (id: string, weight: number): PowerTerm => ({ source: 'stat', id, weight });
export const pActor = (slot: string, weight: number, q: { trait?: string; office?: string } = {}): PowerTerm => ({
  source: 'actor',
  slot,
  weight,
  ...q,
});
export const pConst = (value: number): PowerTerm => ({ source: 'const', value });

// 조건
export const hasFlag = (id: string): Condition => ({ type: 'flag', id });
export const noFlag = (id: string): Condition => ({ type: 'flag', id, present: false });
export const actorIs = (slot: string, match?: PersonQuery): Condition => ({ type: 'actor', slot, match });
export const someone = (match: PersonQuery): Condition => ({ type: 'person', match });
export const season = (...ids: string[]): Condition => ({ type: 'season', in: ids });
export const anyOf = (...of: Condition[]): Condition => ({ type: 'any', of });
export const not = (of: Condition): Condition => ({ type: 'not', of });

/** 행동에 배정할 수 있는 인물 (아이 제외) */
export const WORKING_AGE: PersonQuery = { stage: ['youth', 'adult', 'elder'] };
