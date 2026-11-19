# 설계 문서 (M0) — 1장: 구석기 → 신석기 전환

> 상태: **M0 확정 (Q1~Q4 반영)**. 이 문서의 타입은 명세이며 구현 코드가 아니다. M1에서 이 명세를 기준으로 구현하고, 달라지는 부분은 이 문서를 먼저 고친다.

---

## 0. 요약: 이번 설계에서 정한 것

| 항목 | 확정 |
|---|---|
| 게임 길이 | **48턴**, 턴당 평균 45~55초 → 약 35~45분 |
| 시간 표시 | 연도 없음. **"제N대 족장 시절 · 계절"**로 표시한다. 1장은 한 부족이 여러 대에 걸쳐 겪은 **압축된 전설**로 다룬다 (§3.1) |
| 인물 나이 | 숫자 대신 **생애 단계**(아이/청년/장년/노년). 단계 전환 턴 수는 balance에 둔다. 계승은 한 판에 1~2회 (§8) |
| 시대 전환 | **30턴 전후**, 늦어도 33턴 → 전환 후 15턴 이상 플레이 (§7.1) |
| 스타일 | **CSS Modules + CSS 변수 테마 토큰** (장별 테마를 변수 세트로 교체) |
| 테마 | **다크** (숯빛 배경, 뼈색 글자, 불빛 주황 강조, 황토 테두리). 긴 본문 대비 AAA(7:1 이상), 본문 17px 이상 (§16) |
| 결속 0 | 처음 0이 되면 **부족 분할 이벤트**(선택지 3개, 떠난 무리가 새 이웃이 됨, 결속 회복). 두 번째는 패배 (§9.1) |
| 정보 공개 | 확실한 효과는 수치, 불확실한 결과는 **단서 4단계**(구간 대응을 balance에 고정). 선견 인물은 **확률 범위**만 보여 주고 대가가 있다 (§4.3) |
| 문자열 | 데이터에는 본문을 쓰지 않고, **id 규약 키**로 `ko` 리소스를 찾는다 |
| 난수 | sfc32(상태 4개의 uint32)를 GameState 안에 저장 → 저장/불러오기 후에도 재현 |
| 장 id | `ch1` |

---

## 1. 폴더 구조

```
stone-age-chronicle/
├─ docs/
│  └─ DESIGN.md                  # 이 문서
├─ src/
│  ├─ engine/                    # 순수 TS. React/DOM import 금지 (lint 규칙으로 강제)
│  │  ├─ types/                  # GameState, Command, Condition, Effect, 데이터 정의 타입
│  │  ├─ rng/                    # sfc32, 시드 해시, 가중치 선택, shuffle
│  │  ├─ core/
│  │  │  ├─ createGame.ts        # (chapter, StartSource, options) => GameState
│  │  │  ├─ reduce.ts            # (state, command) => newState  ← 유일한 진입점
│  │  │  └─ turn.ts              # 자동 단계(계절 시작, 결산) 처리
│  │  ├─ stats/                  # getStat(state, key): 모디파이어 합산
│  │  ├─ conditions/             # evaluate(cond, ctx)
│  │  ├─ effects/                # apply(effect, ctx) + 미리보기(preview) 생성
│  │  ├─ events/                 # 후보 수집, 가중치, 쿨다운, 예약(followUp), 액터 바인딩
│  │  ├─ actions/                # 덱/손패/버림더미, 행동 카드 실행
│  │  ├─ people/                 # 노화, 사망, 출생, 계승, 혈통, 이름 생성
│  │  ├─ neighbors/              # AI 점수 계산, 분쟁 판정
│  │  ├─ knowledge/ traditions/ regions/
│  │  ├─ endings/                # 결말 판정, 에필로그 조합, ChapterResult 생성
│  │  ├─ chronicle/              # 연대기 문장 선택, 턴 요약
│  │  ├─ save/                   # 직렬화, 버전, 마이그레이션
│  │  └─ index.ts                # 공개 API
│  ├─ data/
│  │  ├─ balance.ts              # 장 공통 수치
│  │  ├─ registry.ts             # 장 목록 등록 (장 추가 = 여기 한 줄 + 폴더)
│  │  ├─ common/
│  │  │  ├─ personTraits.ts      # 인물 특성
│  │  │  ├─ offices.ts           # 인물 직책(족장, 샤먼…)
│  │  │  ├─ namePools.ts         # 이름 생성 음절/어휘 (ko 리소스 참조)
│  │  │  └─ ko/                  # 공통 문자열
│  │  └─ chapters/
│  │     └─ ch1/
│  │        ├─ chapter.ts        # ChapterDefinition
│  │        ├─ balance.ts        # 1장 전용 수치
│  │        ├─ presets.ts        # 시작 프리셋
│  │        ├─ resources.ts axes.ts roles.ts seasons.ts
│  │        ├─ tribeTraits.ts knowledge.ts traditions.ts
│  │        ├─ actions.ts regions.ts neighbors.ts endings.ts epilogue.ts
│  │        ├─ events/           # 주제별 파일: survival.ts, people.ts, neighbors.ts, crisis.ts, transition.ts, tutorial.ts …
│  │        ├─ theme.ts          # 팔레트 토큰, 모티프 id
│  │        └─ ko/               # 1장 문자열 (events.ts, actions.ts, …)
│  ├─ ui/
│  │  ├─ App.tsx, screens/, components/, icons/ (직접 만든 SVG 컴포넌트)
│  │  ├─ theme/                  # CSS 변수 주입
│  │  ├─ hooks/useGame.ts        # 엔진 호출 + 자동 저장
│  │  └─ debug/                  # import.meta.env.DEV일 때만 번들에 포함
│  ├─ audio/                     # AudioPort 인터페이스 + NoopAudio (구현은 나중에)
│  └─ i18n/                      # t(key, params), 누락 키 경고
├─ tools/
│  ├─ sim.ts                     # npm run sim
│  └─ validateContent.ts         # npm run validate:content
└─ (테스트는 *.test.ts로 대상 옆에 둔다)
```

---

## 2. 핵심 타입

표기 규칙: `XxxId`는 모두 `string` 별칭이다. id 유효성은 엔진 타입이 아니라 콘텐츠 검증기가 확인한다. 이렇게 해야 장마다 자원과 축을 바꿀 수 있다.

### 2.1 GameState

```ts
interface GameState {
  saveVersion: number;              // 세이브 포맷 버전 (마이그레이션용)
  chapterId: ChapterId;
  seed: string;
  rng: [number, number, number, number];   // sfc32 상태
  turn: number;                     // 1부터 (내부용. 화면에는 족장의 대와 계절만 보인다)
  season: SeasonId;                 // chapter.seasons[(turn-1) % n]
  reign: number;                    // 족장의 대(代). 1부터, 계승이 일어날 때마다 +1 (§3.1)
  reignStartTurn: number;           // "제2대 족장 시절의 세 번째 겨울" 같은 표현에 쓴다
  eraId: EraId;                     // 'paleolithic' | 'neolithic' (데이터)
  phase: Phase;

  tribe: Tribe;
  people: Record<PersonId, Person>; // 죽은 인물도 남긴다 (혈통 기록)
  neighbors: Record<NeighborId, NeighborState>;
  regions: { current: RegionId; discovered: RegionId[]; state: Record<RegionId, RegionState> };
  knowledge: KnowledgeId[];
  traditions: Record<TraditionSlotId, { id: TraditionId; adoptedTurn: number } | null>;

  flags: Record<FlagId, number>;    // 값 = 설정된 턴 (경과 턴 조건에 사용)
  counters: Record<CounterId, number>;

  deck: { draw: CardInstance[]; discard: CardInstance[]; hand: CardInstance[]; playsLeft: number };
  events: {
    pending: EventInstance[];       // 이번 턴에 해결해야 할 이벤트 (앞에서부터)
    scheduled: ScheduledEvent[];    // followUp 예약
    history: Record<EventId, { count: number; lastTurn: number }>;
  };
  delayed: ScheduledEffect[];       // 이벤트 없이 몇 턴 뒤 발동하는 효과
  modifiers: ActiveModifier[];      // 기한 있는 임시 모디파이어

  chronicle: ChronicleEntry[];
  turnLog: LogEntry[];              // 이번 턴의 변화 기록 → 요약, 애니메이션, 연대기 후보
  ending: EndingRecord | null;
}

type Phase = 'event' | 'action' | 'ended';
// 'season_start'와 'resolution'은 reduce 안에서 자동으로 지나가므로 상태에 남지 않는다.

interface Tribe {
  nameKey: string;                  // 부족 이름 (생성 또는 선택)
  traits: TribeTraitId[];           // 시작 시 2개
  population: number;
  roles: Record<RoleId, number>;    // 합계 = population (엔진이 보정)
  resources: Record<ResourceId, number>;   // food, tools, lore, cohesion
  axes: Record<AxisId, number>;     // -100..100
  lifestyle: LifestyleId;           // 'nomadic' | 'settled' (데이터)
  growth: number;                   // 인구 증가 누적 게이지
  hunger: number;                   // 연속 식량 부족 턴 수
}
```

### 2.2 Person (인물 + 혈통)

