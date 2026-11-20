// 커맨드 (DESIGN.md §2.4). 플레이어와 (나중에) AI 부족이 같은 인터페이스로 상태를 바꾼다.

import type { Id } from './common';
import type { GameState } from './state';

export type DebugOp =
  | { op: 'setResource'; key: Id; value: number }
  | { op: 'setAxis'; axis: Id; value: number }
  | { op: 'setFlag'; id: Id; set: boolean }
  | { op: 'setPopulation'; value: number }
  /** 조건을 무시하고 이벤트를 지금 띄운다 (필수 인물 슬롯은 채울 수 있을 때만) */
  | { op: 'forceEvent'; eventId: Id };

export type Command =
  | { type: 'chooseOption'; eventUid: string; optionId: string }
  | { type: 'setRoles'; roles: Record<Id, number> }
  | { type: 'playAction'; cardUid: string; personId?: Id }
  | { type: 'endActionPhase' }
  /** UI는 개발 모드에서만 이 커맨드를 보낸다 */
  | { type: 'debug'; debug: DebugOp };

export interface ReduceResult {
  state: GameState;
  /** 거부 사유 문자열 키. 있으면 state는 입력과 같다. */
  error?: string;
}
