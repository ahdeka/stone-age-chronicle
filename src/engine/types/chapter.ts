// 장 정의 (DESIGN.md §3.6). 엔진은 특정 장에 의존하지 않고 이 데이터만 읽는다.

import type { AgeBand, Amount, Hint, Id, Sex, Tier } from './common';
import type { Condition } from './condition';
import type { ModifierDef } from './effect';
import type { EventDef, Narrative, PolicyTemplate, SceneSpec } from './content';
import type { AnimalState } from './state';

/** 부패를 결정하는 온도 구간 */
export type TempClass = 'frozen' | 'cold' | 'mild' | 'warm';

export interface MonthDef {
  id: Id;
  season: Id;
  /** 화면에 쓰는 달 숫자 (녹는달 = 3). 달 이름은 이야기 문장에서만 쓴다 */
  number: number;
  temp: TempClass;
  /** 천막 기준 하루 장작 소모 kg */
  firewoodPerDay: number;
  /** 한 사람이 하루에 모으는 장작 kg */
  woodPerWorkerDay: number;
  /** 날씨 가중치 (순마다 하나씩 뽑는다) */
  weather: Record<Id, number>;
  mods?: ModifierDef[];
}

export interface AgeBandDef {
  id: AgeBand;
  /** 이 나이부터 (아이는 0) */
  fromAge: number;
  foodPerMonth: number;
  labor: number;
  /** 굶주림·추위에 약한가 */
  vulnerable: boolean;
}

export interface FoodKindDef {
  id: Id;
  /** 순당 부패 비율 */
  spoil: Record<TempClass, number>;
  /** 같은 양을 나를 때의 무게 계수 (말린 고기 0.5) */
  carryFactor: number;
}

export interface ShelterDef {
  id: Id;
  firewoodMul: number;
  mods?: ModifierDef[];
  scene: Id;
}

export interface YieldDef {
  id: Id;
  foodKind: Id;
}

export interface PlaceDef {
  id: Id;
  kind: Id;
  travelDays: number;
  scene: Id;
  /** 계절별, 순당 한 사람의 기대 수확 kg */
  yields: Record<Id, Partial<Record<Id, number>>>;
  /** 재고 상한. 재고 비율만큼 수확이 준다 (고갈) */
  stockMax: Partial<Record<Id, number>>;
  /** 한 달에 상한의 몇 비율이 회복되는가 */
  recoverPerMonth: number;
}

export interface AnimalDef {
  id: Id;
  states: Id[];
  /** 달마다 일어날 수 있는 상태 전이 */
  schedule: { month: Id; to: Id; chance: number; at?: Id | null }[];
  meatKg: number;
  foodKind: Id;
  /** 한 마리당 부산물 (가죽 등) */
  goods?: Record<Id, number>;
}

export interface WeatherDef {
  id: Id;
  mods: ModifierDef[];
  overlay?: Id;
}

export interface AilmentDef {
  id: Id;
  /** 다침인가 병인가 (알림 카드의 모양) */
  type: 'injury' | 'sickness';
  /** 회복까지 걸리는 순 수 [최소, 최대] */
  phases: readonly [number, number];
  noLabor: boolean;
  /** 순마다 죽을 확률 (중증도 3일 때 ×2, 굶주리면 ×balance 배율) */
  deathChance: number;
}

export interface TraitDef {
  id: Id;
  mods?: ModifierDef[];
}

export interface KnowledgeDef {
  id: Id;
  need: number;
  mods: ModifierDef[];
}

export interface ClueDef {
  id: Id;
  mods?: ModifierDef[];
  /** 밝혀 주는 숨은 변수 id */
  reveals?: Id[];
}

export interface EndingDef {
  id: Id;
  kind: 'defeat' | 'survival' | 'victory';
  priority: number;
  check: Condition[];
}

export interface PresetPerson {
  id: Id;
  sex: Sex;
  age: number;
  traits?: Id[];
  skills?: Partial<Record<Id, number>>;
  parents?: Id[];
  advisor?: { seat: Id; stance: Id };
  isChief?: boolean;
  /** 시작할 때 앓고 있는 병·부상 (phases: 회복까지 남은 순) */
  ailing?: { kind: Id; severity?: 1 | 2 | 3; phases: number };
}

