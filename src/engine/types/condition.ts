// 조건 언어 (DESIGN.md §4.1)
// 조건 평가에는 난수를 쓰지 않는다. 확률은 이벤트 가중치와 효과(random, check)에서만 다룬다.

import type { Id } from './common';

/** 범위 표기. 둘 다 포함한다. 연산자 문자열 대신 이것만 쓴다. */
export interface NumRange {
  min?: number;
  max?: number;
}

export interface PersonQuery {
  office?: Id;
  trait?: Id;
  stage?: Id[];
  relation?: NumRange;
  /** 기본값 true */
  alive?: boolean;
}

export type Condition =
  // 부족 상태
  | ({ type: 'resource'; key: Id } & NumRange)
  | ({ type: 'population' } & NumRange)
  | ({ type: 'role'; role: Id } & NumRange)
  | ({ type: 'axis'; axis: Id } & NumRange)
  | { type: 'lifestyle'; is: Id }
  | { type: 'tribeTrait'; id: Id }
  // 진행
  | { type: 'season'; in: Id[] }
  | ({ type: 'turn' } & NumRange)
  | ({ type: 'reign' } & NumRange)
  | { type: 'era'; is: Id }
  | { type: 'flag'; id: Id; present?: boolean; sinceTurns?: NumRange }
  | ({ type: 'counter'; id: Id } & NumRange)
  | { type: 'eventSeen'; id: Id; present?: boolean }
  // 체계
  | { type: 'knowledge'; id: Id; has?: boolean }
  | { type: 'tradition'; id: Id }
  | { type: 'region'; current?: Id; special?: string; tag?: string; depth?: NumRange }
  | { type: 'regionDiscovered'; id: Id }
  // 인물
  | { type: 'person'; match: PersonQuery; count?: NumRange }
  | { type: 'chief'; match: PersonQuery }
  // 논리
  | { type: 'all'; of: Condition[] }
  | { type: 'any'; of: Condition[] }
  | { type: 'not'; of: Condition };
// 'actor'(이벤트 인물 바인딩)는 M2, 'neighbor'는 M5에서 추가한다.

export type ConditionType = Condition['type'];