```ts
interface Person {
  id: PersonId;
  name: string;                     // 생성된 이름 (원문 저장 — 세이브 간 안정성)
  sex: 'f' | 'm';
  stage: LifeStageId;               // 'child' | 'youth' | 'adult' | 'elder' (데이터)
  stageTurns: number;               // 현재 단계에 머문 턴 수
  office: OfficeId | null;          // chief, shaman, hunt_leader, elder, artisan …
  traits: PersonTraitId[];          // 1~2개
  relation: number;                 // 족장과의 관계 -100..100 (족장 본인은 0)
  parents: [PersonId | null, PersonId | null];
  bloodline: BloodlineId;           // 족장 혈통 추적용
  alive: boolean;
  bornTurn: number;                 // 프리셋 인물은 0 이하
  bornReign: number;
  death?: { turn: number; reign: number; causeKey: string };
  ambition?: number;                // 계승에서 밀린 후보의 불만 (0..100)
}
```

생애 단계 정의(`LifeStageDef`)는 장 데이터에 둔다: `{ id, nextStage, turnsToNext, canHoldOffice, canBeChief, deathHazard }`. 단계를 하드코딩하지 않으므로, 이후 장에서 단계를 늘리거나 템포를 바꿀 수 있다.

부족 인구(`population`)는 이름 없는 다수다. 이름 있는 인물 4~8명은 그와 별도로 관리한다(인물은 인구 수에 포함되지만 역할 배분에는 영향을 주지 않는다는 **가정**). 인물이 8명을 넘으면 출생을 막고, 4명 아래로 내려가면 "새 얼굴" 이벤트 가중치를 올린다.

### 2.3 NeighborState, Region

```ts
interface NeighborState {
  id: NeighborId;
  origin: 'defined' | 'splinter';   // splinter = 우리에게서 갈라져 나간 무리 (§9.1)
  name?: string;                    // splinter는 생성된 이름을 저장
  defId: NeighborId;                // 성격·가중치를 가져올 정의 (splinter는 템플릿 id)
  met: boolean;
  relation: number;                 // -100..100
  strength: number;                 // 추상 전력 (인구+도구 합성)
  stress: number;                   // 0..100 굶주림/압박 (AI 판단 입력)
  status: NeighborStatus;           // 'unknown'|'met'|'friendly'|'allied'|'kin'(혼인)|'hostile'|'truce'|'absorbed'|'dominant'
  known: string[];                  // 밝혀진 정보 키 (성격, 관습 등)
  lastActionTurn: number;
}

interface RegionDef {               // 좌표 없음. 맵 확장 시 좌표는 별도 레이어에서 regionId로 붙인다
  id: RegionId;
  depth: number;                    // 시작 지역에서 몇 번 떨어졌나 (먼 땅 판정. 거리 계산 아님)
  revealedFrom: RegionId[];         // 이 지역에서 탐색해야 발견 가능
  food: Record<SeasonId, number>;   // 채집/사냥 배율
  danger: number;                   // 0..3
  specials: string[];               // 'obsidian', 'salt', 'river', 'cave' …
  neighbors: NeighborId[];          // 이 지역 근처에 사는 부족
  settleable: boolean;
  tags: string[];
}

interface RegionState { depletion: number; }   // 오래 머물면 쌓이고 떠나면 회복 → 유랑의 이유
```

### 2.4 Command (플레이어와 AI의 공통 입력)

```ts
type Command =
  | { type: 'chooseOption'; eventInstanceId: string; optionId: string }
  | { type: 'setRoles'; roles: Record<RoleId, number> }
  | { type: 'playAction'; cardInstanceId: string; personId?: PersonId; target?: TargetRef }
  | { type: 'endActionPhase' }                      // = 턴 종료 → 결산 → 다음 턴 시작
  | { type: 'unlockKnowledge'; knowledgeId: KnowledgeId }
  | { type: 'adoptTradition'; slotId: TraditionSlotId; traditionId: TraditionId }
  | { type: 'neighborAct'; actor: NeighborId; target: 'player' | NeighborId; act: DiplomacyAct }
  | { type: 'debug'; op: DebugOp };                 // DEV 빌드에서만 허용

type DiplomacyAct = 'gift' | 'trade' | 'marriage' | 'shareKnowledge' | 'threaten' | 'raid' | 'truce' | 'absorb';
```

- `reduce(state, cmd)`는 **새 상태 + 거부 사유**를 돌려준다: `{ state, error?: string }`. 잘못된 커맨드는 상태를 바꾸지 않는다.
- 플레이어의 "이웃 방문" 같은 행동 카드와 AI의 `neighborAct`는 **같은 외교 해석 함수**로 처리된다. AI가 플레이어를 대상으로 행동하면 대응 이벤트 카드가 `pending`에 들어간다(예: 습격 예고).

### 2.5 ChapterDefinition

```ts
interface ChapterDefinition {
  id: ChapterId;
  eras: EraDef[];                   // 시대 범위: paleolithic → neolithic
  resources: ResourceDef[];         // id, 범위, 표시 순서, 아이콘 id, 0일 때 결과
  axes: AxisDef[];                  // id, 양끝 라벨 키, 극단 임계값
  roles: RoleDef[];                 // 사냥/채집/제작/의례/경계
  seasons: SeasonDef[];             // 순서와 계절 효과
  lifeStages: LifeStageDef[];       // 아이/청년/장년/노년
  timeDisplay: { mode: 'reign' };   // 1장: "제N대 족장 시절 · 계절". 이후 장에서 다른 표기 가능
  lifestyles: LifestyleDef[];
  scale: { labelKey: string };      // '무리' → '부족' (사회 규모 이름은 데이터)
  turnLimit: number;
  balance: ChapterBalance;
  startPresets: StartPreset[];
  importFromPrevious?: ImportRule;  // (b) 이전 장 결과로 시작. 1장은 없음
  content: {
    events: EventDef[]; actions: ActionCardDef[]; knowledge: KnowledgeDef[];
    traditions: TraditionDef[]; traditionSlots: TraditionSlotDef[];
    tribeTraits: TribeTraitDef[]; regions: RegionDef[]; neighbors: NeighborDef[];
    endings: EndingDef[]; epilogue: EpilogueFragment[];
  };
  theme: ThemeDef;
}

type StartSource =
  | { kind: 'preset'; presetId: string; tribeTraits: TribeTraitId[]; seed: string }
  | { kind: 'previous'; result: ChapterResult; seed: string };
```

### 2.6 ChapterResult (다음 장에 넘기는 JSON)

```ts
interface ChapterResult {
  resultVersion: number;
  chapterId: ChapterId;
  ending: { id: EndingId; kind: 'victory' | 'defeat' | 'survival' };
  powerSeeds: { path: PowerPath; weight: number }[];   // 'conquest'|'faith'|'trade'|'culture'|'alliance'|'knowledge'|'exploration'
  seed: string; turnsPlayed: number; reigns: number;
  tribe: { nameKey: string; traits: TribeTraitId[]; population: number;
           resources: Record<ResourceId, number>; axes: Record<AxisId, number>; lifestyle: LifestyleId };
  knowledge: KnowledgeId[];
  traditions: TraditionId[];
  keyFlags: FlagId[];               // 데이터에서 carryOver: true로 표시한 플래그만
  region: { current: RegionId; discovered: RegionId[] };
  people: Person[];                 // 살아 있는 인물
  lineage: LineageRecord[];         // 죽은 인물 포함 최소 정보 (id, name, parents, office, death)
  neighbors: { id: NeighborId; relation: number; status: NeighborStatus; strength: number }[];
  chronicle: ChronicleEntry[];
  epilogueKeys: string[];
}
```

`importFromPrevious`는 데이터로 쓴 **매핑 규칙**이다(자원 이름 변경과 배율, 축 이어받기 비율, 키 플래그를 새 장 플래그로 변환하는 표). 테스트: `ch1 결과 → (테스트용 가짜 2장 정의) → createGame` 왕복이 성공해야 한다(M6).

### 2.7 카드 종류별 정의 타입 (요약)

```ts
interface ActionCardDef {
  id: ActionId; tags: string[];
  copies: number;                   // 덱에 들어가는 장수
  requires?: Condition[];           // 손에 들어와도 조건이 안 되면 잠김 표시
  cost?: Effect[];                  // 사용 즉시 지불 (공짜 금지 → 검증기가 검사)
  assign?: { required: boolean; prefer?: PersonQuery };   // 인물 배정
  target?: 'region' | 'neighbor';
  effects: Effect[];
  exhaust?: boolean;                // 1회 사용 후 덱에서 제거
}

interface KnowledgeDef {
  id: KnowledgeId; eraId: EraId; cost: number;            // 전승 소모
  prereqs: KnowledgeId[]; requires?: Condition[];
  exclusiveWith?: KnowledgeId[];
  grants: { addCards?: ActionId[]; modifiers?: ModifierDef[]; setFlags?: FlagId[] };
}

interface TraditionSlotDef { id: TraditionSlotId; opensWhen: Condition[]; }
interface TraditionDef {
  id: TraditionId; slotId: TraditionSlotId; requires?: Condition[];
  modifiers: ModifierDef[];         // 상시 효과
  axisDrift?: { axis: AxisId; perTurn: number }[];        // 정체성을 서서히 끌어당긴다
  onAdopt?: Effect[];
}

interface TribeTraitDef  { id; modifiers: ModifierDef[]; startEffects?: Effect[]; exclusiveWith?: TribeTraitId[] }
interface PersonTraitDef { id; modifiers: ModifierDef[]; opposites?: PersonTraitId[]; inheritChance: number }

interface NeighborDef {
  id: NeighborId; homeRegion: RegionId;
  personality: 'warlike' | 'trader' | 'reclusive' | 'spiritual';
  weights: Partial<Record<DiplomacyAct | 'idle', number>>;  // AI 성향 가중치
  startStrength: number; startRelation: number;
  customs: string[];                // 고유 관습 (특정 선택지에 반응)
}
```

