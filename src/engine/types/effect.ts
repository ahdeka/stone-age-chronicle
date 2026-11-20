// 효과 언어 (DESIGN.md §4.2)
// 상태가 이미 존재하는 체계의 효과만 둔다. 이웃/지식/지역 효과는 해당 마일스톤에서 추가한다.

import type { Id } from './common';
import type { Condition } from './condition';

export type StatKey = string;

export interface ModifierDef {
  stat: StatKey;
  op: 'add' | 'mul';
  value: number;
  when?: Condition[];
  /** UI 툴팁("왜 이 값인가")용 문자열 키 */
  sourceKey?: string;
}

/** check 효과의 힘 계산 항목 */
export type PowerTerm =
  | { source: 'role'; id: Id; weight: number }
  | { source: 'resource'; id: Id; weight: number }
  | { source: 'population'; weight: number }
  | { source: 'stat'; id: StatKey; weight: number }
  /** 바인딩된 인물이 조건을 만족하면 weight만큼 더한다 */
  | { source: 'actor'; slot: string; trait?: Id; office?: Id; weight: number }
  | { source: 'const'; value: number };

/** 효과가 가리키는 인물 */
export type PersonRef = 'chief' | { actor: string };

export interface PersonChange {
  relation?: number;
  addTrait?: Id;
  removeTrait?: Id;
}

export type Effect =
  | { type: 'resource'; key: Id; delta: number }
  | { type: 'population'; delta: number }
  | { type: 'axis'; axis: Id; delta: number }
  | { type: 'counter'; id: Id; delta: number }
  | { type: 'flag'; id: Id; set: boolean }
  | { type: 'modifier'; mod: ModifierDef; duration: number }
  | { type: 'person'; ref: PersonRef; change: PersonChange }
  | { type: 'addCard'; id: Id; count?: number }
  | { type: 'removeCard'; id: Id }
  | { type: 'schedule'; eventId: Id; delay: number; chance?: number }
  | { type: 'delayed'; delay: number; effects: Effect[] }
  | { type: 'random'; outcomes: { weight: number; effects: Effect[]; labelKey?: string }[] }
  | { type: 'check'; power: PowerTerm[]; difficulty: number; success: Effect[]; failure: Effect[] }
  | { type: 'if'; when: Condition[]; then: Effect[]; else?: Effect[] }
  | { type: 'chronicle'; key: string; importance: number };

export type EffectType = Effect['type'];
