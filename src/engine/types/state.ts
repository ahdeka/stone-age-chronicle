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
  /** 계절 턴의 단계 보고만: 이 단계가 벌어진 달 (게임 달 번호). 화면 소제목 "초입 · 3월" */
  month?: number;
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

/** 턴 종류 (DESIGN.md §B2): 1년차는 한 달 한 턴, 2년차부터 한 철 한 턴 */
export type TurnKind = 'month' | 'season';

/** 지금 턴. 달 턴은 단계 하나(그 달), 계절 턴은 단계 = 달 (초입 → 한가운데 → 끝자락) */
export interface TurnInfo {
  kind: TurnKind;
  /** 이 턴의 달 수 (달 턴 1, 계절 턴 보통 3) */
  months: number;
  /** 지금 단계 (0부터). 계절 턴에서 단계마다 한 달이 지난다 */
  stage: number;
  /** 이 턴의 첫 달 (게임 달 번호) */
  firstMonth: number;
}

export interface MonthWork {
  /** 지금 턴 (세이브 v6) */
  turn: TurnInfo;
  /** 계절 턴: 지금 단계의 전략 단계를 다 실행했는가 */
  stageSteps?: boolean;
  /** 계절 턴: 지금 단계에서 가장 나빴던 굶주림 단계 (결속 계절 환산, 달별 기록) */
  stageHunger?: number;
  /** 계절 턴: 다 메고 오지 못해 두고 온 고기 kg (이 철의 결과 글 한 줄) */
  leftBehind?: number;
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
  /** 이번 달 결속 변화의 출처별 합 (시뮬레이터 집계용. 없던 세이브는 비어 있다) */
  cohesionBy?: Record<string, number>;
  /** 이번 턴 배급 단계별 순 수 [다 먹음, 감축, 굶주림] (시뮬레이터 집계용. 없던 세이브는 비어 있다) */
  rationPhases?: [number, number, number];
  /** 직전 활동의 결과 맥락 ($caught, $meat 등) */
  vars: Record<string, number>;
  /** 마을 사건 판정을 이번 달에 했는가 (계절 턴: 한가운데 인물 사건 창을 열어 보았는가) */
  villageChecked: boolean;
  /** 월초 현황 (정산표의 시작 값, 진행 화면의 "월초 기준" 지표, 이달의 결과의 증감) */
  start: MonthStart;
  brief?: Briefing;
  advice: Advice[];
  /** 이번 달에 겪은 가장 깊은 굶주림 단계 (목표 측정용) */
  maxHunger: number;
}

/** 이번 달이 시작할 때의 지표 (세이브 v5) */
export interface MonthStart {
  food: number;
  firewood: number;
  population: number;
  /** 식량 며칠치 (내림) */
  foodDays: number;
  cohesion: number;
  /** 일할 사람 = 일할 수 있는 성인(족장·노인·아이 제외, workingAdults). 세이브 v7까지는 노동 값의 합(반올림)이었다 —
   *  월초마다 새로 쓰므로 옛 세이브는 다음 턴 첫머리에 바뀐다 */
  workers: number;
  /** 병이 있는 사람 */
  sick: number;
  /** 다친 사람 */
  injured: number;
}

export interface MonthReport {
  /** 턴의 마지막 달 (달 턴이면 그 달) */
  month: number;
  monthId: Id;
  /** 턴 번호와 종류 (세이브 v6) */
  turn: number;
  kind: TurnKind;
  /** 턴의 첫 달 */
  firstMonth: number;
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

/** 발전 칸 상태: 잠김 / 열림 / 진행 중 / 켜짐 (DESIGN.md §B3.3) */
export type CellStatus = 'locked' | 'open' | 'active' | 'done';

export interface TechLogEntry {
  /** work = 일손, gift = 사람·이웃의 선물, drift = 균형 규칙의 저절로 진행, winter = 저장분으로 버틴 겨울 */
  kind: 'work' | 'gift' | 'drift' | 'winter';
  by?: Id;
  amount: number;
  month: number;
}

export interface TechCellState {
  status: CellStatus;
  /** 철 단위 (0.5 = 절반) */
  progress: number;
  /** 사람·이웃이 채운 몫 (칸의 maxShare까지) */
  gifted: number;
  /** 마지막으로 전략으로 일한 달(선물·저절로 나아간 몫은 바꾸지 않는다). 세이브 v7까지는 선물에도 바뀌었으므로
   *  "이어 가던 칸"은 이 값이 아니라 log의 일 기록으로 정한다(continuingCell) */
  lastProgress?: number;
  costPaid?: boolean;
  doneMonth?: number;
  log: TechLogEntry[];
}

export interface ArcState {
  stage: Id;
  since: number;
  history: { stage: Id; option: Id; month: number }[];
  ended?: boolean;
}

export interface GameState {
  saveVersion: number;
  chapterId: Id;
  presetId: Id;
  seed: string;
  rng: RngState;
  /** 플레이어가 정한 부족 이름. 빈 문자열이면 프리셋의 기본 이름(nameSuggestions[0])을 쓴다 */
  tribeName: string;
  /** 1부터 증가 (실제 달. 계절 턴에서도 단계마다 한 달씩 오른다) */
  month: number;
  /** 턴 번호, 1부터 (세이브 v6). 1년차는 달과 같이 오르고, 2년차부터 철마다 오른다 */
  turn: number;
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
  /** 발전 나무의 칸 상태 (DESIGN.md §B3.3, 세이브 v6). 없는 칸은 장 정의에서 계산한다 */
  tech: Record<Id, TechCellState>;
  /** 인물 이야기 줄기 (DESIGN.md §B5.2, 세이브 v6). R3에서 채운다 */
  arcs: Record<Id, ArcState>;
  clues: { id: Id; until?: number }[];
  caches: Cache[];
  scheduled: Scheduled[];
  modifiers: TempModifier[];
  flags: Record<Id, number>;
  counters: Record<Id, number>;
  /** 방침·사건 id → 다시 나올 수 있는 턴 (쿨다운은 턴 단위: 1년차는 달, 2년차부터 철) */
  cooldowns: Record<Id, number>;
  usedOnce: Id[];
  narrativeRecent: Record<Id, number>;
  work: MonthWork;
  history: MonthReport[];
  chronicle: ChronicleEntry[];
  ending?: { id: Id; kind: string; month: number };
  seq: number;
}