### 2.8 모디파이어와 스탯 (데이터 주도의 핵심 지렛대)

부족 특성, 인물 특성, 지식, 전통, 지역, 임시 효과는 모두 같은 형태의 모디파이어로 수치에 영향을 준다.

```ts
interface ModifierDef {
  stat: StatKey;                    // 'yield.hunt', 'yield.gather', 'consume.food', 'actions.perTurn',
                                    // 'storage.food', 'conflict.power', 'migrate.cost', 'lore.gain' …
  op: 'add' | 'mul';
  value: number;
  when?: Condition[];               // 예: 겨울에만
  sourceKey?: string;               // UI 툴팁("왜 이 값인가")
}
```

**역할·소비·저장도 데이터다 (M1에서 추가)**: 엔진은 역할 id(`gather`, `hunt` 등)를 모른다. 역할마다 `outputs`(자원, 1인당 스탯, 고갈 영향, 변동 폭, 보유 자원 보너스)를 정의하고, 계절 소비와 마모는 `balance.upkeep`, 저장 상한과 부패는 `balance.storage`, 굶주림과 결속에 쓰는 자원은 `balance.starvation.resource`와 `balance.cohesionResource`로 지정한다. 족장 직책도 `OfficeDef.isChief`로 찾는다. 다음 장에서 자원이나 역할이 바뀌어도 엔진은 그대로다.

`getStat(state, key)`는 `base(balance) → add 합 → mul 곱` 순서로 계산하고, 각 항목의 출처 목록을 함께 돌려준다(툴팁과 디버그에 사용). 새 스탯 키는 balance에 기본값을 추가하는 것만으로 생긴다.

---

## 3. 턴 처리 순서 (결정론적, 이 순서대로 구현한다)

```
[A] 계절 시작  (endActionPhase 직후 자동, 또는 게임 생성 직후)
  A1. turn += 1, season 갱신
  A2. 만료된 임시 모디파이어 제거
  A3. 계절 효과 적용 (seasons[].effects — 예: 겨울 '추위' 모디파이어 부여)
  A4. 전통 axisDrift 적용
  A5. 이웃 AI 단계: 이웃 id 오름차순으로 점수 계산 → neighborAct 생성 → 해석
      (플레이어 대상 행동은 대응 이벤트를 '강제 후보'로 등록)
  A6. 이벤트 뽑기 (§5.3) → events.pending
  A7. 턴 시작 스냅샷 저장 (요약에서 '이번 계절 변화'를 계산하기 위해)
  → pending이 있으면 phase='event', 없으면 [C]로

[B] 이벤트 단계: chooseOption마다 효과 즉시 적용. pending이 비면 [C]

[C] 행동 단계 시작
  C1. 손패를 handSize까지 채운다 (draw 소진 시 discard 셔플)
  C2. playsLeft = getStat('actions.perTurn') (최소 1, 최대 4)
  → phase='action'. playAction, setRoles, unlockKnowledge, adoptTradition 가능
  → endActionPhase로 [D]

[D] 결산 (자동)
  D1. 남은 손패 → discard
  D2. 생산: 역할별 산출 (채집 → 사냥(RNG) → 제작 → 의례) × 지역 계절 배율 × 고갈
  D3. 소비: 식량 = population × consume.food (계절 배율)
  D4. 부패와 저장 상한: 초과분 버림, 저장분 spoilRate만큼 감소
  D5. 굶주림: 식량이 음수면 0으로 만들고 hunger+1, 결속 감소. hunger ≥ 2면 인구 손실과 '굶주림' 강제 이벤트 예약
  D6. 인구: 충분히 먹었고 결속이 기준 이상이면 growth 누적 → 임계치 도달 시 +1
  D7. 지연 효과(delayed) 중 이번 턴 도래분을 등록 순서대로 실행
  D8. 지역 고갈 갱신 (현재 지역 +, 나머지 회복)
  D9. 인물: stageTurns+1 → 단계 전환 → 사망 판정(id 순) → 출생 판정 → 족장이 없으면 '계승' 강제 이벤트 예약
      (계승 이벤트에서 새 족장이 정해지면 reign+1, reignStartTurn 갱신)
  D10. 이웃 상태 갱신: strength 성장, stress, 관계 자연 회귀(0 방향 소량)
  D11. 결말 판정 (§9): 패배 → 승리 → 시간 종료 순
  D12. 연대기 문장 1개 확정 (§10)
  D13. turnLog를 요약으로 굳히고 [A]로 (UI는 여기서 자동 저장)
```

### 3.1 시간 표시: 족장의 대(代)와 계절

- 화면에는 연도와 턴 번호를 보이지 않는다. 상단 바에는 **"제2대 족장 시절 · 겨울"**이 표시된다(좁은 화면에서는 "제2대 · 겨울").
- **대 = 족장의 대수**. 첫 족장의 시절이 제1대이고, 계승이 일어날 때마다 +1. 한 판은 보통 제2~3대에서 끝난다.
- 연대기와 본문은 대 기준 서수를 쓴다: `{seasonOrdinal}` → "제2대 족장 시절의 세 번째 겨울", `{reignName}` → "마루의 시절".
- 남은 시간은 숫자 대신 **이야기 단서**로 보인다: 40턴 이후 "전설의 끝이 가까워진다". 디버그 패널에서만 턴 번호를 보인다.
- 1장은 실제 역사의 수천 년을 몇 대의 전설로 **압축**한 것이다. 그래서 한 족장의 시절 안에 지식과 시대가 바뀌어도 어색하지 않다. 튜토리얼 첫 이벤트 본문에서 이 틀("노래로 전해지는 이야기")을 밝힌다. 서술 규칙은 §17.

**난수 소비 규칙**: 난수는 정해진 단계에서 정해진 순서로만 뽑는다. UI 미리보기나 디버그 보기는 상태의 RNG를 복제해서 쓰고 원본은 건드리지 않는다. 이 규칙이 있어야 같은 시드 + 같은 커맨드 열이면 같은 결과가 나온다.

---

## 4. 조건/효과 언어 명세

### 4.1 Condition

```ts
type Num = { min?: number; max?: number };    // 범위 표기 (둘 다 포함). 연산자 문자열 대신 이것만 쓴다

type Condition =
  // 부족 상태
  | { type: 'resource'; key: ResourceId } & Num
  | { type: 'population' } & Num
  | { type: 'role'; role: RoleId } & Num
  | { type: 'axis'; axis: AxisId } & Num
  | { type: 'lifestyle'; is: LifestyleId }
  | { type: 'tribeTrait'; id: TribeTraitId }
  // 진행
  | { type: 'season'; in: SeasonId[] }
  | { type: 'turn' } & Num
  | { type: 'reign' } & Num
  | { type: 'era'; is: EraId }
  | { type: 'flag'; id: FlagId; present?: boolean; sinceTurns?: Num }  // present 기본값 true
  | { type: 'counter'; id: CounterId } & Num
  | { type: 'eventSeen'; id: EventId; present?: boolean }
  // 체계
  | { type: 'knowledge'; id: KnowledgeId; has?: boolean }
  | { type: 'tradition'; id: TraditionId }
  | { type: 'region'; current?: RegionId; special?: string; tag?: string; depth?: Num }
  | { type: 'regionDiscovered'; id: RegionId }
  // 인물
  | { type: 'person'; match: PersonQuery; count?: Num }   // count 기본값 {min:1}
  | { type: 'chief'; match: PersonQuery }
  | { type: 'actor'; slot: string; match: PersonQuery }   // 이벤트에 바인딩된 인물
  // 이웃
  | { type: 'neighbor'; id: NeighborId | 'any' | 'actor'; met?: boolean;
      relation?: Num; status?: NeighborStatus[]; strengthVsUs?: Num; count?: Num }
  // 논리
  | { type: 'all'; of: Condition[] }
  | { type: 'any'; of: Condition[] }
  | { type: 'not'; of: Condition };

interface PersonQuery {
  office?: OfficeId; trait?: PersonTraitId; stage?: LifeStageId[]; relation?: Num;
  alive?: boolean;                  // 기본값 true
  bloodline?: 'chief';              // 족장 혈통인가
  notActor?: string;                // 다른 슬롯에 이미 바인딩된 인물 제외
}
```

- 조건 목록은 기본이 AND다. OR는 `any`로 쓴다.
- 조건 평가에는 **난수를 쓰지 않는다**. 확률은 이벤트 가중치나 효과(`random`, `check`)에서만 다룬다. 그래야 "이 선택지가 왜 잠겼나"를 항상 설명할 수 있다.
- 평가기는 결과와 함께 **실패한 조건 목록**을 돌려준다. 잠긴 선택지의 힌트를 자동으로 만들 때 쓴다.

### 4.2 Effect

