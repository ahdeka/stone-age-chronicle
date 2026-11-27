// 장 정의 (DESIGN.md §3.6). 엔진은 특정 장에 의존하지 않고 이 데이터만 읽는다.

import type { AgeBand, Amount, Hint, Id, Sex, Tier } from './common';
import type { Condition, PersonQuery } from './condition';
import type { Effect, ModifierDef } from './effect';
import type { EventDef, Narrative, PolicyTemplate, SceneSpec } from './content';
import type { AnimalState, TurnKind } from './state';

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

/** 땅 정보 한 칸의 선 아이콘 (화면이 id를 SVG로 그린다, 2026-11-24 3차 피드백) */
export type LandIcon = 'terrain' | 'climate' | 'rain' | 'river' | 'soil' | 'danger';

/** 땅 정보 한 칸: 아이콘, 이름, 값. warn이면 경고색 칸 */
export interface LandFact {
  icon: LandIcon;
  label: string;
  value: string;
  tone?: 'warn';
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
  /** 이 지식을 얻는 순간의 효과 (예: 1년차 겨울 준비를 마치면 그 칸에 절반을 선물, §B3.6) */
  grantEffects?: Effect[];
}

/** 시설: 지은 것 (지식은 아는 것). 단계가 있고, 단계가 1 이상이면 모디파이어가 걸린다.
 *  단계별 차이는 모디파이어의 when에 { type: 'facility', id, min }을 둔다 */
export interface FacilityDef {
  id: Id;
  max: number;
  mods: ModifierDef[];
  /** 순마다 저절로 하는 일 (예: 건조대가 날것을 말린다). 마을 살림 전에 적용 */
  perPhase?: Effect[];
}

/** 발전 칸의 앞 칸 조건 (DESIGN.md §B3.3) */
export type TechRequire =
  /** 앞 칸이 모두 켜져야 (빈 목록 = 갈래 첫 칸, 처음부터 열림) */
  | { all: Id[] }
  /** 하나라도 켜졌거나 조건 (굴 다지기: 천막 보수 또는 바위굴) */
  | { any: Id[]; or?: Condition[] }
  /** 갈래 끝: 같은 갈래 앞 칸 min개 이상 (§B3.5 안 A). 선물을 받아도 이 조건 전에는 열리지 않는다 */
  | { branchDone: Id; min: number };

/** 칸이 여는 새 행동 (1개 이상 필수, 숫자 보정만 있는 칸은 금지 — §B1) */
export type TechUnlock = { kind: 'policy'; id: Id } | { kind: 'event'; id: Id } | { kind: 'option'; event: Id; option: Id };

export interface TechCellDef {
  id: Id;
  branch: Id;
  /** 나무 화면의 자리 (1부터). 갈래 끝은 그 갈래의 가장 큰 order */
  order: number;
  requires: TechRequire;
  /** 걸리는 철 수 = 진척 목표 (1년차 한 달 = 1/3철) */
  seasons: number;
  /** 필요한 인원과 맡을 인물. 인물이 없으면 fallback, 그것도 없으면 시작 못 한다 */
  crew: { adults: number; person?: PersonQuery; fallback?: PersonQuery };
  /** 처음 시작하는 턴에 한 번 */
  cost?: { goods?: Record<Id, number>; firewoodKg?: number; foodKg?: number };
  /** 시작할 수 있는 철 (없으면 언제나) */
  startSeasons?: Id[];
  unlocks: TechUnlock[];
  /** 사람·이웃이 채울 수 있는 몫 상한 (칸의 비율, 기본 balance.tech.giftMaxShare) */
  gift?: { maxShare: number };
  /** 켜지면 주는 지식·시설 (기존 모디파이어와 "덕분에" 줄을 그대로 쓴다, §B3.3) */
  grants?: { knowledge?: Id[]; facility?: Id[] };
  /** 켜진 뒤 걸리는 덧붙는 보정 (새 행동에 덧붙을 때만, §B1) */
  mods?: ModifierDef[];
  scene: SceneSpec;
}

/** 나무 화면에만 보이는 "준비 중" 칸 (R2-b-2): 엔진 효과가 아직 없어 늘 잠겨 있다. 이름 `tech.<id>`, 여는 것의 글만 있다.
 *  본편 칸(R4)이 들어오면 cells로 옮기고 여기서 지운다. 엔진·시뮬레이터·검증기의 칸 규칙은 이것을 보지 않는다 */
export interface PlannedCellDef {
  id: Id;
  branch: Id;
  order: number;
  /** 걸릴 철 수 (§B3.2 초안, 진척 막대의 눈금) */
  seasons: number;
  /** 갈래 끝인가 (두 겹 테두리) */
  end?: boolean;
  /** 켜지면 여는 것: 종류와 이름 문자열 키 */
  opens: { kind: 'food' | 'major' | 'event' | 'option'; name: string }[];
}