/** 시작 프리셋의 화면용 글 (모두 문자열 키) — 인트로, 땅 정보, 연대기 첫 문장 */
export interface PresetPresentation {
  chapterLabel: string;
  introLines: string[];
  meta: string;
  tagline: string;
  land: { title: string; subtitle: string; intro: string; facts: { mark: string; label: string; value: string }[] };
  chronicleOpening: string;
  /** 시작 화면의 추천 부족 이름 (문자열 키). 첫 번째가 기본 이름이다 */
  nameSuggestions: string[];
}

export interface StartPreset {
  id: Id;
  presentation: PresetPresentation;
  shelterUnits: number;
  /** 시작 달의 인덱스 (calendar.months) */
  startMonthIndex: number;
  /** true면 시작 화면에 보이지 않는다 (시험 플레이 재현 테스트용 프리셋) */
  hidden?: boolean;
  campPlace: Id;
  shelter: Id;
  people: PresetPerson[];
  food: { kind: Id; kg: number }[];
  firewood: number;
  goods: Record<Id, number>;
  cohesion: number;
  discovered: Id[];
  animals: Record<Id, AnimalState>;
  knowledge: Id[];
}

/** 월초 보고 규칙 (DESIGN.md §4.1). 조건은 위에서부터, 처음 맞는 것 */
export interface BriefingRules {
  headlines: { when: Condition[]; key: string }[];
  /** 소식: 조건이 맞는 것 중 우선순위 높은 순으로 maxNews개. chip이 있으면 결정 팝업의 상황 칩으로도 쓴다 */
  news: { when: Condition[]; key: string; priority: number; chip?: string; tone?: 'warn' | 'normal' | 'good' }[];
  /** 소식과 별개인 상황 칩 */
  chips: { when: Condition[]; key: string; tone: 'warn' | 'normal' | 'good' }[];
  scenes: { when: Condition[]; scene: SceneSpec }[];
}

/** 조언자의 입장: 방침 분야와 위험 단서를 얼마나 좋아하는가 */
export interface StanceDef {
  id: Id;
  categories: Record<Id, number>;
  hints: Partial<Record<Hint, number>>;
}

/** 조언 대사. 자리(seat)나 입장(stance), 방침이나 분야로 고른다. 더 구체적인 것이 먼저 */
export interface AdvisorLine {
  seat?: Id;
  stance?: Id;
  policy?: Id;
  category?: Id;
  when?: Condition[];
  text: string;
}

/** 시대 목표의 길. measure가 없으면 아직 잴 수 없는 길이다 (화면에서 흐리게) */
export interface GoalPathDef {
  id: Id;
  measure?: { id: Id; target: number; params?: Record<string, string | number> };
}

export interface EraGoalDef {
  id: Id;
  paths: GoalPathDef[];
}