```ts
type Effect =
  // 수치
  | { type: 'resource'; key: ResourceId; delta: number }
  | { type: 'population'; delta: number }            // 역할 배분은 balance의 손실 우선순위로 자동 보정
  | { type: 'axis'; axis: AxisId; delta: number }
  | { type: 'counter'; id: CounterId; delta: number }
  | { type: 'flag'; id: FlagId; set: boolean }
  | { type: 'modifier'; mod: ModifierDef; duration: number }   // 임시 모디파이어 (턴 수)
  // 체계
  | { type: 'unlockKnowledge'; id: KnowledgeId }
  | { type: 'addCard'; id: ActionId; count?: number } | { type: 'removeCard'; id: ActionId }
  | { type: 'discoverRegion'; id: RegionId | 'next' }   // 'next' = 현재 지역에서 발견 가능한 것 중 RNG
  | { type: 'migrate'; to: RegionId | 'chosen' }
  | { type: 'setLifestyle'; to: LifestyleId }
  | { type: 'era'; to: EraId }
  // 인물
  | { type: 'person'; ref: PersonRef; change: PersonChange }
  | { type: 'spawnPerson'; template: PersonTemplate }
  | { type: 'succession'; candidateId: PersonId }    // 계승 이벤트 전용
  // 이웃
  | { type: 'relation'; neighbor: NeighborId | 'actor'; delta: number }
  | { type: 'neighborStatus'; neighbor: NeighborId | 'actor'; to: NeighborStatus }
  | { type: 'revealNeighbor'; neighbor: NeighborId | 'actor'; info: string }
  | { type: 'conflict'; neighbor: NeighborId | 'actor'; stance: 'attack' | 'defend';
      outcomes: Record<'triumph' | 'win' | 'loss' | 'rout', Effect[]> }
  // 시간과 불확실성
  | { type: 'schedule'; eventId: EventId; delay: number; chance?: number }   // = followUp
  | { type: 'delayed'; delay: number; effects: Effect[] }
  | { type: 'random'; outcomes: { weight: number; effects: Effect[]; labelKey?: string }[] }
  | { type: 'check'; power: StatKey | Formula; difficulty: number;          // 성공 확률 = 로지스틱
      success: Effect[]; failure: Effect[] }
  | { type: 'if'; when: Condition[]; then: Effect[]; else?: Effect[] }
  // 서사
  | { type: 'chronicle'; key: string; importance: number }
  | { type: 'endChapter'; endingId: EndingId };

type PersonRef = 'chief' | { actor: string } | { id: PersonId } | { query: PersonQuery; pick: 'random' | 'oldest' | 'youngest' };
type PersonChange = { relation?: number; addTrait?: PersonTraitId; removeTrait?: PersonTraitId;
                      office?: OfficeId | null; ambition?: number; kill?: string /* 사인 키 */ };
```

- 효과는 목록 순서대로 적용한다. 자원은 범위로 자른다(clamp). 범위를 넘어 버려진 양은 turnLog에 남긴다.
- 모든 효과 적용은 `LogEntry`를 만든다. UI 애니메이션, 턴 요약, 연대기가 이 로그 하나를 공유한다.
- **미리보기(preview)**: 엔진이 선택지의 효과를 정적으로 훑어 UI 표시용 목록을 만든다.
  - 확정 효과: `식량 −8`, `붉은여울 관계 ▲`, `나눔 ◀` 처럼 수치나 방향으로 표시한다.
  - `random`과 `check` 안의 효과: 확률 구간 단서로 표시한다(§4.3).
  - `schedule`과 `delayed`: "언젠가 돌아올 것이다" 같은 표식만 보여 주고 내용은 숨긴다.

### 4.3 불확실성 표시 (정보 공개 수준)

단서 4단계와 확률 구간의 대응은 **balance에 고정**한다. 엔진과 UI는 이 표만 읽는다.

```ts
// src/data/balance.ts (명세)
uncertainty: {
  tiers: [
    { id: 'sure',     minP: 0.80, key: 'hint.sure' },     // 거의 확실하다
    { id: 'fair',     minP: 0.50, key: 'hint.fair' },     // 해볼 만하다
    { id: 'risky',    minP: 0.20, key: 'hint.risky' },    // 위험해 보인다
    { id: 'reckless', minP: 0.00, key: 'hint.reckless' }, // 무모하다
  ],
  foresightBucket: 0.20,   // 선견 인물이 보여 주는 범위의 폭
}
```

**선견(foresight)**: 인물이 정보를 준다는 감각을 살리되, 지배적인 특성이 되지 않게 세 겹으로 제한한다.
1. **범위로만 보인다**: 정확한 값이 아니라 20% 폭의 구간(예: "열에 넷에서 여섯")만 보여 준다. 구간 경계는 고정 격자(0~20, 20~40…)라 실제 확률을 역산할 수 없다.
2. **인물이 쉬어야 한다**: 이번 계절에 그 인물을 행동 카드에 배정하면 선견이 꺼진다. 정보와 노동 사이의 기회비용이다.
3. **특성 자체에 대가가 있다**:
   - 꿈꾸는(dreamer): 의례 보정 +, 하지만 '흉몽' 이벤트(결속 −, 새로움 쪽 선택 시 반발)의 대상이 되고 사냥·분쟁 배정 시 −보정.
   - 노련한(seasoned): 노년에만 얻으므로 수명이 짧다. 새로움 쪽 선택을 막는 '옛 방식' 선택지를 자주 끌어온다.

시뮬레이터는 **특성별 승률 리포트**로 선견이 지배적인지 감시한다(§12).

- `random`의 결과 내용 자체는 `labelKey`가 있는 것만 "좋은 일 / 나쁜 일이 있을 수 있다"는 형태로 보여 준다.

---

## 5. 이벤트 스키마 확정안

### 5.1 정의

```ts
interface EventDef {
  id: EventId;
  tags: string[];                   // 'survival' | 'people' | 'neighbor' | 'crisis' | 'transition' | 'tutorial' …
  trigger: {
    seasons?: SeasonId[]; minTurn?: number; maxTurn?: number; eras?: EraId[];
    conditions?: Condition[];
  };
  mode: 'pool' | 'forced' | 'followUp';
  //  pool: 가중치로 무작위 / forced: 조건이 맞으면 반드시 (위기, 계승, 시대 전환)
  //  followUp: schedule로만 등장 (풀에서 뽑히지 않음)
  weight: number;
  weightMods?: { when: Condition[]; mul: number }[];
  cooldown: number;                 // 턴
  once: boolean;
  priority?: number;                // forced끼리의 순서 (높을수록 먼저)
  actors?: ActorSlot[];             // 인물 바인딩
  neighborActor?: { match: Condition };   // 이웃 바인딩 (예: 관계 -30 이하인 아무 부족)
  textVariants?: { id: string; when: Condition[] }[];   // 처음 맞는 것을 사용, 없으면 기본 본문
  options: EventOptionDef[];        // 2~4개 (잠긴 것 포함)
}

interface ActorSlot { slot: string; match: PersonQuery; optional?: boolean }   // 필수 슬롯을 못 채우면 발생 불가

interface EventOptionDef {
  id: string;
  requires?: Condition[];           // 미충족 → 흐리게 + 잠금 힌트
  hiddenUnless?: Condition[];       // 미충족 → 아예 숨김 (말이 안 되는 경우에만. 검증기가 남용을 경고)
  lockHintKey?: string;             // 없으면 실패 조건으로 자동 생성 ("지식 필요: 약초 지식")
  effects: Effect[];
  setFlags?: FlagId[]; clearFlags?: FlagId[];
  followUps?: { eventId: EventId; delay: number; chance?: number }[];
  chronicle?: { importance: number };     // 문장 키는 규약 (§5.2)
}
```

### 5.2 문자열 키 규약 (데이터에는 본문을 쓰지 않는다)

```
event.<id>.title
event.<id>.text                    // 기본 본문
event.<id>.text.<variantId>        // 변형 본문
event.<id>.opt.<optionId>          // 선택지 라벨 (15자 이내)
event.<id>.opt.<optionId>.result   // 선택 후 결과 문장 (선택적)
event.<id>.opt.<optionId>.chron    // 연대기 문장 템플릿 (선택적)
action.<id>.name / .text / .chron
knowledge.<id>.name / .text   tradition.<id>.name / .text   …
```

- 템플릿 변수: `{chief}`, `{actor:healer}`, `{neighbor}`, `{tribe}`, `{region}`, `{seasonOrdinal}`(예: "제2대 족장 시절의 세 번째 겨울"), `{reignName}`(예: "마루의 시절").
- 검증기가 누락 키, 사용되지 않는 키, 15자 초과 라벨, 본문 문장 수(2~4)를 검사한다.

### 5.3 이벤트 뽑기 알고리즘

1. **도래한 followUp**: `scheduled` 중 이번 턴에 도래한 것. 예약 턴 순, 같으면 등록 순. `chance`는 이 시점에 판정하고, trigger 조건도 다시 확인한다(조건이 안 맞으면 버림).
2. **forced**: 조건이 맞는 것을 priority 순으로.
3. **pool**: 조건, 계절, 시대, 쿨다운, once, 액터 바인딩을 모두 통과한 후보를 모아 가중치로 뽑는다.
   - 1장은 반드시 뽑는다(후보가 있을 때). 2장째는 `secondEventChance`(35%) 확률로 뽑는다.
   - 같은 tag는 연속 2턴까지만 허용한다(태그 피로).
4. 이번 턴 총 개수는 `maxEventsPerTurn`(2)로 제한한다. 넘친 1·2번 항목은 다음 턴으로 미루고, pool은 버린다. 단 **계승과 멸족 직전 위기는 제한을 무시**한다.

---

## 6. 밸런스 초안 (모두 balance 파일로 간다)

### 6.1 게임 길이와 템포

