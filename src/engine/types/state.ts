// 게임 상태 (DESIGN.md §3.7). 전부 JSON으로 직렬화된다.

import type { Hint, Id, Label, RngState, Sex, Tier } from './common';
import type { Condition } from './condition';
import type { ModifierDef } from './effect';
import type { EventSlot, PolicySlot, SceneSpec } from './content';

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
  /** bindCache 방침: 이 후보가 가는 곳 */
  place?: Id;
}

/** 이번 달 전략 하나 (식량 칸, 발전 칸, 큰 일). 원정지와 짐은 전략마다 따로 들고 다닌다 */
export interface PlanEntry {
  slot: PolicySlot;
  bound: BoundPolicy;
  /** 원정지 (원정이 아니면 없음) */
  place?: Id;
  /** 원정지의 짐 (운반 전) */
  haul: FoodLot[];
}

export type LineParamValue = string | number | Label;

/** 서술 줄이 속한 무리. 화면은 같은 무리의 연속된 줄을 한 문단으로 묶는다 */
export type LineGroup = 'crew' | 'growth' | 'village' | 'event' | 'people' | 'info';

export interface Line {
  key: string;
  params?: Record<string, LineParamValue>;
  group?: LineGroup;
}

export interface LedgerLine {
  /** 'food' | 'firewood' | 물자 id */
  res: Id;
  source: string;
  delta: number;
  /** 행 이름의 변수 (예: 잡은 마릿수, 먹은 사람 수). 같은 행을 합칠 때 숫자는 더한다 */
  params?: Record<string, number>;
}

/** 발전 덕분에 아낀 양 (장부의 증감이 아니다: "바위굴이라 장작 300kg을 아꼈다"). source는 'facility.x', 'knowledge.x', 'shelter.x' */
export interface SavingLine {
  res: Id;
  source: string;
  kg: number;
}

/** 사람에게 일어난 일 (진행 화면의 알림 카드) */
export interface Alert {
  kind: 'injury' | 'sick' | 'death' | 'healed';
  personId: Id;
  /** 부상·병 id 또는 죽음의 원인 id */
  what: Id;
}

export interface PhaseReport {
  slot: EventSlot | 'settlement';
  weather?: Id;
  /** 이 단계가 벌어진 곳 */
  place?: Id;
  scene: SceneSpec;
  lines: Line[];
  tier?: Tier;
  /** 이 단계의 순수 증감 (애니메이션용) */
  deltas: Record<Id, number>;
  /** 이 단계의 장부 행 (출처별로 합친 것). res 'haul'은 원정지의 짐 */
  rows: LedgerLine[];
  alerts: Alert[];
  /** 정산 단계만: 발전 덕분에 아낀 양 */
  savings?: SavingLine[];
  /** 단계 시작과 끝의 마을 식량·장작 (굴러가는 숫자용) */
  from: { food: number; firewood: number };
  to?: { food: number; firewood: number };
}

/** 월초 보고: 머리글, 소식, 상황 칩, 장면, 조언 */
export interface Briefing {
  headline: Line;
  news: Line[];
  chips: { key: string; params?: Record<string, LineParamValue>; tone: 'warn' | 'normal' | 'good' }[];
  scene: SceneSpec;
}

export interface Advice {
  personId: Id;
  /** 이 조언자가 가장 높게 친 후보 (방침 uid). 없으면 일반 조언 */
  policyUid?: Id;
  line: Line;
}

export type Decision =
  | { uid: Id; kind: 'event'; eventId: Id; slot: EventSlot; actors: Record<string, Id> }
  | { uid: Id; kind: 'leftover'; kg: number };

export interface MonthWork {
  /** 칸별 후보 (큰 일 → 식량 → 발전 순). 칸은 방침 정의의 slot으로 안다 */
  candidates: BoundPolicy[];
  /** 고른 전략: [식량, 발전?] 또는 [큰 일]. plan[0]이 주 전략 (장면, 연대기) */
  plan: PlanEntry[];
  /** 지금 단계를 실행하는 전략 (plan 인덱스). 마을 살림 중에는 없음 */
  active?: number;
  /** 진행 중인 순에서 다음에 실행할 전략 (plan 인덱스) */
  planIndex: number;
  /** 마지막으로 중간 사건이 열린 순 (phasesDone 값). 한 순에 사건 하나 */
  lastEventPhase?: number;
  /** 이번 달 순별 날씨 */
  weather: [Id, Id, Id];
  /** 끝난 순 수 (0~3) */
  phasesDone: number;
  /** 진행 중인 전략에서 다음에 실행할 단계 번호 */
  stepIndex: number;
  /** 전략에 속하지 않은 짐 (월초 사건 등). 하순 끝에 마을로 들인다 */
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
  /** 후보를 만들 때 잠깐 놓는 '$place' (그 후보가 가는 곳) */
  probePlace?: Id;
  /** 발전 덕분에 아낀 양 (이달의 결과에 보인다) */
  savings: SavingLine[];
  /** 직전 활동의 결과 맥락 ($caught, $meat 등) */
  vars: Record<string, number>;
  /** 마을 사건 판정을 이번 달에 했는가 */
  villageChecked: boolean;
  /** 월초 현황 (정산표의 시작 값) */
  start: { food: number; firewood: number; population: number };
  brief?: Briefing;
  advice: Advice[];
  /** 이번 달에 겪은 가장 깊은 굶주림 단계 (목표 측정용) */
  maxHunger: number;
}

export interface MonthReport {
  month: number;
  monthId: Id;
  /** 고른 전략 id (plan 순서) */
  policyIds: Id[];
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
  /** 플레이어가 정한 부족 이름. 빈 문자열이면 프리셋의 기본 이름(nameSuggestions[0])을 쓴다 */
  tribeName: string;
  /** 1부터 증가 */
  month: number;
  startMonthIndex: number;
  step: Step;
  campPlace: Id;
  /** units: 거처 채 수 (천막 다섯 채) */
  shelter: { kind: Id; place: Id; units: number };
  people: Record<Id, Person>;
  chiefLine: number;
  stores: Stores;
  cohesion: number;
  /** 0 정상, 1 배급 감축, 2 굶주림 */
  hungerStage: number;
  places: Record<Id, PlaceState>;
  animals: Record<Id, AnimalState>;
  knowledge: { has: Id[]; progress: Record<Id, number> };
  /** 시설 단계 (지은 것) */
  facilities: Record<Id, number>;
  /** 짓고 있는 공사: 시설 id → 지난 달 수 */
  projects: Record<Id, number>;
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
