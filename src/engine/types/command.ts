// 커맨드 (DESIGN.md §2.4). 플레이어와 (나중에) AI 부족이 같은 인터페이스로 상태를 바꾼다.
// M1: 역할 배분, 턴 종료, 디버그. 이벤트 선택과 행동 카드는 M2에서 추가한다.

import type { Id } from './common';

export type DebugOp =
  | { op: 'setResource'; key: Id; value: number }
  | { op: 'setAxis'; axis: Id; value: number }
  | { op: 'setFlag'; id: Id; set: boolean }
  | { op: 'setPopulation'; value: number };

export type Command =
  | { type: 'setRoles'; roles: Record<Id, number> }
  | { type: 'endActionPhase' }
  /** UI는 개발 모드에서만 이 커맨드를 보낸다 */
  | { type: 'debug'; debug: DebugOp };

export interface ReduceResult {
  state: import('./state').GameState;
  /** 거부 사유 문자열 키. 있으면 state는 입력과 같다. */
  error?: string;
}
