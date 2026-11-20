// 효과 언어 (DESIGN.md §5.2)

import type { Amount, Id } from './common';
import type { Condition, PersonQuery } from './condition';

export type StatKey = string;

export interface ModifierDef {
  stat: StatKey;
  op: 'add' | 'mul';
  value: number;
  when?: Condition[];
}

/** 효과가 가리키는 사람 */
export type WhoRef =
  | 'chief'
  | 'leader'
  | { actor: string }
  | { person: Id }
  /** 원정에 나간 사람 중에서: front = 맨 앞(숙련 높은 순), weakest = 숙련 낮은 순 */
  | { crew: 'front' | 'random' | 'weakest' }
  /** 부족 전체에서 조건에 맞는 사람 */
  | { anyone: PersonQuery; pick: 'random' | 'weakest' };

/** 문장 변수 값. '$'로 시작하는 문자열은 진행 맥락에서 채운다 ($leader, $crew, $caught, $carried ...) */
export type LineParam = string | number;

export type Effect =
  /** haul: 원정지의 짐으로 들어간다 (운반 한계를 거친다) */
  | { type: 'food'; kind: Id; kg: Amount; haul?: boolean }
  /** 짐승을 잡는다. 고기는 짐으로, 부산물은 마을로. $caught, $meat를 채운다 */
  | { type: 'catch'; animal: Id; count: Amount }
  | { type: 'firewood'; kg: Amount }
  | { type: 'goods'; id: Id; delta: Amount }
  | { type: 'cohesion'; delta: number }
  | { type: 'injure'; who: WhoRef; ailment: Id; severity?: 1 | 2 | 3 }
  | { type: 'death'; who: WhoRef; cause: Id }
  | { type: 'heal'; who: WhoRef }
  | { type: 'animal'; id: Id; state?: Id; at?: Id | null; known?: boolean; vars?: Record<string, number> }
  | { type: 'place'; id: Id; discovered?: boolean; addFact?: Id; stock?: { yield: Id; delta: number } }
  /** units: 채 수 (없으면 같은 종류는 그대로, 다른 종류는 1) */
  | { type: 'shelter'; kind: Id; place?: Id; units?: number }
  | { type: 'flag'; id: Id; set: boolean }
  | { type: 'counter'; id: Id; delta: number }
  | { type: 'knowledge'; id: Id; progress?: number; grant?: boolean }
  | { type: 'clue'; id: Id; months?: number; remove?: boolean }
  /** 은닉물: recover = 남은 것을 짐으로 꺼낸다 / check = 상태만 확인한다 */
  | { type: 'cache'; at: Id; action: 'recover' | 'check' }
  /** 기억: 몇 달 뒤 월초 사건으로 돌아온다. window 동안 조건이 맞는 첫 달에 발생 */
  | { type: 'schedule'; event: Id; after: number; window?: number; when?: Condition[] }
  | { type: 'modifier'; mod: ModifierDef; months: number }
  | { type: 'random'; outcomes: { weight: number; effects: Effect[] }[] }
  | { type: 'if'; when: Condition[]; then: Effect[]; else?: Effect[] }
  /** 서술 한 줄 */
  | { type: 'line'; key: string; params?: Record<string, LineParam> }
  | { type: 'narrative'; id: Id }
  | { type: 'chronicle'; key: string; importance: number; params?: Record<string, LineParam> };

export type EffectType = Effect['type'];