export interface ChapterBalance {
  monthLimit: number;
  daysPerPhase: number;
  /** 기본 스탯. 모디파이어가 여기에 얹힌다 */
  stats: Record<string, number>;
  ration: {
    /** 감축 배급 비율. 이만큼도 못 먹으면 굶주림(2단계)이고 남은 식량을 다 먹는다 */
    reduced: number;
    /** 정상 배급 한 순마다 hungerDays가 줄어드는 양 */
    recoverPerPhase: number;
    /** 이만큼 굶은 날이 쌓이면 쓰러짐 판정 (약한 사람 / 나머지) */
    collapseDays: { vulnerable: number; others: number };
    /** 쓰러짐 확률 = collapseChance × (1 + 넘긴 날 / collapseSlopeDays), 최대 collapseMax (순당) */
    collapseChance: number;
    collapseSlopeDays: number;
    collapseMax: number;
    /** 굶주림 단계별 노동 효율 */
    efficiency: [number, number, number];
    /** 굶주림 단계별 순당 결속 변화 */
    cohesionPerPhase: [number, number, number];
    /** 굶주림 2단계에서 약한 사람이 순마다 병에 걸릴 확률과 병 id */
    sicknessChance: number;
    sickness: Id;
    /** 굶주림 중 병의 사망 확률 배율 */
    sickDeathMul: number;
  };
  cold: {
    sickChance: number;
    sickness: Id;
    deathChance: number;
    cohesion: number;
  };
  chores: {
    /** 장작이 이 순 수 소모분보다 적으면 마을 일손을 장작에 더 쓴다 */
    firewoodTargetPhases: number;
    firewoodShareLow: number;
    firewoodShareNormal: number;
  };
  carry: {
    /** 한 사람이 나르는 양은 스탯 'carry.perPerson' (끌개 지식 등이 올린다) */
    /** 이 일수 이하로 가까우면 여러 번 왕복한다 */
    multiTripMaxDays: number;
    maxTrips: number;
    /** 이보다 적게 남으면 처리 결정을 묻지 않고 버린다 */
    askLeftoverKg: number;
    /** 현장 건조: 고기를 말린 고기로 바꾸는 비율 (먹을 수 있는 양 기준) */
    dryYield: number;
    dryKind: Id;
    dryKnowledge: Id;
    abandonCohesion: number;
    /** 짐꾼 부르기: 원정지가 이 일수 이하로 가까우면 마을에서 사람을 불러 나른다 */
    portersMaxDays: number;
    /** 짐꾼 수 (마을 일손에서), 한 사람이 나르는 양은 carry.perPerson × 왕복 수 */
    porters: number;
    porterTrips: number;
    /** 짐꾼이 빠진 동안 마을 일 배율 (이번 달) */
    porterVillageMul: number;
  };
  cache: {
    /** 은닉물의 부패 배율, 냄새 증가, 짐승 습격 */
    spoilMul: number;
    scentPerMonth: number;
    raidAnimal: Id;
    raidChancePerScent: number;
    raidLoss: Amount;
    /** 확인하지 않은 지 이 달 수가 지나면 상태를 모른다 */
    staleAfterMonths: number;
  };
  tier: {
    spread: number;
    /** v가 이 값 이상이면 그 등급 (disaster는 나머지) */
    thresholds: Record<Exclude<Tier, 'disaster'>, number>;
  };
  hint: { sure: number; fair: number };
  policy: { slots: number; urgentSlots: number; urgentFoodDays: number; maxPerCategory: number; jitter: number; maxCacheTargets: number };
  events: { villageChancePerMonth: number; maxPerMonth: number };
  cohesion: {
    max: number;
    deathCost: number;
    lowThreshold: number;
  };
  /** 기록용 연대기 기본 중요도 */
  chronicle: { deathImportance: number };
  /** 화면 기준값 */
  ui: {
    foodWarnDays: number;
    firewoodWarnDays: number;
    /** 결속 구간: min 이상이면 그 이름 (높은 것부터) */
    cohesionBands: { min: number; id: Id }[];
    maxNews: number;
  };
}

export interface ThemeDef {
  id: Id;
  motif: string;
  tokens: Record<string, string>;
}

export interface ChapterDefinition {
  id: Id;
  /** yearStartsAt: 년차가 바뀌는 달 id (1장: 녹는달 = 3월) */
  calendar: { months: MonthDef[]; yearStartsAt: Id };
  seasons: Id[];
  ageBands: AgeBandDef[];
  foodKinds: FoodKindDef[];
  goods: Id[];
  shelters: ShelterDef[];
  yields: YieldDef[];
  places: PlaceDef[];
  animals: AnimalDef[];
  weather: WeatherDef[];
  ailments: AilmentDef[];
  traits: TraitDef[];
  knowledge: KnowledgeDef[];
  clues: ClueDef[];
  content: {
    policies: PolicyTemplate[];
    events: EventDef[];
    narratives: Narrative[];
    endings: EndingDef[];
  };
  /** 기본 장면 (보고, 정산, 인트로) */
  scenes: { briefing: SceneSpec; settlement: SceneSpec; intro: SceneSpec; groundBySeason?: Record<Id, Id> };
  briefing: BriefingRules;
  advisors: { stances: StanceDef[]; lines: AdvisorLine[] };
  goals: EraGoalDef[];
  /** 엔진이 쓰는 서술 고리: 마을 일 서술 */
  hooks: { villageNarrative: Id };
  globalMods: ModifierDef[];
  balance: ChapterBalance;
  presets: StartPreset[];
  theme: ThemeDef;
}
