// 게임 상태 (DESIGN.md §3.7). 전부 JSON으로 직렬화된다.

import type { Hint, Id, Label, RngState, Sex, Tier } from './common';
import type { Condition } from './condition';
import type { ModifierDef } from './effect';
import type { EventSlot, SceneSpec } from './content';

export interface Ailment {
  kind: Id;
  severity: 1 | 2 | 3;
  /** 절대 순 번호 (phaseNo) 이후 회복 */
  healsAt: number;
}

export interface Person {
  id: Id;
  name: Label;
  sex: Sex;
  /** 태어난 달 (게임 시작 달 = 1, 그 전은 0 이하) */
  birthMonth: number;
  alive: boolean;
  diedMonth?: number;
  cause?: Id;
  parents: Id[];
  traits: Id[];
  skills: Partial<Record<Id, number>>;
  advisor?: { seat: Id; stance: Id };
  isChief?: boolean;
  ailments: Ailment[];
  /** 덜 먹은 날의 누적 (정상 배급이면 줄어든다) */
  hungerDays: number;
}

export interface FoodLot {
  kind: Id;
  kg: number;
}

export interface Stores {
  food: FoodLot[];
  firewood: number;
  goods: Record<Id, number>;
}

export interface AnimalState {
  state: Id;
  at?: Id;
  known: boolean;
  vars: Record<string, number>;
}

export interface PlaceState {
  discovered: boolean;
  stock: Record<Id, number>;
  facts: Id[];
}

export interface Cache {
  id: Id;
  place: Id;
  lots: FoodLot[];
  month: number;
  scent: number;
  /** 마지막으로 상태를 확인한 달 */
  checkedMonth: number;
}

export interface Scheduled {
  uid: Id;
  event: Id;
  from: number;
  to: number;
  when?: Condition[];
}

export interface TempModifier {
  mod: ModifierDef;
  /** 이 달까지 유효 */
  until: number;
  source: string;
}

export interface BoundPolicy {
  uid: Id;
  policyId: Id;
  crew: Id[];
  leaderId?: Id;
  hint: Hint;
  score: number;
}

export type LineParamValue = string | number | Label;

export interface Line {
  key: string;
  params?: Record<string, LineParamValue>;
}

export interface LedgerLine {
  /** 'food' | 'firewood' | 물자 id */
  res: Id;
  source: string;
  delta: number;
}

export interface PhaseReport {
  slot: EventSlot | 'settlement';
  weather?: Id;
  scene: SceneSpec;
  lines: Line[];
  tier?: Tier;
  /** 이 단계의 순수 증감 (애니메이션용) */
  deltas: Record<Id, number>;
}

export type Decision =
  | { uid: Id; kind: 'event'; eventId: Id; slot: EventSlot; actors: Record<string, Id> }
  | { uid: Id; kind: 'leftover'; kg: number };

export interface MonthWork {
  candidates: BoundPolicy[];
  chosen?: BoundPolicy;
  /** 이번 달 순별 날씨 */
  weather: [Id, Id, Id];
  /** 끝난 순 수 (0~3) */
  phasesDone: number;
  /** 진행 중인 순에서 다음에 실행할 방침 단계 번호 */
  stepIndex: number;
  /** 원정지의 짐 (운반 전) */
  haul: FoodLot[];
  decision?: Decision;
  reports: PhaseReport[];
  ledger: LedgerLine[];
  deaths: Id[];
  tiers: Tier[];
  events: Id[];
  /** 평온한 달 판정을 깨는 일이 있었는가 (§19) */
  notable: boolean;
  chronicle?: { key: string; importance: number; params?: Record<string, LineParamValue> };
  /** 원정 장소 (보고 장면용) */
  place?: Id;
  /** 직전 활동의 결과 맥락 ($caught, $meat 등) */
  vars: Record<string, number>;
  /** 마을 사건 판정을 이번 달에 했는가 */
  villageChecked: boolean;
  /** 월초 현황 (정산표의 시작 값) */
  start: { food: number; firewood: number; population: number };
}

export interface MonthReport {
  month: number;
  monthId: Id;
  policyId?: Id;
  reports: PhaseReport[];
  ledger: LedgerLine[];
  quiet: boolean;
}

export interface ChronicleEntry {
  month: number;
  monthId: Id;
  key: string;
  params?: Record<string, LineParamValue>;
}

export type Step = 'policy' | 'decision' | 'settlement' | 'ended';

export interface GameState {
  saveVersion: number;
  chapterId: Id;
  presetId: Id;
  seed: string;
  rng: RngState;
  /** 1부터 증가 */
  month: number;
  startMonthIndex: number;
  step: Step;
  campPlace: Id;
  shelter: { kind: Id; place: Id };
  people: Record<Id, Person>;
  chiefLine: number;
  stores: Stores;
  cohesion: number;
  /** 0 정상, 1 배급 감축, 2 굶주림 */
  hungerStage: number;
  places: Record<Id, PlaceState>;
  animals: Record<Id, AnimalState>;
  knowledge: { has: Id[]; progress: Record<Id, number> };
  clues: { id: Id; until?: number }[];
  caches: Cache[];
  scheduled: Scheduled[];
  modifiers: TempModifier[];
  flags: Record<Id, number>;
  counters: Record<Id, number>;
  /** 방침·사건 id → 다시 나올 수 있는 달 */
  cooldowns: Record<Id, number>;
  usedOnce: Id[];
  narrativeRecent: Record<Id, number>;
  work: MonthWork;
  history: MonthReport[];
  chronicle: ChronicleEntry[];
  ending?: { id: Id; kind: string; month: number };
  seq: number;
}