| 항목 | 값 | 근거 |
|---|---|---|
| turnLimit | 48 | 턴당 45~55초 × 48 ≈ 36~44분 |
| 경고 | 40턴부터 "전설의 끝이 가까워진다" 표시 | 숫자 없이 단서로 |
| 생애 단계 | §8 표 | 한 판에 계승 1~2회 |
| 시대 전환 | 가장 이르면 26턴, 목표 중앙값 30턴, 늦어도 33턴 | 전환 후 15턴 이상 (§7.1). 시뮬레이터로 검증 |
| 이벤트/턴 | 평균 1.3장 | |
| 손패 / 행동 수 | 5장 / 기본 2장 | 결속 ≥ 70이면 +1, 결속 < 25면 −1, 특성·전통으로 ±1, 범위 1~4 |

### 6.2 자원

| 자원 | 범위 | 시작 | 비고 |
|---|---|---|---|
| 인구 | 0~ (소프트 상한은 지역 수용력) | 12 | 0이면 멸족 |
| 식량 | 0~저장 상한 | 30 | 상한: 유랑 = 인구×4, 정착 = 인구×8 (토기 +50%). 계절마다 10% 부패 |
| 도구 | 0~40 | 8 | 계절마다 인구 10명당 1 마모 |
| 전승 | 0~ | 0 | 지식 해금에 소모. 전승 결말은 소모와 무관한 '위대한 이야기' 카운터로 판정 → 둘 사이에 긴장이 생긴다 |
| 결속 | 0~100 | 60 | 처음 0이 되면 부족 분할 이벤트, 두 번째는 분열 패배 (§9.1) |

### 6.3 생산 (역할 1명당, 계절 배율 전)

| 역할 | 산출 | 비고 |
|---|---|---|
| 채집 | 식량 1.6 | 계절 배율: 봄 1.2 / 여름 1.4 / 가을 1.3 / 겨울 0.3 |
| 사냥 | 식량 2.0 × (1 + 도구 보정) | 결과 ±35% RNG, 계절 배율 봄 0.9 / 여름 1.0 / 가을 1.2 / 겨울 0.8, 부상 위험 |
| 제작 | 도구 0.5 | |
| 의례 | 전승 0.5, 결속 +0.3 | |
| 경계 | 없음 | 분쟁력, 야수/습격 피해 경감 |

- 소비: 1인당 식량 1.0. 겨울은 1.3(불 다루기를 알면 1.2).
- 기준선: 인구 12명이 채집 5, 사냥 4, 제작 1, 의례 1, 경계 1이면 봄에 약 +7, 겨울에 약 −8. 겨울 대비를 위해 저장, 이주, 의례 중 하나를 골라야 하는 긴장을 노린 수치다.
- 인구 증가: 식량 소비를 다 채우고 결속 ≥ 40이면 growth +인구×0.04 → 1.0마다 +1명. 연간 약 +2명이고, 장 종료 시 무난하면 20~25명.
- 굶주림: 부족분 1당 결속 −1. hunger 2턴 연속이면 인구 −10%.
- 고갈: 같은 지역에 머문 턴마다 산출 −3%(최대 −30%). 떠나면 턴당 5%씩 회복한다. 정착하면 고갈 대신 "땅 지력" 시스템으로 바뀐다(M4에서 상세화).

### 6.4 가치 축

- 범위 −100~100, 시작 0. 부족 특성에 따라 ±15에서 시작할 수 있다.
- 선택지당 보통 ±5~10, 큰 결정은 ±15~25.
- 극단 임계값 ±70: 해당 극단의 고유 위기 이벤트가 forced로 열린다(쿨다운 8).
- 축 위치가 ±30을 넘으면 그 성향의 이벤트와 전통이 열리기 시작한다(이벤트 가중치 배율).

### 6.5 분쟁 판정

```
우리 힘   = 경계×1.0 + 사냥×0.5 + min(도구, 인구)×0.3 + 결속/20 + 모디파이어
상대 힘   = strength × 지역 위험도 보정
성공 확률 = logistic((우리 − 상대) / conflictScale)   // conflictScale ≈ 4
결과 4단계: triumph / win / loss / rout  (확률 구간으로 나눔)
```
습격당할 때 "도망친다" 같은 선택지가 늘 있어 대응 수단이 보장되고, 경계 역할 배분으로 미리 준비할 수 있다.

### 6.6 지식 비용

전승 수입은 턴당 약 2~3 → 30턴까지 약 60~85, 한 판에 약 100~130. 지식 비용은 10~30으로, 전환 전에 4~5개, 한 판에 7~9개를 연다. 전부 열 수는 없다는 것이 의도다.

---

## 7. 콘텐츠 초안 목록

### 7.1 지식 (17개)

| id | 이름 | 비용 | 선행/조건 | 주요 효과 |
|---|---|---|---|---|
| fire_mastery | 불 다루기 | — | 시작 보유 | 겨울 소비 완화, 기본 카드 |
| stone_knapping | 석기 가공 | 10 | — | 제작 +30%, 카드 '흑요석 다듬기'(흑요석 지역) |
| spear_throwing | 창과 투창 | 15 | 석기 가공 | 사냥 +20%, 분쟁력 +, 카드 '큰 짐승 몰이' |
| rich_speech | 정교한 말 | 10 | — | 이야기 전수 강화, 첫 접촉 선택지 추가 |
| herb_lore | 약초 지식 | 15 | — | 질병 이벤트 치료 선택지, 카드 '약초 캐기' |
| needle_hide | 바늘과 가죽옷 | 15 | 석기 가공 | 겨울 소비 −0.1, 이주 위험 감소 |
| fishing_nets | 그물과 낚시 | 15 | — | 강/호수 지역 채집 +30%, 카드 '그물 놓기' |
| burial_rites | 매장 의례 | 15 | — | 인물 사망 시 결속 손실 반감, 계승 선택지 |
| cave_painting | 동굴 벽화 | 20 | 정교한 말 | 카드 '벽화 그리기'(위대한 이야기 +1의 주 경로) |
| star_reading | 별 읽기 | 20 | 정교한 말 | 다음 계절 이벤트 태그 미리 보기, 먼 땅 탐색 보너스 |
| ancestor_worship | 조상 숭배 | 25 | 매장 의례, 전통 축 ≥ 0 | ⟂ 정령 신앙. 결속 +, 위계 전통 해금, 정착 친화 |
| spirit_faith | 정령 신앙 | 25 | 화합 축 ≥ 0 또는 유랑 축 ≤ 0 | ⟂ 조상 숭배. 이웃 영적 부족과 관계 +, 유랑 친화 |
| seed_cycle | 씨앗의 순환 | 30 | 별 읽기 또는 약초 지식 | **신석기 열쇠**. 정착 시 경작 카드 |
| animal_taming | 짐승 길들이기 | 30 | 창과 투창 | **신석기 열쇠**. 정착 시 가축 / 유랑 시 무리 따라가기 |
| pottery | 토기 | 25 | 불 + (신석기) | 저장 상한 +50%, 부패 감소 |
| weaving | 직조 | 25 | 바늘과 가죽옷 + (신석기) | 교역품, 결속 + |
| pit_house | 움집 짓기 | 25 | 석기 가공 + (신석기) | 정착 결속 +, 겨울 완화 / 유랑이면 '이동식 거처'로 변형 |

**신석기 전환: 30턴 전후로 오게 하는 장치**

| 장치 | 값 (balance) |
|---|---|
| 정상 조건 | 열쇠 지식 1개 + 지식 4개 이상(불 다루기 제외) + 누적 전승(`lore_total` 카운터) 60 이상 + 인구 16명 이상 |
| 가장 이른 턴 | 26 (`transition.minTurn`) — 조건을 일찍 채워도 26턴 전에는 오지 않는다. 대신 "징조" 이벤트(씨앗이 싹튼 자리, 따라오는 새끼 짐승)가 21턴부터 분위기를 깐다 |
| 보류 | "아직은 아니다" 선택지: 3턴 보류, 결속 −8, 한 판에 한 번, 30턴 이하일 때만 |
| 늦어도 | 33턴 (`transition.deadlineTurn`) — 조건을 못 채웠으면 **"이웃의 씨앗"** forced 이벤트가 온다. 이웃이 열쇠 지식을 건네주거나, 대가를 치르고 배우는 길이 열린다. 이 길로 전환하면 이웃 관계 플래그가 남는다 |
| 결과 | 전환 후 15~22턴이 남는다 |

시뮬레이터 목표: 전환 턴 중앙값 28~31, 90%가 33턴 이내. 벗어나면 지식 비용과 전승 산출을 조정한다.

조건이 차면 "**두 갈래 길**" forced 이벤트가 온다: 정착한다 / 유랑을 지킨다 / 아직은 아니다(위 보류 규칙).

### 7.2 전통 (슬롯 4개, 슬롯마다 2~3개 중 택1)

