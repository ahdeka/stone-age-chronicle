// 장 정의 (DESIGN.md §3.6). 엔진은 특정 장에 의존하지 않고 이 데이터만 읽는다.

import type { AgeBand, Amount, Id, Sex, Tier } from './common';
import type { Condition } from './condition';
import type { ModifierDef } from './effect';
import type { EventDef, Narrative, PolicyTemplate, SceneSpec } from './content';
import type { AnimalState } from './state';

/** 부패를 결정하는 온도 구간 */
export type TempClass = 'frozen' | 'cold' | 'mild' | 'warm';

export interface MonthDef {
  id: Id;
  season: Id;
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
}

export interface StartPreset {
  id: Id;
  /** 시작 달의 인덱스 (calendar.months) */
  startMonthIndex: number;
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
  policy: { slots: number; urgentSlots: number; urgentFoodDays: number; maxPerCategory: number; jitter: number };
  events: { villageChancePerMonth: number; maxPerMonth: number };
  cohesion: {
    max: number;
    deathCost: number;
    lowThreshold: number;
  };
  /** 기록용 연대기 기본 중요도 */
  chronicle: { deathImportance: number };
}

export interface ThemeDef {
  id: Id;
  motif: string;
  tokens: Record<string, string>;
}

export interface ChapterDefinition {
  id: Id;
  calendar: { months: MonthDef[] };
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
  /** 기본 장면 (보고와 정산) */
  scenes: { briefing: SceneSpec; settlement: SceneSpec };
  globalMods: ModifierDef[];
  balance: ChapterBalance;
  presets: StartPreset[];
  theme: ThemeDef;
}
