// 장 정의 (DESIGN.md §2.5). 엔진은 특정 장에 의존하지 않고 이 정의만 읽는다.

import type { Id, Label } from './common';
import type { Condition } from './condition';
import type { ModifierDef, StatKey } from './effect';

export interface ResourceDef {
  id: Id;
  min: number;
  /** null이면 상한 없음 */
  max: number | null;
  icon: string;
}

export interface AxisDef {
  id: Id;
  /** 음수 쪽 끝(예: 나눔)과 양수 쪽 끝(예: 위계)의 문자열 키는 axis.<id>.neg / .pos 규약 */
  min: number;
  max: number;
}

/** 역할 1명당 계절마다 만들어 내는 것. 엔진은 역할 id를 모르고 이 정의만 읽는다. */
export interface RoleOutput {
  resource: Id;
  /** 1명당 산출 스탯 */
  stat: StatKey;
  /** 지역 고갈의 영향을 받는가 */
  depletes?: boolean;
  /** 결과의 ± 변동 폭 (0.35 = ±35%) */
  variance?: number;
  /** 1인당 자원 보유량에 비례한 보너스 (예: 도구가 많으면 사냥이 잘 된다) */
  bonusFrom?: { resource: Id; perCapitaCap: number; weight: number };
}

export interface RoleDef {
  id: Id;
  icon: string;
  outputs: RoleOutput[];
}

/** 계절마다 인구에 비례해 빠지는 것 (식량 소비, 도구 마모) */
export interface UpkeepDef {
  resource: Id;
  perCapitaStat: StatKey;
}

/** 저장 상한과 부패 */
export interface StorageDef {
  resource: Id;
  capPerCapitaStat: StatKey;
  spoilStat: StatKey;
}

export interface SeasonDef {
  id: Id;
  /** 이 계절 동안 켜지는 모디파이어 */
  modifiers: ModifierDef[];
}

export interface EraDef {
  id: Id;
}

export interface LifestyleDef {
  id: Id;
  modifiers: ModifierDef[];
}

export interface LifeStageDef {
  id: Id;
  /** null이면 마지막 단계 */
  next: Id | null;
  turnsToNext: number;
  canHoldOffice: boolean;
  canBeChief: boolean;
}

export interface OfficeDef {
  id: Id;
  /** 부족을 이끄는 직책. 정확히 하나여야 한다 (검증기가 확인). */
  isChief?: boolean;
}

export interface PersonTraitDef {
  id: Id;
  modifiers: ModifierDef[];
  opposites?: Id[];
}

export interface TribeTraitDef {
  id: Id;
  modifiers: ModifierDef[];
  exclusiveWith?: Id[];
}

export interface RegionDef {
  id: Id;
  /** 시작 지역에서 몇 번 떨어졌나. 좌표나 거리 계산이 아니다. */
  depth: number;
  revealedFrom: Id[];
  /** 계절별 식량(채집·사냥) 배율 */
  foodMul: Record<Id, number>;
  danger: number;
  specials: string[];
  settleable: boolean;
  tags: string[];
}

export type EndingKind = 'victory' | 'defeat' | 'survival';

export interface EndingDef {
  id: Id;
  kind: EndingKind;
  /** 높을수록 먼저 판정 */
  priority: number;
  check: Condition[];
  /** 다음 장 권력의 길 씨앗 (DESIGN.md §7.8) */
  powerSeeds: { path: Id; weight: number }[];
}

export interface PresetPerson {
  id: Id;
  name: Label;
  sex: 'f' | 'm';
  stage: Id;
  stageTurns: number;
  office: Id | null;
  traits: Id[];
  relation: number;
  parents: [Id | null, Id | null];
}

export interface StartPreset {
  id: Id;
  tribeName: Label;
  population: number;
  roles: Record<Id, number>;
  resources: Record<Id, number>;
  axes: Record<Id, number>;
  lifestyle: Id;
  era: Id;
  region: Id;
  knowledge: Id[];
  people: PresetPerson[];
}

export interface ChapterBalance {
  turnLimit: number;
  /** 이 턴부터 "전설의 끝이 가까워진다" 표시 */
  warnTurn: number;
  /** getStat의 기본값. 새 스탯 키는 여기에 추가하는 것만으로 생긴다. */
  stats: Record<StatKey, number>;
  /** 장 전체에 항상 걸리는 모디파이어 (예: 결속이 높으면 행동 +1) */
  globalModifiers: ModifierDef[];
  upkeep: UpkeepDef[];
  storage: StorageDef[];
  /** 결속 역할을 하는 자원 (굶주림 손실, 인구 증가 조건에 쓰인다) */
  cohesionResource: Id;
  /** 얻은 양을 누적 카운터에 더하는 자원 (예: lore → lore_total) */
  totalCounters: Record<Id, Id>;
  starvation: { resource: Id; cohesionPerDeficit: number; popLossRate: number; hungerTurnsForLoss: number };
  growth: { cohesionMin: number; rateStat: StatKey };
  depletion: { perTurn: number; max: number; recoverPerTurn: number };
  /** 인구가 줄 때 먼저 빠지는 역할 순서 */
  roleLossOrder: Id[];
  /** 인구가 늘 때 들어가는 역할 */
  newcomerRole: Id;
  actions: { stat: StatKey; min: number; max: number };
}

export interface ChapterDefinition {
  id: Id;
  eras: EraDef[];
  resources: ResourceDef[];
  axes: AxisDef[];
  roles: RoleDef[];
  seasons: SeasonDef[];
  lifestyles: LifestyleDef[];
  lifeStages: LifeStageDef[];
  offices: OfficeDef[];
  scale: { labelKey: string };
  timeDisplay: { mode: 'reign' };
  balance: ChapterBalance;
  startPresets: StartPreset[];
  /** (b) 이전 장 결과로 시작할 때의 매핑 규칙. 1장은 없다. */
  importFromPrevious?: ImportRule;
  content: {
    personTraits: PersonTraitDef[];
    tribeTraits: TribeTraitDef[];
    regions: RegionDef[];
    endings: EndingDef[];
  };
  theme: ThemeDef;
}

/** 이전 장 결과 → 새 장 시작 상태 매핑. 2장에서 구체화한다. */
export interface ImportRule {
  presetId: Id;
  resourceMap: Record<Id, { to: Id; scale: number }>;
  axisCarry: number;
  flagMap: Record<Id, Id>;
}

export interface ThemeDef {
  id: Id;
  tokens: Record<string, string>;
  motif: string;
}