| 슬롯 | 열림 | 선택지 |
|---|---|---|
| 몫 나누기 | 4턴 | **공평한 몫**(나눔 쪽으로 끌림, 굶주림 결속 손실 −50%, 사냥 −5%) / **사냥꾼의 몫**(위계 쪽, 사냥 +15%, 결속 −1/계절) / **장로의 창고**(전통 쪽, 저장 상한 +30%, 부패 −) |
| 결정하는 법 | 지식 3개 또는 12턴 | **모닥불 회의**(나눔, 결속 +, 이벤트에 '회의' 선택지) / **족장의 말**(위계, 행동 +1, 인물 불만 +) / **꿈의 계시**(전통, 샤먼 배정 시 판정 보정) |
| 낯선 이를 대하는 법 | 첫 접촉 후 | **손님의 불**(화합, 관계 상승 +50%) / **경계의 창**(무력, 방어 +, 첫 접촉 관계 −) / **피를 섞는 혼인**(혼인/흡수 조건 완화, 전통 축 −) |
| 땅과 발 | 시대 전환 후 | 정착: **나눠 가꾸는 밭**(나눔) / **씨족의 땅**(위계). 유랑: **계절의 길**(이주 비용 −) / **먼 발자국**(탐색 +, 결속 −) |

교체 비용: 결속 −15, 그리고 6턴 동안 같은 슬롯 재교체 불가.

### 7.3 부족 특성 (10개 중 시작 시 2개 선택. 모두 장점과 약점이 짝을 이룬다)

| id | 이름 | 장점 | 약점 |
|---|---|---|---|
| wolf_kin | 늑대의 후예 | 사냥 +20%, 무력 축 +10 시작 | 채집 −10%, 첫 접촉 관계 −10 |
| seed_hands | 씨앗 줍는 손 | 채집 +20%, 씨앗의 순환 −5 비용 | 사냥 −10% |
| storytellers | 이야기꾼 혈통 | 전승 +25% | 도구 제작 −20% |
| stone_wise | 돌을 아는 손 | 시작 도구 +6, 제작 +20% | 의례 전승 −20% |
| hearth_bound | 큰 불가의 형제들 | 결속 시작 +15, 결속 손실 −20% | 위계 쪽 선택 시 결속 손실 2배 |
| wind_feet | 바람의 발 | 이주 비용 −40%, 탐색 + | 정착 시 결속 −20, 유랑 축 −15 시작 |
| deep_roots | 뿌리 깊은 자들 | 정착 후 산출 +15%, 전통 축 +10 | 이주 비용 +50% |
| river_children | 강의 아이들 | 물가 지역 식량 +25% | 건조 지역 −15% |
| dreamers | 꿈꾸는 자들 | 샤먼 인물로 시작, 의례 +30% | 새로움 쪽 선택 시 결속 손실 |
| many_children | 많은 아이 | 인구 증가 +40% | 식량 소비 +10% |

### 7.4 인물 특성 (공통 14개, 대립 쌍 있음)

용맹한 ⟂ 신중한 / 온화한 ⟂ 야심 많은 / 고집센 ⟂ 귀가 얇은 / 약초에 밝은 / 이야기꾼 / 손재주 / 길눈 밝은 / 꿈꾸는(선견, 대가 있음) / 말솜씨 / 다산 / 병약한 / 노련한(선견, 노년 단계에서만 획득, 대가 있음). 선견의 제한은 §4.3.
각 특성은 (a) 스탯 모디파이어, (b) 이벤트 선택지 해금, (c) 계승 시 성향을 결정한다. 자녀에게 `inheritChance` 확률로 물려준다.

### 7.5 행동 카드 (M2 목표 8종 이상)

- **기본 덱**: 사냥 원정, 채집 나들이, 주변 탐색, 도구 만들기, 모닥불 의례, 이야기 전수, 이웃 방문, 고기 말리기(저장) — 8종
- **지식 해금**: 큰 짐승 몰이, 흑요석 다듬기, 약초 캐기, 그물 놓기, 벽화 그리기, 별 관측
- **정착 분기**: 밭 일구기, 움집 세우기, 토기 굽기, 가축 돌보기
- **유랑 분기**: 계절 이동, 먼 길 정찰, 무리 따라가기
- **역할 배분과의 관계**: 역할 배분은 매 계절 자동으로 나오는 기본 산출이다. 행동 카드는 위험이나 비용을 감수하고 그 계절에 한 번 크게 미는 수단이다(예: 사냥 원정 = 사냥 산출 ×1.6, 부상 판정, 사냥 우두머리를 배정하면 보정).

### 7.6 지역 (7개)

| id | 이름 | depth | 특징 |
|---|---|---|---|
| grey_wolf_hill | 잿빛늑대 언덕 | 0 | 시작. 균형, 동굴 |
| red_ford | 붉은여울 | 1 | 강, 물고기, 붉은여울 사람들 |
| reed_marsh | 갈대늪 | 1 | 채집 풍부, 질병 위험 |
| obsidian_vale | 흑요석 골짜기 | 2 | 흑요석, 위험 2, 검은송곳니 |
| salt_rock | 소금바위 | 2 | 소금(부패 감소, 교역품) |
| mist_wood | 안개숲 | 2 | 사냥, 안개숲 사람들, 영적 |
| beyond_ice | 얼음 너머 들판 | 4 | **가장 먼 땅**. 3에서만 발견 가능 |
| great_river_mouth | 큰강 어귀 | 3 | 정착 최적, 큰뿔 사냥꾼들 |

### 7.7 이웃 부족 (4개)

| id | 이름 | 성격 | 고유 관습 |
|---|---|---|---|
| red_ford_people | 붉은여울 사람들 | 교역 지향 | 물고기와 조개를 선물로 주고받는다. 겨울에 굶주리기 쉽다 |
| black_fang | 검은송곳니 | 호전적 | 힘을 보여야 대화한다. 경계의 창 전통에 호감 |
| mist_folk | 안개숲 사람들 | 은둔/영적 | 낯선 이를 시험한다. 정령 신앙에 호감 |
| great_horn | 큰뿔 사냥꾼들 | 영적 사냥꾼 | 큰 짐승 사냥을 함께하면 혼인을 청한다 |

### 7.8 결말

| id | 종류 | 조건 (초안) | 다음 장 권력의 길 씨앗 |
|---|---|---|---|
| path_lore | 승리 | 위대한 이야기 카운터 ≥ 5 + 이야기를 이을 인물 생존 | 문화, 신앙 |
| path_settle | 승리 | 정착 + 첫 마을 세움 + 이후 8턴 동안 식량 부족 없음 & 결속 ≥ 50 | 교역/경제, 지식 |
| path_union | 승리 | 이웃 3개 이상이 동맹, 혼인, 흡수 상태 | 연합/외교, 정복(무력 흡수 비중에 따라) |
| path_far | 승리 | 유랑 상태로 depth 4 지역 도달 + '새 땅' 이벤트 완료 | 탐험, 교역, 정복 |
| ruin_extinct | 패배 | 인구 0 | — |
| ruin_split | 패배 | 부족 분할을 한 번 겪은 뒤 결속이 다시 0 (§9.1) | — |
| ruin_absorbed | 패배 | 이웃의 흡수 요구 수락, 또는 상대 우위가 극심할 때 분쟁 rout 2회 | — |
| survive_* | 생존 | 48턴 도달. 상태에 따라 3~4종(번성한 무리 / 버틴 무리 / 흩어지기 직전의 무리 …) | 상태에 따라 |

승리 경로는 모두 무력 없이 도달할 수 있다. 대부족의 길은 혼인과 평화 흡수 경로가 있다.

**에필로그 조합**: `EpilogueFragment { id, slot: 'opening'|'axis'|'deed'|'people'|'closing', when: Condition[], priority }`. 슬롯마다 조건을 만족하는 것 중 priority가 가장 높은 1~2개를 이어 붙인다. axis 슬롯은 절대값이 가장 큰 축 두 개를 기준으로 고른다. 같은 결말이라도 축과 플래그 조합에 따라 수십 가지 문단이 나온다.

---

## 8. 인물 시스템 규칙

**생애 단계 (balance 초안)**

| 단계 | 다음 단계까지 | 할 수 있는 것 | 사망 위험 (턴당) |
|---|---|---|---|
| 아이 | 10턴 | 직책 없음, 이벤트 대상만 됨 | 1% (질병 이벤트로 상승) |
| 청년 | 12턴 | 직책 가능, 족장 후보 가능 | 0.5% |
| 장년 | 14턴 | 모든 것 | 0.5% |
| 노년 | (끝) | 모든 것, '노련한' 획득 가능 | 2% + 노년에 머문 턴 × 0.6% |

- 시작 인물 5명: 족장(장년, stageTurns 8), 장로(노년, 4), 사냥 우두머리(장년, 2), 장인 또는 샤먼(특성에 따라 청년이나 장년), 족장의 자식(청년, 6).
- 템포 계산: 시작 족장은 약 6턴 뒤 노년이 되고, 노년 사망 위험이 누적되어 **20~30턴 무렵** 죽을 가능성이 높다(첫 계승). 후계자가 청년이나 장년이면 40턴 이후 두 번째 계승이 일어날 수 있다. 이벤트(사냥 사고, 전염병, 분쟁)로 앞당겨질 수 있다. 시뮬레이터로 "판당 계승 횟수" 분포를 확인한다(목표: 1회 60%, 2회 30%, 0회 10% 이하).
- 출생: 인물 8명 미만이고 짝이 있는 장년 인물이 있으면 턴마다 일정 확률. 아이가 청년이 되면 특성 1개를 얻고 선택지에 등장한다.
- 화면 표시: 숫자 나이 없이 "장년 · 노년이 가까워 보인다" 같은 단서를 함께 보여 준다(다음 단계까지 3턴 이하일 때).
- 계승: 족장이 사망하면 forced 이벤트가 온다. 후보 2~3명(혈통 우선 + 관계 높은 인물)이 서고, 각 선택지는 후보의 특성에 따라 축을 움직인다. 고르지 않은 후보는 `ambition`이 늘고, 일정 값을 넘으면 후속 이벤트(이탈, 반목, 도전)가 예약된다.

