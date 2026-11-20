// 게임 상태 (DESIGN.md §2.1). JSON으로 그대로 저장/복원된다: 함수, Map, Set, undefined 금지.

import type { Id, Label } from './common';
import type { Effect, ModifierDef } from './effect';
import type { EndingKind } from './chapter';

export type RngState = [number, number, number, number];

export type Phase = 'event' | 'action' | 'ended';

export interface Tribe {
  name: Label;
  traits: Id[];
  population: number;
  roles: Record<Id, number>;
  resources: Record<Id, number>;
  axes: Record<Id, number>;
  lifestyle: Id;
  growth: number;
  hunger: number;
}

export interface Person {
  id: Id;
  name: Label;
  sex: 'f' | 'm';
  stage: Id;
  stageTurns: number;
  office: Id | null;
  traits: Id[];
  relation: number;
  parents: [Id | null, Id | null];
  alive: boolean;
  bornTurn: number;
  bornReign: number;
  death: { turn: number; reign: number; causeKey: string } | null;
  ambition: number;
}

export interface RegionState {
  depletion: number;
}

export interface ScheduledEvent {
  eventId: Id;
  dueTurn: number;
  chance: number;
  /** 같은 턴 안의 순서를 정하는 등록 번호 */
  seq: number;
}

export interface ScheduledEffect {
  dueTurn: number;
  effects: Effect[];
  seq: number;
  sourceKey: string;
}

export interface EventInstance {
  uid: string;
  eventId: Id;
  /** 슬롯 → 인물 id */
  actors: Record<string, Id>;
  variant: string | null;
}

export interface CardInstance {
  uid: string;
  cardId: Id;
}

/** 연대기 문장 템플릿 변수. 인물 이름은 그 시점의 값으로 굳혀 둔다. */
export type ChronicleParam = Label | number;

export interface ChronicleEntry {
  turn: number;
  reign: number;
  season: Id;
  /** 이 족장 시절의 몇 번째 같은 계절인가 (1부터) */
  seasonIndex: number;
  key: string;
  params: Record<string, ChronicleParam>;
}

export interface ActiveModifier {
  mod: ModifierDef;
  /** 이 턴이 끝날 때까지 유효 */
  lastTurn: number;
  sourceKey: string;
}

/** 이번 턴의 변화 기록. 요약, 애니메이션, 연대기 후보가 이 하나를 공유한다. */
export type LogEntry =
  | { kind: 'resource'; key: Id; delta: number; source: string }
  | { kind: 'population'; delta: number; source: string }
  | { kind: 'axis'; axis: Id; delta: number; source: string }
  | { kind: 'counter'; id: Id; delta: number; source: string }
  | { kind: 'flag'; id: Id; set: boolean; source: string }
  | { kind: 'modifier'; stat: string; turns: number; source: string }
  | { kind: 'roll'; p: number; success: boolean; source: string }
  | { kind: 'chronicle'; key: string; importance: number; source: string; params: Record<string, ChronicleParam> }
  | { kind: 'stage'; personId: Id; to: Id; source: string }
  | { kind: 'person'; personId: Id; relation: number; source: string }
  | { kind: 'trait'; personId: Id; trait: Id; added: boolean; source: string }
  | { kind: 'card'; cardId: Id; delta: number; source: string }
  | { kind: 'event'; eventId: Id; optionId: string; source: string }
  | { kind: 'action'; cardId: Id; personId: Id | null; source: string }
  | { kind: 'note'; key: string; source: string };

export interface TurnSummary {
  turn: number;
  season: Id;
  reign: number;
  log: LogEntry[];
}

export interface EndingRecord {
  id: Id;
  kind: EndingKind;
  turn: number;
}

export interface GameState {
  saveVersion: number;
  chapterId: Id;
  seed: string;
  rng: RngState;
  turn: number;
  season: Id;
  reign: number;
  reignStartTurn: number;
  eraId: Id;
  phase: Phase;

  tribe: Tribe;
  people: Record<Id, Person>;
  regions: { current: Id; discovered: Id[]; state: Record<Id, RegionState> };
  knowledge: Id[];
  traditions: Record<Id, { id: Id; adoptedTurn: number } | null>;

  /** 값 = 설정된 턴 */
  flags: Record<Id, number>;
  counters: Record<Id, number>;

  actions: {
    playsLeft: number;
    /** 이번 계절에 행동에 배정된 인물 (같은 인물을 두 번 쓰지 못한다) */
    busy: Id[];
  };
  deck: { draw: CardInstance[]; hand: CardInstance[]; discard: CardInstance[] };
  events: {
    /** 이번 턴에 해결해야 할 이벤트. 앞에서부터 하나씩 */
    pending: EventInstance[];
    scheduled: ScheduledEvent[];
    history: Record<Id, { count: number; lastTurn: number }>;
    /** 최근 턴들에 나온 이벤트 태그 (태그 피로 판정용, 최신이 끝) */
    recentTags: string[][];
  };
  chronicle: ChronicleEntry[];
  delayed: ScheduledEffect[];
  modifiers: ActiveModifier[];
  /** 예약 항목 등록 순서용 단조 증가 번호 */
  seq: number;

  turnLog: LogEntry[];
  /** 직전에 끝난 턴들의 요약 (최근 것이 끝) */
  history: TurnSummary[];
  ending: EndingRecord | null;
}
