// 콘텐츠 타입: 방침, 활동(등급 판정), 사건, 서술, 장면 (DESIGN.md §3.5)

import type { AgeBand, Hint, Id, Phase, Tier } from './common';
import type { Condition, PersonQuery } from './condition';
import type { Effect, StatKey, WhoRef } from './effect';

/** 장면 레이어 조합. '{place}'는 방침 장소, '{camp}'는 거처, '{weather}'는 지금 날씨로 채운다 */
export interface SceneSpec {
  bg: Id;
  /** 계절 지면 (배경 위에 겹친다). 없으면 장 정의의 groundBySeason으로 채운다. 'none'이면 그리지 않는다 */
  ground?: Id;
  subjects?: Id[];
  overlay?: Id;
}

/** 등급 판정의 힘 항목 */
export type PowerTerm =
  /** 원정대: 사람마다 (1 + 숙련 × skillWeight) × weight */
  | { src: 'crew'; weight: number; skill?: Id; skillWeight?: number }
  /** 물자: perCrew면 (개수 / 원정대 수, 최대 1) × weight, 아니면 min(개수, cap) × weight */
  | { src: 'goods'; id: Id; weight: number; perCrew?: boolean; cap?: number }
  | { src: 'stat'; id: StatKey; weight: number }
  | { src: 'when'; when: Condition[]; value: number }
  | { src: 'leader'; skill?: Id; trait?: Id; weight: number }
  | { src: 'const'; value: number };

/** 숨은 변수: knownWhen이 거짓이면 위험 단서가 '결과를 알 수 없다'가 된다 */
export interface HiddenVar {
  id: Id;
  knownWhen: Condition[];
}

export interface CostEntry {
  weight: number;
  when?: Condition[];
  effects: Effect[];
}

export interface Outcome {
  effects: Effect[];
  narrative?: Id;
  scene?: SceneSpec;
}

export interface ActivityDef {
  power: PowerTerm[];
  difficulty: number;
  hidden?: HiddenVar[];
  outcomes: Record<Tier, Outcome>;
  /** 대가 있는 성공에서 1개, 참사에서 2개를 뽑는다 */
  costs?: CostEntry[];
}

export interface CrewSpec {
  min: number;
  /** 'all': 남겨 둘 인원을 뺀 전부 */
  max: number | 'all';
  /** 마을에 남길 최소 노동 인원 */
  keepHome: number;
  prefer?: Id;
  band?: AgeBand[];
  /** 족장도 원정에 나서는가 (기본 false: 족장은 마을에 남는다) */
  includeChief?: boolean;
  /** 마을 안에서 일하는 무리 (원정이 아니다: 장소·운반 없음). 마을 일손에서만 빠진다 */
  atHome?: boolean;
}

export type PolicyStep = (
  | { kind: 'narrate'; narrative?: Id; effects?: Effect[] }
  | { kind: 'activity'; activity: ActivityDef }
  | { kind: 'eventWindow'; pool: Id[]; chance: number }
  /** 원정지의 짐을 마을로 옮긴다 (운반 한계, 왕복, 남은 고기 처리) */
  | { kind: 'carry' }
) & {
  /** 이 조건이 거짓이면 건너뛴다 (예: 중순 사건에서 사냥을 접었으면 하순 사냥을 건너뜀) */
  when?: Condition[];
};

/** 전략 칸 (DESIGN.md §6.4): 식량(어떻게 먹을까) / 발전(어디로 클까) / 큰 일(두 칸을 모두 쓴다) */
export type PolicySlot = 'food' | 'growth' | 'major';

export interface PolicyTemplate {
  id: Id;
  /** 전략 칸 */
  slot: PolicySlot;
  /** 어느 턴에 나오는 전략인가 (DESIGN.md §B2). 기본 'month'(1년차). 'season' 전략의 단계(early/mid/late)는
   *  초입·한가운데·끝자락의 달이고, 단계마다 그 달 첫 순에 한 번 실행한다 */
  turn?: 'month' | 'season';
  category: Id;
  appearsWhen: Condition[];
  relevance?: { when: Condition[]; add: number }[];
  priority: number;
  cooldown: number;
  once?: boolean;
  /** 버티기 방침: 후보에 늘 하나 들어간다 */
  fallback?: boolean;
  crew?: CrewSpec;
  /** 원정지. 없으면 마을 근처 */
  place?: Id;
  /** 묻어 둔 고기마다 후보를 하나씩 만든다 (원정지 = 은닉물 장소, 가치·거리 순 최대 maxCacheTargets개) */
  bindCache?: boolean;
  leader?: PersonQuery;
  /** 마을 일손 중 장작에 쓰는 비율을 고정한다 (없으면 장작 상황에 따라 자동) */
  firewoodShare?: number;
  /** 이번 달 동안 걸리는 모디파이어 (예: 배급 줄이기) */
  monthMods?: { stat: StatKey; op: 'add' | 'mul'; value: number }[];
  scene: SceneSpec;
  steps: Partial<Record<Phase, PolicyStep[]>>;
  /** 이 방침을 하면 자라는 지식 */
  knowledgeProgress?: Record<Id, number>;
  /** 짓는 일: 고른 달마다 공사가 1달씩 나아가고, months달이 차면 시설이 한 단계 오른다. 다 지으면 후보에서 빠진다 */
  builds?: { facility: Id; months: number };
}

export interface EventOption {
  id: Id;
  requires?: Condition[];
  /** 판정(activity)이 없는 선택지의 위험 단서 (작가가 정한다). 판정이 있으면 엔진이 계산한다 */
  hint?: Hint;
  activity?: ActivityDef;
  effects: Effect[];
  narrative?: Id;
}

export type EventSlot = Phase | 'briefing';

export interface EventDef {
  id: Id;
  /** policy: 방침의 eventWindow pool로만 / village: 어느 방침이든 마을 소식으로 / scheduled: 예약으로만
   *  / briefing: 월초에 조건이 맞으면 나온다 (예약 사건이 없을 때. 예: 애도)
   *  / person: 계절 턴 한가운데의 인물 사건 창 (DESIGN.md §B5.1. 고르는 순서는 R3) */
  scope: 'policy' | 'village' | 'scheduled' | 'briefing' | 'person';
  slots: EventSlot[];
  when: Condition[];
  weight: number;
  cooldown: number;
  once?: boolean;
  actors?: Record<string, PersonQuery>;
  scene: SceneSpec;
  /** 본문 바꾸기: 조건이 맞는 첫 변형의 키를 event.<id>.text 대신 쓴다 (예: 여럿이 죽었을 때) */
  textVariants?: { when: Condition[]; key: string }[];
  speakers?: { who: WhoRef | { seat: Id }; line: string }[];
  options: EventOption[];
}

export interface Narrative {
  id: Id;
  variants: { when?: Condition[]; text: string }[];
  /** 서술이 남기는 사실 (발톱 자국 → 곰 굴 발견) */
  facts?: Effect[];
}