---

## 9. 결말 판정 순서

D11 단계에서 다음 순서로 판정한다:
1. 인구 0 → 멸족
2. 결속 0 → 처음이면 부족 분할 이벤트 예약(§9.1), `has_split` 플래그가 있으면 분열 패배
3. `endChapter` 효과로 표시된 결말(흡수당함, 각 길의 마지막 이벤트)
4. 승리 조건 — 같은 턴에 둘 이상 충족되면 priority로 정한다. 다만 길의 완성은 대개 **마지막 이벤트**를 거치므로, 자동 판정보다는 "이 길의 끝이 보인다" 이벤트를 forced로 띄우고 플레이어가 마무리하거나 미루는 방식을 쓴다.
5. turn ≥ turnLimit → 생존 결말

### 9.1 부족 분할 (결속이 처음 0이 될 때)

- 다음 턴 맨 앞에 forced 이벤트 **"갈라지는 불"**이 온다(이벤트 개수 제한 무시). 분할을 이끄는 인물(`ambition`이 가장 높거나 족장과의 관계가 가장 낮은 인물)이 액터로 바인딩된다.
- 선택지 (수치는 balance `split.*`):

| 선택지 | 떠나는 인구 | 떠나는 인물 | 우리가 잃는 것 | 결속 회복 | 새 이웃: 관계 / 성격 / 시작 전력 | 축 | 나중에 돌아오는 것 |
|---|---|---|---|---|---|---|---|
| 대가를 치르고 붙잡는다 | 20% | 주동 인물은 남는다 | 식량 −30%, 도구 −25%, **주동 인물에게 직책을 내준다**(장로나 사냥 우두머리 자리. 그 자리에 있던 인물은 직책을 잃고 족장 관계 −20), 행동 수 −1(4턴, 불만을 달래느라) | 40 | −10 / 은둔 / 보통 | 위계 +10 | `split_promise`: 6~8턴 뒤 **"약속의 값"** 이벤트. 주동 인물이 더 큰 몫을 요구한다(들어주기 / 거절 → 2차 이탈 위험) |
| 축복하며 보낸다 | 40% | 주동 인물과 그를 따르는 인물 | 식량 −20%, 도구 −10% (가져갈 몫을 나눠 줌) | 50 | **+40** / 교역 지향 / 보통 | 나눔 −10, 화합 −10 | `kin_split`: 혼인·동맹·평화 흡수 조건 완화, 교역 이벤트 |
| 쫓아낸다 | 35% | 주동 인물과 가장 가까운 인물 1명 | **없음** — 빈손으로 쫓아내 식량과 도구를 하나도 가져가지 못한다 | **60** (공동의 적 앞에서 남은 자들이 뭉친다) | −60 / 호전적 / **낮음**(빈손이라 약함) | 위계 +10, 무력 +15 | `exiled_kin`: 8~12턴 뒤 복수 이벤트(그 사이 전력을 키움). 나눔 쪽 인물들 족장 관계 −10 |
| (조건부) 의례로 다시 묶는다 | 15% | 없음 | 전승 −20, 샤먼이나 꿈꾸는 인물 필요, 그 인물이 2턴 동안 행동 배정 불가 | 35 | 0 / 은둔 / 낮음 | 전통 +10 | — |

**지배 관계 점검** (같은 줄의 다른 선택지보다 확실히 나은 점이 각각 있다):
- 붙잡는다: 인구를 가장 많이 지킨다 ↔ 자원과 행동을 가장 많이 잃고, 약속이 다시 돌아온다.
- 축복: 유일하게 우호적인 이웃이 생긴다(대부족의 길, 교역) ↔ 자원 일부를 내준다.
- 쫓아냄: 자원 손실이 없고 결속을 가장 많이 회복한다. 상대도 약하게 시작한다 ↔ 적대 이웃과 복수 이벤트, 내부 반발.
- 의례: 손실이 가장 적다 ↔ 조건이 필요하고 회복이 가장 작다.
- 시뮬레이터는 분할 이벤트의 선택지별 선택률과 이후 생존율·승률을 따로 보고한다.

- 떠난 무리는 **새 이웃 부족**(`origin: 'splinter'`)이 된다. 성격은 선택에 따라 정한다: 축복 → 교역 지향, 쫓아냄 → 호전적, 붙잡음 → 은둔. 이름은 이름 생성기로 만든다(예: "갈라진 재 사람들").
- 결속을 중간값으로 회복시켜 연쇄 붕괴를 막는다. 분할 후 `splitGraceTurns`(4턴) 동안 결속 손실이 50% 줄어든다.
- `has_split` 플래그가 남는다. 이후 결속이 다시 0이 되면 분열 패배다. 이 플래그는 ChapterResult의 keyFlags로 넘어간다(다음 장의 "갈라진 형제" 서사 씨앗).
- 대부족의 길에서 갈라진 무리를 다시 흡수하거나 혼인으로 묶는 것도 인정한다. 화해의 서사가 승리 경로가 된다.

---

## 10. 연대기

- 턴 동안 연대기 후보 로그(`chronicle` 효과, 선택지/행동의 `chron` 키)가 쌓인다. 결산에서 importance가 가장 높은 것 1개(동률이면 먼저 나온 것)를 그 턴의 문장으로 확정한다. 후보가 없으면 계절 기본 문장(약 20개 풀, 상태 기반)을 쓴다.
- 문장 예: "제1대 족장 시절의 세 번째 겨울, 족장 마루는 굶주린 붉은여울 사람들에게 마지막 고기를 나눴다."
- 내보내기: JSON(ChronicleEntry[])과 텍스트.

---

## 11. 저장

- localStorage `sac.save` 슬롯 1개 + `sac.save.prev`(직전 턴 백업). D13 이후 UI 훅이 저장한다.
- 파일 내보내기/불러오기: `{ saveVersion, savedAt, state }`. 불러올 때 `migrations[saveVersion]`을 순서대로 적용한다.
- 상태에는 함수, Map, Set, undefined를 넣지 않는다(직렬화 왕복 테스트로 보장).

---

## 12. 검증 도구 설계

**validate:content** (실패 시 exit 1)
- 중복 id, 존재하지 않는 id 참조(이벤트, 카드, 지식, 플래그 생산자 유무, 지역, 이웃, 스탯 키)
- **도달 불가 이벤트**: 조건에 쓰인 플래그를 세우는 곳이 없음, followUp인데 예약하는 곳이 없음, 지식이나 축 조건이 모순됨
- **비용 없는 선택지**: 모든 효과가 이득뿐인 선택지(자원 +, 관계 +만 있음). 의도된 경우 `freeOk: '사유'`로 예외 처리
- 선택지 2~4개, 라벨 15자, 본문 2~4문장, 누락되거나 쓰이지 않는 문자열 키
- `hiddenUnless` 남용 경고, 선택지 효과가 동일한 쌍(가짜 선택지) 경고

**sim** `npm run sim -- --games 1000 --strategy random|greedy --seed base`
- random: 유효 커맨드 중 균등 선택. greedy: 1수 앞 평가 함수(자원 + 결말 진척 가중합).
- 리포트: 평균 생존 턴, 결말·패배 분포, 이벤트별 발생률(0회 목록), 선택지별 선택률과 승리 상관(lift), 자원 추이 분위수(턴 4/12/24/36/48), 지배적 선택지 후보(greedy 선택률 > 85% 그리고 승리 lift > 1.3).
- **템포 리포트**: 시대 전환 턴 분포(중앙값, 90% 분위수, 33턴 초과 비율), 판당 계승 횟수 분포, **첫 계승과 시대 전환의 간격 분포(3턴 이내 비율)**, 부족 분할 발생률과 분할 후 생존율.
- **특성별 승률 리포트**: 부족 특성(시작 선택 2개의 조합 포함)과 인물 특성마다 보유한 판과 아닌 판의 승률, 결말 분포를 비교한다. 승률 lift > 1.25인 특성은 "지배적 특성 후보"로 표시한다. 선견 특성은 별도 줄로 "선견이 켜진 선택지 수, 선견 유무별 승률"을 보고한다.
- 콘솔 표 + `sim-report.json`.

---

## 13. 장기 확장 지점: 2장을 붙일 때

| 바뀌지 않는 것 | 바뀌는 것 (데이터 추가) | 코드가 바뀔 수 있는 것 |
|---|---|---|
| reduce, 턴 루프 골격, RNG, 저장/마이그레이션 | `chapters/ch2/` 폴더 전체 | 새 메커닉이 필요할 때 Effect/Condition 유형 **추가**(기존 유형은 유지) |
| Condition/Effect 평가기 구조, 모디파이어/스탯 | 자원 목록(예: 청동, 교역품), 축 추가·재해석 | 필요하면 턴 단계 추가(예: 세금) — 단계 목록을 장 정의에서 켜고 끄게 한다 |
| 이벤트 엔진, 덱, 연대기, 에필로그 조합 | `importFromPrevious` 매핑, 사회 규모 라벨, 테마 | |
| 시뮬레이터, 검증기, UI 셸 (자원·축·역할을 장 정의에서 그림) | 결말과 powerSeeds | |