export interface TechTreeDef {
  /** 갈래 id (화면 순서) */
  branches: Id[];
  cells: TechCellDef[];
  /** 나무 화면의 "준비 중" 칸 (R4에서 cells로) */
  planned?: PlannedCellDef[];
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
  land: { title: string; subtitle: string; intro: string; facts: LandFact[] };
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
  /** 이미 지난 달 수 (개발용 프리셋). 12면 1년차를 지난 것으로 보고 2년차 첫 달에서 시작한다.
   *  나이(people.age)는 시작 달 기준이고, 달 번호·년차·턴 종류는 이 값만큼 지난 것으로 센다. 기본 0 */
  elapsedMonths?: number;
  /** 시작할 때 지어져 있는 시설 */
  facilities?: Record<Id, number>;
  /** 시작할 때 켜져 있는 칸. workedMonths는 부족이 그 칸에서 일한 달(나무 판의 기록 줄, 1 이상 elapsedMonths 이하) */
  techDone?: { id: Id; workedMonths: number[] }[];
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
  /** 턴 (DESIGN.md §B2): 이 년차부터 한 철 한 턴. 철 턴의 달 수는 같은 철이 이어지는 달 수(최대 maxSeasonMonths) */
  turn: {
    seasonFromYear: number;
    maxSeasonMonths: number;
    /** 계절 턴 하나에 열리는 결정 사건 수 (한가운데 인물 사건이 중심, §B5.1) */
    eventsPerSeason: number;
  };
  /** 발전 나무 (DESIGN.md §B3, §B4.4) */
  tech: {
    /** 한 철의 달 수: 칸 진척 = 이번 턴의 달 수 / monthsPerSeason (1년차 한 달 = 1/3철) */
    monthsPerSeason: number;
    /** 사람·이웃의 선물 상한 (칸의 비율) */
    giftMaxShare: number;
    /** 이어 가던 칸이 저절로 나아가는 속도 (일손 진척의 비율) */
    driftRate: number;
    /** 칸 전략의 기본 점수 (턴 종류별). 1년차는 작은 발전과 같은 높이라 칸이 늘 이기지 않는다 — 진행 중인 칸만
     *  policy.projectBonus(이어 가기)를 받는다. 계절 턴에는 발전 자리가 칸뿐이다 */
    cellPriority: Record<TurnKind, number>;
    /** 1년차(달 턴) 칸 무리: 칸 인원 × share, 내림, 최소 min (진척 속도는 그대로) */
    monthCrew: { share: number; min: number };
    /** 1년차(달 턴) "겨울 준비" 작은 발전(prep: 'winter')의 점수 가산: 이 철(9~2월 = 가을·겨울)에 add */
    prepBonus: { seasons: Id[]; add: number };
    /** 발전 자리 중 칸이 차지할 수 있는 수 (턴 종류별). 1년차는 칸 1개 + 작은 발전(겨울 준비), 2년차부터 갈래마다 하나 (2026-11-26 결정) */
    cellSlots: { month: number; season: number };
    /** 신석기: 끝 칸이 켜진 갈래 수 */
    neolithicBranches: number;
    /** 칸이 켜진 턴의 결속 (작은 잔치, §B6.4) */
    doneCohesion: number;
    /** 계절 턴에 "발전하지 않는다"를 고르면 (식량만, 큰 일 아님) 걸리는 모디파이어: 발전 인원이 식량에 붙는다 (§B4.1) */
    noGrowthMods: ModifierDef[];
  };
  daysPerPhase: number;
  /** 기본 스탯. 모디파이어가 여기에 얹힌다 */
  stats: Record<string, number>;
  ration: {
    /** 감축 배급 비율. 이만큼도 못 먹으면 남은 식량을 다 먹는다 (DESIGN.md §10.5) */
    reduced: number;
    /** 먹은 비율이 이보다 낮으면(거의 먹을 것이 없음) 곧바로 굶주림(2단계) */
    starveRatio: number;
    /** 감축 배급 아래로 모자란 순이 이만큼 이어지면 굶주림(2단계). 그 전에는 감축(1단계)으로 버틴다 */
    starveAfterPhases: number;
    /** 다 먹은 순마다 결속이 회복된다 (upTo까지만) */
    recoverCohesion: { perPhase: number; upTo: number };
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
    /** 굶주림 단계별 순당 결속 변화 (달 턴) */
    cohesionPerPhase: [number, number, number];
    /** 계절 턴의 결속 (DESIGN.md §B6.4 안 A): 단계(달)마다 한 번, 그 단계 세 순 중 가장 나쁜 배급 상태로.
     *  perStage = 배급 단계별 변화(0 자리는 쓰지 않는다), recover = 다 먹은 단계의 회복 (recoverCohesion.upTo까지) */
    stageCohesion: { perStage: [number, number, number]; recover: number };
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
  policy: {
    /** 식량 칸 후보 수 (버티기 포함). 식량이 urgentFoodDays일치 아래면 urgentFoodSlots */
    foodSlots: number;
    urgentFoodSlots: number;
    /** 발전 칸 후보 수 ("발전하지 않는다"는 따로). 급할 때도 urgentGrowthSlots개는 보인다 */
    growthSlots: number;
    urgentGrowthSlots: number;
    urgentFoodDays: number;
    /** 한 칸 안에서 같은 분야 최대 개수 */
    maxPerCategory: number;
    jitter: number;
    maxCacheTargets: number;
    /** 짓다 만 공사의 점수 가산 (이어 가기 쉽게) */
    projectBonus: number;
  };
  /** maxPerPhase: 한 순에 열리는 중간 사건 수 (두 칸이 모두 사건 창을 가져도) */
  events: { villageChancePerMonth: number; maxPerMonth: number; maxPerPhase: number };
  cohesion: {
    max: number;
    deathCost: number;
    lowThreshold: number;
    /** 결속이 lowThreshold 아래로 턴을 넘길 때 분열 계수기(counter low_cohesion_months)에 더하는 값.
     *  달 턴 1, 계절 턴 1.5 → 분열 결말(계수기 3)은 "석 달" 또는 "철 둘"이 이어질 때 (§B6.4) */
    lowWeight: Record<TurnKind, number>;
  };
  /** 기록용 연대기 기본 중요도 */
  chronicle: { deathImportance: number; builtImportance: number };
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
  facilities: FacilityDef[];
  /** 발전 나무 (DESIGN.md §B3) */
  tech: TechTreeDef;
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
