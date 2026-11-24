import type { Id } from './common';
import type { GameState } from './state';

export type DebugOp =
  | { op: 'setFood'; kind: Id; kg: number }
  | { op: 'setFirewood'; kg: number }
  | { op: 'setCohesion'; value: number }
  | { op: 'setFlag'; id: Id; set: boolean }
  | { op: 'kill'; personId: Id }
  | { op: 'forceEvent'; eventId: Id };

export type Command =
  /** 이번 달 전략: 식량 1개 + 발전 0~1개, 또는 큰 일 1개 (후보 uid) */
  | { type: 'choosePlan'; uids: Id[] }
  | { type: 'chooseOption'; uid: Id; optionId: Id }
  /** 정산을 다 봤다 → 다음 달 월초 */
  | { type: 'nextMonth' }
  | { type: 'debug'; debug: DebugOp };
// M4 이후: setStandingOrder, adjustLabor

export interface ReduceResult {
  state: GameState;
  error?: string;
}