- UI는 자원 바, 축, 역할을 **장 정의의 목록을 돌며** 그린다. 자원이 6개가 되어도 UI 코드는 그대로다.
- 맵 레이어는 나중에 regionId → 좌표 매핑을 별도 데이터로 붙인다. 엔진은 알 필요가 없다.

---

## 14. 테스트 계획 (M1부터)

- rng: 같은 시드면 같은 수열, 상태 직렬화 후 이어서 뽑아도 동일
- condition/effect: 유형마다 단위 테스트, clamp, 로그 생성
- turn: 단계 순서(겨울 소비, 부패, 굶주림, 성장), 행동 수 계산
- events: 가중치 선택 분포, 쿨다운, once, followUp 지연, 최대 개수와 이월
- save: 왕복 동등성, 버전 마이그레이션
- 재현성: 시드 + 커맨드 열 → 최종 상태 해시 동일 (헤드리스 48턴 완주)

---

## 15. 가정 (질문하지 않고 정한 것)

1. 이름 있는 인물은 인구 수에 포함되지만 역할 배분 계산에서는 빠진다.
2. 역할 배분은 합계가 인구와 같아야 한다(무직 없음). 인구가 줄면 balance의 우선순위(의례 → 제작 → 경계 → 사냥 → 채집 순으로 먼저 줄어듦)로 자동 보정한다.
3. 지식 해금은 행동 횟수를 쓰지 않는다(전승만 소모). 행동 단계에서만 가능하다.
4. 행동 카드 덱은 Reigns식 운의 긴장을 주지만, 기본 산출은 역할 배분이 책임지므로 손패 운만으로 굶어 죽지 않는다.
5. 부족 이름은 시작 화면에서 후보 3개 중 고르거나 직접 입력한다.
8. 대(代) = 족장의 대수. 족장이 없는 동안(계승 이벤트 대기 중)에는 대 번호가 그대로다.
6. 시드는 문자열. 비워 두면 시작 시각 기반으로 생성한다(이것은 UI 계층 일이고 엔진은 시드를 받기만 한다).
7. git 저장소가 아직 없다. M1 시작 시 `git init`을 하고, 커밋은 승인 후에 한다.

---

## 16. 테마와 가독성 (다크)

**팔레트 토큰과 명암비** (WCAG 2.x 상대 휘도로 계산)

| 토큰 | 값 | 배경 `--bg` #16130F | 표면 `--surface` #221D17 | 카드 `--card` #2B241C | 용도 |
|---|---|---|---|---|---|
| `--text` | #ECE2CF (뼈색) | 14.4 | 13.0 | 11.9 | 본문 |
| `--text-muted` | #BFAF94 | 8.6 | 7.8 | 7.1 | 보조 설명, 연대기 |
| `--text-faint` | #9A8B74 | 5.6 | 5.0 | 4.6 | 잠긴 선택지, 힌트 (짧은 글만) |
| `--accent` | #F0A050 (불빛) | 8.7 | 7.8 | 7.2 | 강조, 선택 포커스 |
| `--ochre` | #C98A4B (황토) | 6.4 | 5.8 | 5.3 | 테두리, 장식 (글자로는 제목만) |
| `--danger` | #E9785F | 6.5 | 5.8 | 5.3 | 손실 수치 (▼ 아이콘 병기) |
| `--good` | #9DC08B | 9.1 | 8.2 | 7.5 | 이득 수치 (▲ 아이콘 병기) |

**규칙**
- 긴 본문(이벤트 본문, 연대기, 에필로그)은 `--text`나 `--text-muted`만 쓴다. 모든 배경에서 **7:1 이상(AAA)**이다.
- `--text-faint`는 4.6:1 이상(AA)이라 짧은 힌트에만 쓴다. 잠긴 선택지를 "흐리게" 할 때 **opacity를 쓰지 않는다**(대비가 무너짐). `--text-faint` + 자물쇠 아이콘 + 점선 테두리로 표현한다.
- 글자 크기: 본문 17px(1.0625rem) 이상, 줄 간격 1.65, 한 줄 최대 34em(한글 약 34자). 선택지 라벨 17px 굵게. 수치·보조 15px 이하로 내리지 않는다. 모바일도 같은 최소값을 쓴다.
- 서체: 시스템 한글 서체 스택(외부 폰트 없음). 본문은 순수 흰색(#FFF)을 쓰지 않는다(어두운 배경에서 번짐). 뼈색이 그 이유다.
- 설정 화면에 **글자 크기 3단계**(기본 / 크게 / 아주 크게)를 둔다. `--font-scale` 변수 하나로 바꾼다.
- 색만으로 정보를 전달하지 않는다: 이득과 손실은 ▲▼ 아이콘과 부호, 카드 종류는 테두리 색과 종류 아이콘, 축은 방향 화살표와 라벨.
- 이 표는 M2에서 자동 테스트로 만든다: 테마 토큰 조합의 명암비가 기준 아래로 내려가면 `npm test`가 실패한다.

---

## 17. 콘텐츠 가이드 보완: 압축된 전설의 시간 감각

CLAUDE.md의 "콘텐츠 작성 가이드"에 더해 1장 콘텐츠는 아래를 따른다.

**시간 표기**
- 연도, 나이 숫자, "몇 년 뒤" 같은 표현을 쓰지 않는다. 시간은 **"제N대 족장 시절", 계절, 생애 단계**로만 말한다.
- 같은 족장 시절 안의 일은 "그 겨울", "다음 봄"처럼 가깝게 쓴다. 대가 바뀌는 일(계승, 시대 전환)은 멀게 쓴다.

**시대 전환 이벤트 본문에는 긴 시간이 흘렀다는 서술을 반드시 넣는다**
- 한 족장의 결정처럼 보이지만, 실은 여러 대에 걸쳐 쌓인 변화가 그 순간에 드러난다는 틀이다.
- 예시 톤: "버려진 씨앗이 싹트던 자리를 처음 눈여겨본 이가 누구였는지, 이제는 아무도 기억하지 못한다. 할머니의 할머니 때부터 사람들은 그 자리로 돌아왔다. 이번 봄, {chief}는 처음으로 떠나지 말자는 말을 들었다."
- "징조" 이벤트(21턴부터)도 같은 결로 쓴다: "언제부터였는지 모른다", "아이들은 이것을 당연하게 여긴다".
- 검증기 규칙: `transition` 태그 이벤트 본문에 시간 경과 표지(문자열 리소스의 `timeMarker: true` 표시)가 있는지 확인한다.

**에필로그는 후대 이야기꾼이 전하는 전설 시점으로 쓴다**
- 화자는 먼 훗날 모닥불 앞의 이야기꾼이다. 3인칭 과거, 전해 들은 말투.
- 예시 톤: "이야기꾼들은 말한다. 마루의 시절, 그들은 굶주린 이웃에게 마지막 고기를 내주었다고. 그 이웃의 아이들이 훗날 무엇이 되었는지는 다른 노래가 전한다."
- 확실하지 않은 전승도 허용한다: "어떤 이들은 ~했다고 하고, 또 어떤 이들은 ~했다고 한다." 같은 결말이라도 축과 플래그에 따라 무엇을 자랑하고 무엇을 감추는지가 달라진다(공포의 무리는 "두려움 속에 기억되었다").
- 에필로그 조각(`EpilogueFragment`)의 `opening` 슬롯은 항상 이야기꾼의 도입이고, `closing` 슬롯은 "이것이 첫 장의 노래다" 류의 맺음으로 다음 장을 암시한다.
- 연대기(매 턴 문장)는 기록자 시점(담담한 서술)이고, 에필로그는 이야기꾼 시점(전설)이다. 둘을 섞지 않는다.

---

## 18. M2 플레이테스트 확인 항목 (질문지와 함께 제시)

CLAUDE.md의 플레이테스트 질문지 5개에 더해, 아래를 시뮬레이터 수치와 실제 플레이로 함께 확인한다.

| # | 확인할 것 | 시뮬레이터 지표 | 문제일 때 조정 방향 |
|---|---|---|---|
| 1 | **첫 계승과 시대 전환이 같은 시기에 몰리는가** | 첫 계승 턴과 전환 턴의 차이 분포, 차이 ≤ 3턴 비율 | 비율이 30%를 넘으면: (a) 두 forced 이벤트가 같은 턴이면 계승을 먼저 처리하고 전환을 2턴 미룬다, (b) 시작 족장의 단계 진행(stageTurns)을 조정해 첫 계승 중앙값을 22턴 근처로 당긴다. 반대로 몰렸을 때 "새 족장의 첫 결정이 정착이냐 유랑이냐"가 더 극적이라는 의견이면 그대로 둔다 — 플레이 감각으로 판단 |
| 2 | 계승이 한 판에 1~2회 일어나는가 | 판당 계승 횟수 분포 | 노년 사망 위험 계수 조정 |
| 3 | 전환이 30턴 전후에 오고, 전환 후 15턴 이상이 의미 있게 느껴지는가 | 전환 턴 중앙값, 33턴 초과 비율 | 지식 비용과 전승 산출 조정 |
| 4 | "제N대 족장 시절" 표기와 생애 단계만으로 시간 흐름이 느껴지는가 | — (플레이 감각) | 계절 전환 연출, 단계 전환 알림 강화 |
| 5 | 겨울이 위협적이지만 대비할 수 있는가 | 겨울 직후 굶주림 발생률 | 계절 배율, 저장 상한 |

(분할 이벤트의 선택지 균형은 M3에서 결속 위기가 들어온 뒤 확인한다.)
