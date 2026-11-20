// 이벤트 카드와 행동 카드 정의 (DESIGN.md §5, §7.5)

import type { Id } from './common';
import type { Condition, PersonQuery } from './condition';
import type { Effect } from './effect';

export interface ActorSlot {
  slot: string;
  match: PersonQuery;
  /** 필수 슬롯을 채울 수 없으면 이벤트가 발생하지 않는다 */
  optional?: boolean;
}

export interface FollowUp {
  eventId: Id;
  delay: number;
  chance?: number;
}

export interface EventOptionDef {
  id: string;
  /** 미충족 → 흐리게 + 잠금 힌트 */
  requires?: Condition[];
  /** 미충족 → 아예 숨김. 말이 안 되는 경우에만 (검증기가 경고) */
  hiddenUnless?: Condition[];
  /** 없으면 실패 조건으로 힌트를 자동 생성한다 */
  lockHintKey?: string;
  effects: Effect[];
  setFlags?: Id[];
  clearFlags?: Id[];
  followUps?: FollowUp[];
  /** 있으면 event.<id>.opt.<optId>.chron 문장이 연대기 후보가 된다 */
  chronicle?: { importance: number };
  /** 비용 없는 선택지를 의도적으로 허용할 때 사유 (검증기 예외) */
  freeOk?: string;
}

export type EventMode = 'pool' | 'forced' | 'followUp';

export interface EventDef {
  id: Id;
  tags: string[];
  trigger: {
    seasons?: Id[];
    minTurn?: number;
    maxTurn?: number;
    eras?: Id[];
    conditions?: Condition[];
  };
  mode: EventMode;
  weight: number;
  weightMods?: { when: Condition[]; mul: number }[];
  cooldown: number;
  once: boolean;
  /** forced끼리의 순서 (높을수록 먼저) */
  priority?: number;
  /** 한 턴 최대 이벤트 수를 무시한다 (계승, 멸족 직전 위기) */
  ignoreCap?: boolean;
  actors?: ActorSlot[];
  /** 처음 맞는 변형의 본문(event.<id>.text.<variantId>)을 쓴다 */
  textVariants?: { id: string; when: Condition[] }[];
  options: EventOptionDef[];
}

export interface ActionCardDef {
  id: Id;
  tags: string[];
  /** UI 아이콘 이름 (직접 만든 SVG 세트) */
  icon: string;
  /** 손에 들어와도 조건이 안 되면 잠김 표시 */
  requires?: Condition[];
  lockHintKey?: string;
  /** 사용 즉시 지불. 자원 비용이 모자라면 쓸 수 없다 */
  cost?: Effect[];
  /** 인물 배정. 배정된 인물은 슬롯 'assignee'로 조건·효과에서 쓸 수 있다 */
  assign?: { required: boolean; match?: PersonQuery };
  effects: Effect[];
  /** 한 번 쓰면 덱에서 사라진다 */
  exhaust?: boolean;
  chronicle?: { importance: number };
}
