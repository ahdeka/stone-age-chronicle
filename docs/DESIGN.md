# 1장 설계 문서 (재설계 M0)

이 문서는 CLAUDE.md(재설계판)를 구현 가능한 형태로 구체화한다. 이전 설계는 `docs/archive/DESIGN-v1.md`에 보관했으며 따르지 않는다.
모든 판단 기준은 "시험 플레이의 경험을 재현하는가"다.
시험 플레이 기록은 `docs/playtest-log.md`다. M2의 **기준 시나리오**이고, 그 끝의 "사건 연결 지도"가 콘텐츠 연결의 기준이다(§18).
**2026-11-20 변경**: 게임은 늦가을이 아니라 **봄(1년차 3월)에 시작한다**. 시험 플레이의 겨울 넉 달은 "준비가 부족했을 때의 겨울" 기준이다. 봄·여름·가을의 준비가 겨울로 돌아오는 연결(§18.2 P1~P10)을 새로 둔다. 상세는 §15.3.

---

## 0. 기준 경험 분해

시험 플레이(CLAUDE.md "기준 경험")가 재미있었던 이유를 기능으로 나누고, 각각을 어떤 장치로 재현할지 정한다.

| 시험 플레이에서 느낀 것 | 실제로 일어난 일 | 재현 장치 |
|---|---|---|
| "발톱 자국"이 다음 선택을 만든다 | 앞 단계의 서술이 세계 상태를 바꾸고, 그 상태가 선택지를 연다 | 서술 결과가 **사실(fact)**을 남긴다(`bear_den_found`, `bear.state`). 사건과 방침은 사실을 조건으로 쓴다 (§6, §8) |
| 사흘이면 끝나는 고기 자루 | 정확한 수치와 남은 날수가 압박이 된다 | 개인 단위 소비, kg 단위 식량 묶음, "며칠분" 상시 계산 (§4, §10) |
| 바위와 노을이 엇갈린다 | 같은 상황을 두고 성격이 다른 조언이 나온다 | 조언자 입장(stance) 점수와 대사 템플릿 (§7.3) |
| 곰은 잡았지만 돌쩌귀가 죽었다 | 성공에 사람의 대가가 붙는다 | 5등급 결과와 "대가 표"에서 참가자를 지목한다 (§7) |
| 장작이 절반만 들었다 | 거처가 바뀌자 규칙이 바뀐다 | 거처 모디파이어(스탯 파이프라인) (§4.4) |
| 얼음이 녹으면 다시 오겠다 | 세계가 약속을 기억한다 | 기억 장부: 약속·은혜·원한·은닉물·단서 (§8) |

**설계에서 가장 어려운 부분**: 대화형 즉흥성을 미리 쓴 데이터로 흉내 내야 한다. 대응 방식은 세 가지다.
1. **사실 → 조건 → 선택지**의 연결을 촘촘하게 만든다. 서술은 꾸밈이 아니라 상태를 바꾸는 사건이다.
2. 방침과 사건을 **상황 점수로 생성**한다. 고정 덱에서 뽑지 않는다.
3. 문장에 **조건부 조각**(날씨, 거처, 인물 상태)을 끼워 같은 결과라도 매번 다르게 읽히게 한다.

---

## 1. 기존 코드 재사용 / 수정 후 재사용 / 폐기

### 1.1 그대로 재사용
| 대상 | 비고 |
|---|---|
| `engine/rng/rng.ts` + 테스트 | sfc32, cyrb128, weightedIndex, shuffled. 손대지 않는다 |
| `engine/save/save.ts` 골격 | 버전 필드와 마이그레이션 체인 구조. 새 스키마는 `SAVE_VERSION = 1`부터 다시 시작하고, 구 세이브는 "호환 안 됨"으로 거부한다 |
| `src/architecture.test.ts` | 엔진의 React/DOM 의존 금지, `Math.random` 금지 |
| `src/data/theme.test.ts`, `ui/theme/*` | 테마 토큰, 명암비 자동 테스트 |
| `src/i18n/index.ts`, `ui/i18n.tsx` | 문자열 테이블과 `{var}` 치환. 수량 서식 함수만 추가한다 |
| `ui/storage.ts`, `ui/components/SaveControls.tsx` | localStorage 자동 저장, JSON 내보내기/불러오기 |
| `src/audio/index.ts` | 빈 인터페이스 유지 |
| 설정 | package.json 스크립트, tsconfig, vite.config, .gitignore |

### 1.2 수정 후 재사용
| 대상 | 살리는 것 | 바꾸는 것 |
|---|---|---|
| `engine/conditions/evaluate.ts` | `NumRange`, all/any/not, evaluateAll(실패 목록 반환), actor 슬롯 | 조건 종류를 새 상태에 맞게 교체 (§5.1) |
| `engine/effects/apply.ts` | 디스패처, random, if, chronicle, 로그 기록 방식 | 자원 효과를 식량 묶음과 kg 단위로 바꾸고, 인물·기억·동물·이웃 효과를 추가 (§5.2) |
| `engine/stats/stats.ts` | base → add 합 → mul 곱, 출처 기록("왜 이 값인가") | 출처를 날씨·거처·지식·단서·인물 능력으로 교체. 성공 확률 계산의 뼈대가 된다 |
| `engine/events/events.ts` | 조건, 가중치, 쿨다운, 1회성, 태그 연속 제한, 인물 바인딩, 본문 변형 | 중간 사건과 방침 후보 생성에 둘 다 쓴다 (§6) |
| `engine/chronicle/chronicle.ts` | 이름을 그 시점의 표기로 고정(Label), 중요도 선택 | 매달 1~2문장, 시대 전환 때 묶어 보기 |
| `engine/core/reduce.ts` | 깊은 복사 + 검증 후 적용 + 오류 반환 | 명령 종류 교체 |
| `engine/core/createGame.ts` | 프리셋 → 상태, 시드 주입 | 개인 단위 인구, 식량 묶음, 동물, 이웃 |
| `engine/types/chapter.ts` | ChapterDefinition의 틀(balance, content, strings, theme) | 내용 전면 교체 (§3) |
| `engine/effects/preview.ts` | 효과 → 표시 항목 변환 | 방침과 선택지의 "확실한 비용" 표시와 위험 단서 계산 (§7.4) |
| `tools/lib/validate.ts` | 중복 id, 참조 검사, 도달 불가, 공짜 선택지, 라벨 길이, 문장 수 | 그림 id 검사, 서술 변형 수 검사, 방침 템플릿 검사 추가 |
| `tools/lib/sim.ts`, `tools/sim.ts` | 실행기, 전략 플러그인, JSON 리포트 | 지표 교체 (§12) |
| `ui/components/DebugPanel.tsx` | 개발 모드 한정 패널 | 단서, 예약, 동물 상태 보기와 달 건너뛰기 |
| `ui/hooks/useDeltas.ts`, `ui/format.ts` | 증감 애니메이션, 수 서식 | kg와 며칠분 서식 |
| `ui/App.tsx`, `ui/icons/Icon.tsx` | 앱 틀, 단색 아이콘 컴포넌트 | 화면 교체, 상태 바 아이콘 추가 |
| `src/test/fixtures.ts` | newGame, tweakDef, run 패턴 | 새 명령에 맞춤 |

### 1.3 폐기
- **엔진**: `engine/actions/*`(손패, 덱), `types/cards.ts`, `core/turn.ts`(1턴=1계절 루프), `core/population.ts`(집계 인구), 역할 배분(roles), 직책(offices), 가치 축, 생활 방식 스탯
- **데이터**: `data/chapters/ch1/*` 전부(이벤트, 행동 카드, 프리셋, 결말, 수치), `data/common/dsl.ts`, `personTraits.ts`, `offices.ts`
- **UI**: `GameScreen`, `StartScreen`, `EventCard`, `Hand`, `Preview`, `Chronicle`(새로 작성), 관련 CSS, `render.test.tsx`(새 화면 기준으로 다시 작성)
- **도구**: `tools/lib/validateCards.ts`(방침·사건 검사기로 새로 작성)

M1은 1.3을 먼저 지우고, 1.2를 하나씩 옮기며 테스트를 되살리는 순서로 진행한다.

---

## 2. 폴더 구조

```
src/
  engine/                  순수 TS. React/DOM 금지
    types/                 common, condition, effect, state, chapter, content, command, report
    rng/                   (재사용)
    conditions/            evaluate
    effects/               apply, preview
    stats/                 스탯 파이프라인
    world/                 weather, animals, places(고갈/회복), neighbors(규칙 기반 AI)
    people/                persons(나이, 건강, 굶주림 위험), labor(인원 배정), succession
    stores/                food lots(부패, 운반 한계), firewood, goods
    policy/                candidates(후보 생성), bind(파라미터 결정), steps(단계 실행)
    outcome/               tier(등급 계산), costs(대가 표), hint(위험 단서)
    events/                중간 사건 선택, 월초 사건
    memory/                약속, 은혜/원한, 은닉물, 단서, 예약 사건
    narrative/             템플릿 조립, 변형 선택, 조건부 조각
    goals/                 시대 목표 진행도, 결말 판정, ChapterResult
    chronicle/
    month/                 한 달 상태 기계 (§4)
    save/
  data/
    balance.ts             공통 수치
    common/                공통 인물 특성, 공통 서술 조각, 공통 그림 id
    chapters/ch1/
      chapter.ts           ChapterDefinition 조립
      balance.ts           1장 수치
      calendar.ts          달 이름, 계절, 날씨 확률
      presets/             시작 프리셋 (1장 프로토타입은 1개)
      places.ts animals.ts neighbors.ts knowledge.ts goals.ts
      policies/            방침 템플릿 (분야별 파일)
      events/              중간 사건, 월초 사건
      narrative/           서술 결과 (방침 단계별 등급 문장)
      advisors.ts          조언 대사 템플릿
      scenes.ts            이 장에서 쓰는 장면 조합 별칭
      ko/                  문자열
  assets/
    manifest.ts            그림 id → 파일, 종류, 기본 배치
    scenes/bg/ subject/ overlay/ portrait/   SVG 파일
  ui/
    screens/               Briefing, Month(진행), Settlement, Chronicle, Start, End
    components/            SceneView(레이어 합성), StatusBar, AdvisorBubble, ChoiceCard, LedgerTable, SidePanel(인물/목표/남은 일), DebugPanel
    hooks/ theme/ icons/
tools/                     validateContent, sim, lib/
```

---

## 3. 핵심 타입

수치 필드의 단위는 이름으로 드러낸다(`kg`, `days`, `months`). 아래는 확정안의 뼈대다. 세부 필드는 M1 구현 중 늘 수 있다.

### 3.1 시간
```ts
type Phase = 'early' | 'mid' | 'late';               // 상순, 중순, 하순
interface CalendarDef {
  months: { id: Id; season: SeasonId }[];            // 12개, 이름은 ko 리소스
  startMonthIndex: number;                           // 1장: 녹는달(봄). 숨은 테스트 프리셋은 낙엽달
  daysPerPhase: 10;                                  // 한 달 = 30일
}
```
월은 `state.month`(1부터 증가)와 `monthIndex = (start + month - 1) % 12`로 계산한다. 나이는 `birthMonth`에서 계산한다(12달 = 1살).

**화면 날짜 표기**(2026-11-20): "1년차 · 봄 · 3월". 달력 순서(녹는달=index 0)에서 달 숫자는 `(monthIndex + 2) % 12 + 1`이다(녹는달=3월 … 서리달=12월, 눈달=1월, 얼음달=2월). 년차는 녹는달(3월)마다 1씩 오른다: `year = 1 + floor((start + month - 1) / 12)`(start=0일 때). 달 이름은 이야기 문장에서만 쓴다. 날짜 계산은 엔진의 순수 함수(`calendarLabel`)로 두고 화면과 연대기가 같이 쓴다.

### 3.2 사람
```ts
type Sex = 'f' | 'm';
type AgeBand = 'child' | 'adult' | 'elder';          // 경계 나이는 balance
interface Person {
  id: Id; nameKey: string; sex: Sex; birthMonth: number;
  alive: boolean; diedMonth?: number; deathCauseKey?: string;
  parents: Id[];                                     // 혈통
  traits: Id[];                                      // 능력과 성격 (예: 'tracker', 'herbalist')
  skills: Partial<Record<SkillId, number>>;          // hunt, gather, craft, heal, lore (0~3)
  advisor?: { stance: Stance; seat: Id };            // 조언자만. stance: bold | cautious | practical | inventive
  isChief?: boolean;
  health: Ailment[];                                 // 부상과 병
  hungerDays: number;                                // 연속으로 덜 먹은 날 (굶주림 위험 계산)
  busyUntil?: { month: number; phase: Phase };       // 원정 중 등
}
interface Ailment { kind: Id; severity: 1 | 2 | 3; sinceMonth: number; healsAtMonth: number; noLabor: boolean }
```
**모든 부족원이 개인 기록**을 가진다(확정 D4): 이름, 나이, 건강, 부모·자식 관계.
- 이름은 프리셋에 고정된 사람(시험 플레이의 갈대, 돌쩌귀, 느티, 솔 등) + 데이터 이름 풀에서 시드로 뽑는다.
- 시작 시 가족 관계도 프리셋 규칙으로 만든다(성인 짝, 아이의 부모, 노인의 자식).
- 개인 기록은 엔진에만 두고, 화면은 성인·노인·아이 비율, 일손, 아픈/다친 사람 수, 주요 인물 4명만 보인다(2026-11-24 3차 피드백). 부족원 명단 화면은 없앴다. 다치거나 죽거나 사건에 지목되면 본문과 이달의 결과 "사람" 칸에 이름이 나온다.

### 3.3 물자
```ts
interface FoodLot {                                  // 같은 종류·같은 장소면 합친다
  kind: Id;                                          // raw_meat, frozen_meat, dried_meat, dried_fish, nuts, roots ...
  kg: number;
  where: 'camp' | { cache: Id };                     // 은닉 장소 id
  sinceMonth: number;
}
interface Stores {
  food: FoodLot[];
  firewoodKg: number;
  goods: Record<Id, number>;                         // hide, spear, snare, net, fur_clothes ... (개수)
}
interface Shelter { kind: Id; placeId: Id; condition: number }   // tent, rock_cave, pit_house
```
식량 종류마다 **계절별 부패율(순당 %)**과 **운반 무게 계수**가 데이터에 있다. 식량 kg은 "먹을 수 있는 양" 기준이다. 말린 고기는 같은 양을 먹여도 무게가 절반이라 운반 계수가 0.5다.

**운반 한계와 넘는 방법** (확정 D6)
원정에서 얻은 양이 `운반량 = 인원 × carryKg × 지식 배율`을 넘으면 남는다. 남은 양을 처리하는 길은 다음과 같다.
1. **왕복**: 장소의 `travelDays`가 짧고 이번 달에 남은 날이 있으면 여러 번 오간다. 왕복 1회 = travelDays × 2일이 들고, 그동안 마을 일손이 빠진다(시험 플레이 4달: 굴과 사냥터가 가까워 세 번 왕복)
2. **은닉**: 돌무더기 아래 묻는다 → 기억 장부의 은닉물(§8)
3. **현장 건조**(지식 "고기 말리기"): 며칠 머물며 말려 무게를 줄인다. 대신 날짜를 쓰고, 그 사이 짐승을 부른다
4. **썰매·끌개**(지식 "끌개 엮기", 눈 위에서 효과 큼): carryKg 배율 상승
5. **저장 구덩이**(지식): 사냥터나 거처 근처에 냄새가 덜 나는 은닉. 습격 위험과 부패가 줄어든다
6. **버린다**: 비용 없이 끝나지만 결속이 조금 떨어진다("고기를 두고 왔다")

어떤 길을 쓸지는 하순 서술 직전에 정해진다. 방침의 기본 처리 + 조건에 맞는 경우 "남은 고기를 어떻게 할까" 소사건이 뜬다.

### 3.4 세계
```ts
interface PlaceDef {
  id: Id; kind: Id;                                  // river, forest, steppe, marsh, cave, ford
  travelDays: number;                                // 장면 묘사와 원정 기간에만 쓴다. 좌표는 없다
  yields: Record<SeasonId, Partial<Record<YieldId, number>>>;   // 순당 1인 기대 수확 kg
  stockMax: Partial<Record<YieldId, number>>;        // 고갈 상한
  recoverPerMonth: number; danger: number; scene: Id;
}
interface PlaceState { discovered: boolean; stock: Partial<Record<YieldId, number>>; facts: Id[] }

interface AnimalDef {                                // 순록, 늑대, 곰, 토끼, 물고기 ...
  id: Id; states: Id[];                              // 예: reindeer = grazing | gathering | migrating | gone
  schedule: { monthIndex: number; to: Id; chance: number }[];   // 주기
  transitions: { from: Id; to: Id; when: Condition[]; chance: number }[];
}
interface AnimalState { state: Id; placeId?: Id; count?: number; hunger?: number; boldness?: number; known: boolean }

interface WeatherDef { id: Id; byMonth: Record<number, number>; mods: ModifierDef[]; scene: Id }
// 날씨는 순 단위로 정한다(한 달 = 3개). 월초 보고에서는 "이번 달 전망"만 보여 준다(§4.1)

interface NeighborDef { id: Id; homePlace: Id; temper: Id; has: Id[]; wants: Id[]; strength: number; knowledgeTaught: Id[] }
interface NeighborState { met: boolean; relation: number; status: 'unknown' | 'known' | 'ally' | 'vassal' | 'hostile'; ledger: LedgerEntry[] }
```

### 3.5 콘텐츠
```ts
interface PolicyTemplate {
  id: Id; category: PolicyCat;                       // food, shelter, firewood, people, neighbor, knowledge, explore
  appearsWhen: Condition[];
  relevance: RelevanceTerm[];                        // 상황 점수 (§6.1)
  priority: number; cooldownMonths: number; once?: boolean;
  params: ParamDef[];                                // {hunters}, {place}, {target} 등. 생성 시점에 결정
  labor: LaborSpec;                                  // 예: { hunt: { adults: '{hunters}', prefer: 'hunt' } }
  leaderSlot?: { prefer: PersonQuery };              // 이끄는 인물. 서술과 대가 지목에 쓴다
  scene: SceneSpec;
  steps: Record<Phase, PolicyStep>;
  knowledgeProgress?: Record<Id, number>;            // 이 방침을 하면 자라는 지식 (§9)
}
type PolicyStep =
  | { kind: 'narrate'; narrative: Id; effects?: Effect[] }
  | { kind: 'activity'; activity: ActivityDef }      // 등급 판정이 있는 단계
  | { kind: 'eventWindow'; pool: Id[]; chance: number };   // 중순의 사건 창

interface ActivityDef {
  power: PowerTerm[]; difficulty: number | Expr;
  hidden?: HiddenVar[];                              // 아직 모르는 변수 → "결과를 알 수 없다"
  outcomes: Record<Tier, { narrative: Id; effects: Effect[]; scene?: SceneSpec }>;
  costs: CostEntry[];                                // 대가 있는 성공과 참사에서 뽑는다 (§7.3)
}
type Tier = 'triumph' | 'success' | 'costly' | 'failure' | 'disaster';

interface MidEvent {
  id: Id; trigger: { phases: Phase[]; conditions: Condition[]; seasons?: SeasonId[] };
  weight: number; cooldownMonths: number; once?: boolean; tags: Id[];
  actors?: Record<string, PersonQuery>;
  scene: SceneSpec; text: Id; textVariants?: { when: Condition[]; text: Id }[];
  speakers: { who: SpeakerRef; line: Id }[];         // 서로 다른 입장 2개 이상 권장
  options: EventOption[];                            // 2~4개
}
interface EventOption {
  id: Id; label: Id; requires?: Condition[]; lockHint?: Id;
  risk?: ActivityDef | 'sure';                       // 판정이 있으면 activity, 없으면 확실
  effects: Effect[]; remember?: MemoryEntry[];       // 지연 결과
  narrative: Id;                                     // 하순 서술로 이어진다
}

interface Narrative {
  id: Id;
  variants: { when?: Condition[]; seasons?: SeasonId[]; text: Id }[];   // 최소 변형 수는 balance
  fragments?: { when: Condition[]; text: Id; at: 'before' | 'after' }[];
  facts?: Effect[];                                  // 서술이 남기는 사실 (발톱 자국 → 곰 굴 발견)
}

interface SceneSpec { bg: Id | '{place}'; subjects?: SubjectSpec[]; overlay?: Id | '{weather}'; portrait?: SpeakerRef }
interface Knowledge { id: Id; progressNeeded: number; sources: KnowledgeSource[]; mods: ModifierDef[]; unlocks: Unlock[] }
interface EraGoal { id: Id; paths: { id: Id; conditions: Condition[]; progress?: ProgressExpr }[] }
```

### 3.6 장 정의와 결과
```ts
interface ChapterDefinition {
  id: Id; eraFrom: Id; eraTo: Id;
  calendar: CalendarDef; balance: ChapterBalance;
  people: { ageBands; consumptionKgPerMonth; namePool; traits; skills };
  stores: { foodKinds; goods; shelters };
  world: { places; animals; weather; neighbors };
  content: { policies; midEvents; monthEvents; narratives; advisors; knowledge; goals; endings };
  scenes: SceneAliases; theme: ThemeTokens;
  presets: Record<Id, StartPreset>; strings: { ko: StringTable };
  monthLimit: number;
}
interface ChapterResult {
  chapterId: Id; endingId: Id; month: number;
  goalPaths: Record<Id, Id>;                         // 목표별로 어떤 길로 달성했는가
  people: Person[];                                  // 살아 있는 사람 + 혈통에 필요한 죽은 조상 요약
  stores: Stores; shelter: Shelter; knowledge: Id[];
  neighbors: Record<Id, NeighborState>; flags: Id[];
  powerSeeds: Id[];                                  // 이후 장의 권력의 길 메모 (정복, 교역, 연합 ...)
  chronicle: ChronicleEntry[];
}
```

### 3.7 게임 상태
```ts
interface GameState {
  saveVersion: number; chapterId: Id; presetId: Id; seed: string; rng: RngState;
  tribeName: string;                                 // 부족 이름 (세이브 v3. 빈 문자열 = 프리셋 기본 이름. 입력 화면은 보류) (이전 세이브는 프리셋 기본 이름으로 옮긴다)
  month: number; step: MonthStep;                    // §4
  weather: { month: Id[] };                          // 이번 달 순별 날씨 3개
  people: Record<Id, Person>; chiefId: Id; chiefLine: number;   // 제N대
  stores: Stores; shelter: Shelter; cohesion: number;
  places: Record<Id, PlaceState>; animals: Record<Id, AnimalState>; neighbors: Record<Id, NeighborState>;
  knowledge: { has: Id[]; progress: Record<Id, number> };
  goals: Record<Id, { pathId?: Id; progress: number }>;
  memory: MemoryState;                               // §8
  flags: Record<Id, number>; counters: Record<Id, number>;
  cooldowns: Record<Id, number>;                     // 방침·사건 id → 다시 나올 수 있는 달
  narrativeRecent: Record<Id, number[]>;             // 최근에 쓴 변형 (반복 방지)
  month_: MonthWork;                                 // 진행 중인 달의 작업 상태
  reports: MonthReport[];                            // 지난 달 보고 (UI 다시 보기, 최근 N개)
  chronicle: ChronicleEntry[]; ending?: EndingRecord; seq: number;
}
interface MonthWork {
  candidates: BoundPolicy[];                         // 생성된 방침 후보 (저장된다)
  chosen?: BoundPolicy; assignment: Record<Id, TaskId>;
  pendingDecision?: { kind: 'midEvent' | 'monthEvent'; uid: Id; eventId: Id; actors: Record<string, Id> };
  ledger: LedgerLine[];                              // 정산표에 들어갈 줄
  phaseReports: PhaseReport[];
}
```

### 3.8 명령과 보고
```ts
type Command =
  | { type: 'begin' }                                // 브리핑을 읽었다 → 방침 선택으로
  | { type: 'choosePolicy'; candidateId: Id }
  | { type: 'nextMonth' }                            // 정산을 다 봤다 → 다음 달 월초
  | { type: 'chooseOption'; uid: Id; optionId: Id }
  | { type: 'debug'; op: DebugOp };                  // 개발 모드 전용
// M4 이후: { type: 'chooseSecondary' }, { type: 'setStandingOrder' }, { type: 'adjustLabor' }

interface PhaseReport {
  phase: Phase | 'briefing' | 'settlement';
  scene: ResolvedScene;                              // 레이어 id가 확정된 장면
  lines: RenderedLine[];                             // 문자열 키 + 변수 (조립은 UI에서 i18n으로)
  deltas: Delta[];                                   // 애니메이션용 증감
  tier?: Tier;
}
interface MonthReport {                              // 달 단위 묶음 (정산 후 확정)
  month: number; phases: PhaseReport[]; ledger: LedgerLine[];
  quiet: boolean;                                    // 평온한 달 → 한 화면 요약 (§19)
}
```
**엔진은 다음 결정 지점까지 미리 진행한다.** 결정 지점은 방침 선택, 중간 사건, 월초 사건, 남은 고기 처리다.
- 예: `choosePolicy` → 상순 → 중순(사건이면 여기서 멈춤) → 하순 → 정산까지 계산하고 `phaseReports`에 쌓는다.
- 화면은 그 보고를 하나씩 보여 준다. 그래서 "계속"은 엔진 명령이 아니라 **화면 쪽 진행**이고, 저장 파일에도 결과가 이미 들어 있다(새로고침해도 같은 결과).
- 사건을 하나 처리하면 다음 결정 지점까지 다시 미리 계산한다. 결정론과 재현성은 그대로다.
- 이 구조 덕분에 **평온한 달**을 한 화면으로 요약할 수 있다(§19).

---

## 4. 한 달 처리 순서

`MonthStep` 상태 기계:

```
briefing ─begin→ policy ─choosePolicy→ [early → mid → late → settlement 미리 계산]
                                              └ 사건이 생기면 거기서 decision 대기 ─chooseOption→ 이어서 계산
settlement ─nextMonth→ (다음 달) briefing
briefing에서 월초 사건이 있으면 decision 대기
```

### 4.1 월초 (`briefing` 진입 시, 결정론 순서)
1. 달 증가, 계절 결정
2. 나이 갱신, 생애 구간 변화(아이 → 성인, 성인 → 노인)를 보고에 기록
3. 이번 달 날씨 3개(상·중·하순) 결정. 보고에는 "전망"만 보인다. 예: "추위가 깊어질 것 같다." 별 읽기 같은 지식이 있으면 더 정확해진다
4. 동물 상태 전이(주기 → 조건 전이 순)
5. 장소 회복
6. 이웃 AI 행동(규칙 점수). 결과는 소식이나 예약 사건으로 남긴다
7. 기억 장부 처리: 기한이 된 약속과 예약 사건을 꺼내고, 은닉물은 부패시키고 동물의 습격 판정을 한다
8. 월초 사건 판정(계승, 굶주림 위기, 약속 이행 같은 강제 사건). 있으면 `pendingDecision`
9. 방침 후보 생성(§6). 상태에 저장한다
10. 조언자 발언 생성(§7.3)
11. 브리핑 보고를 만든다: 소식, 현황, "아직 남은 일", 조언

### 4.2 순 처리 (상순·중순·하순 공통, 10일)
1. 이번 순 날씨 적용
2. 인원 배정 확인: 다친 사람과 원정 중인 사람을 제외하고, 방침 노동 → 마을 기본 일(장작이 목표치 아래면 장작, 그다음 채집이나 낚시) 순으로 배정
3. **방침 단계 실행**(narrate / activity / eventWindow)
4. 마을 기본 일 산출(장작, 채집). 장소 고갈 반영
5. 소비: 개인 기준량 × 10일. 모자라면 배급 단계(§10.3)
6. 장작 소모: 계절 × 거처 × 날씨. 모자라면 추위 피해 판정
7. 부패: 식량 묶음별
8. 건강: 회복, 악화, 병 전파 판정
9. 보고 생성 (장면, 문장, 증감)

중순의 eventWindow는 3번에서 사건을 고르고 `pendingDecision`으로 멈춘다. 선택 후 4~9번을 마저 처리한다.
방침과 무관한 **마을 사건**(늑대가 마을을 돈다, 장작이 바닥났다)도 같은 창에서 후보가 된다. 사건은 한 달에 기본 0~1개, 드물게 2개다(확률은 balance).

### 4.3 월말 정산 (`settlement`)
1. 굶주림 판정: `hungerDays`가 기준을 넘은 사람 중 약한 사람부터 쓰러짐 판정
2. 결속 변화: 죽음, 굶주림, 불공정, 의례, 큰 성공
3. 지식 진행도 반영, 새 지식 해금 장면
4. 시대 목표 진행도 갱신, 달성 시 길 플래그 기록
5. 결말과 패배 판정
6. 연대기 1~2문장 확정
7. 정산표 생성: 식량(수입 원천별, 소비, 부패, 교역), 장작(모음, 태움), 인구 변화, 부상과 병, 관계 변화, 새 단서
8. 자동 저장 지점(UI가 저장)

### 4.4 스탯 파이프라인 재사용
날씨, 거처, 지식, 단서, 인물 능력, 계절은 모두 `ModifierDef`로 표현해 `getStat`에서 합친다. 예: `firewood.burnPerDay` = 기본 13kg × 겨울 1.0 × 바위굴 0.5 × 눈보라 1.3.
"왜 이 값인가"를 툴팁으로 보여 줄 수 있다.

---

## 5. 조건/효과 언어

### 5.1 조건 (기존 `NumRange` 방식 유지)
- 물자: `food`(kg, 종류 선택), `foodDays`(며칠분), `firewood`, `firewoodDays`, `goods`
- 사람: `population`(연령대 선택), `available`(이번 순 노동 가능 인원), `person`(질의), `advisor`(자리별), `chief`, `ailing`(부상자 수)
- 세계: `season`, `monthIndex`, `weather`(이번 순 또는 이번 달 전망), `animal`(상태, 장소, 굶주림), `place`(발견, 재고, 사실), `shelter`, `neighbor`(만남, 관계, 상태)
- 진행: `month`, `flag`, `counter`, `knowledge`, `goal`, `memory`(단서, 약속, 은닉물 존재)
- 맥락: `policy`(이번 달 방침 id나 분야), `actor`, `tierWas`(직전 단계 결과)
- 논리: `all`, `any`, `not`

### 5.2 효과
- 물자: `food { kind, kg, where? }`, `firewood`, `goods`, `spoil`(지정 묶음)
- 사람: `injure { who, kind, severity }`, `kill { who, causeKey }`, `heal`, `birth`, `join { count, from }`, `trait`, `relation`(조언자와 족장의 관계)
- 세계: `animal { state, hunger, boldness }`, `place { stock, fact }`, `shelter { kind }`, `neighbor { relation, status, ledger }`
- 기억: `remember`(§8), `clue`, `schedule { eventId, after, window, when }`
- 진행: `knowledge { progress | grant }`, `flag`, `counter`, `cohesion`
- 흐름: `random`, `check`(등급 판정), `if`, `chronicle`

대상 지정 `who`: `'leader'`(방침을 이끄는 인물), `{ actor }`, `{ participant: 'random' | 'weakest' | 'bravest' }`, `{ person: id }`, `'chief'`.
**참가자 지목**이 "돌쩌귀가 죽었다"를 만든다. 원정에 나간 사람 중에서 고른다.

---

## 6. 방침 후보 생성 규칙

### 6.1 점수
각 템플릿에 대해:
1. `appearsWhen`을 통과하고, 쿨다운이 지났고, 1회성이 아직 안 쓰였는지 확인한다
2. `params`를 결정한다. 예: `{hunters}` = 노동 가능 성인 − 마을 최소 인원(balance), `{place}` = 조건을 만족하는 장소 중 재고가 가장 많은 곳. 결정할 수 없으면 탈락
3. 점수 = `priority` + Σ `relevance` + 작은 시드 흔들림(±balance.jitter)
   - relevance 예: `{ when: foodDays < 20, add: 40 }`, `{ when: animal reindeer migrating, add: 60 }`, `{ when: weather outlook blizzard, add: -30 }`

### 6.2 고르기
- 점수 순으로 **3~5개**. 개수는 `balance.policy.slots`이고, 상황이 급할수록 줄인다(급하면 3개). **→ 2026-11-24부터 칸별로 고른다(§6.4.1.2)**: 식량 3~4개, 발전 2~3개 + "발전하지 않는다", 큰 일 0~1개.
- 같은 분야는 최대 2개
- **버티기 방침**(배급 줄이고 쉬기, 마을 지키기)은 항상 하나 들어간다. 사람이 죽지 않는 대신 식량과 결속을 소모하는 "거의 확실한" 선택지다.
- 점수 하위권에서 **뜻밖의 후보** 하나를 넣을 수 있다(확률은 balance). 탐험이나 이웃 방문 같은 것으로, 재플레이 동기를 만든다.

### 6.3 표시
방침 카드에는 장면 그림, 이름, 한 줄 요약(인원 수 포함), 위험 단서, 확실한 비용(예: "장작 80kg"), 추천한 조언자 초상이 보인다.

### 6.4 전략 두 칸: 식량 + 발전 (2026-11-24 확정, CLAUDE.md M4의 방침 조합을 M2로 앞당김)
3~10월 플레이테스트 피드백: 식량이 유일한 축이라 매달 식량 전략이 늘 정답이고, 가을부터 식량이 바닥나는 흐름이 무엇을 해도 바뀌지 않아 단조롭다. 그래서 매달 **식량 전략 1개 + 발전 전략 0~1개**, 또는 두 칸을 모두 쓰는 **큰 일 1개**를 고른다. 중간 사건과 위험 단서 4단계는 그대로다.

**확정된 결정 (사용자 승인 2026-11-24)**
1. 일손: 발전 전략이 정한 인원을 고정으로 쓴다. 인원 슬라이더는 M4 선택 해상도로.
2. 발전 카드에 식량 대가를 kg로 보인다("마을 식량 약 −90kg").
3. 큰 일: 순록 떼 대사냥 + 바위굴로 옮기기. 곰 사냥은 전략으로 꺼내지 않고 사건으로 둔다.
4. 의례 효과: 결속 + 단서만 (결속이 노동 효율에 닿는 새 규칙은 만들지 않는다).
5. 발전 칸은 첫 달(3월)부터 연다.

**구현 메모 (커밋 ①)**: `PolicyTemplate.slot`, `builds`, `crew.atHome` / `FacilityDef`(`ChapterDefinition.facilities`) / `GameState.facilities`·`projects` / `MonthWork.plan: PlanEntry[]`(전략마다 무리·원정지·짐), `active`, `planIndex`, `lastEventPhase`, `savings` / 명령 `choosePlan { uids }` / `previewPlan`(`engine/policy/plan.ts`) / 지금 전략의 맥락은 `engine/policy/current.ts`. 후보 순서는 큰 일 → 식량 → 발전. 덕분에 줄은 장부 출처 `bonus.facility.<id>`·`bonus.knowledge.<id>`(합은 그대로), 아낀 장작·덜 상한 양은 장부가 아닌 `savings`.

#### 6.4.0 문제를 숫자로 확인 (현재 코드, 임시 측정 200판)

봄 시작, 월말 식량 며칠치 중앙값 (3월 → 2월)

| 전략 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 1 | 2 | 누적 사망 p50 (2월 말) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| sure (거의 확실하다만) | 11 | 8 | 15 | 20 | 21 | 23 | 17 | 5 | 0 | 0 | 0 | 0 | 18 |
| 식량 최대 (식량 분야만, 위험 제외) | 11 | 8 | 15 | 20 | 21 | 22 | 12 | 11 | 2 | 0 | 0 | 0 | 15 |
| random | 2 | 1 | 1 | 1 | 3 | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 18 |

- sure 전략의 선택은 강가 채집 1367회, 올가미 331, 물고기 떼 222… 발전 방침은 거의 안 골랐다. **식량 전략만 고르는 것이 정답인 구조**가 시뮬레이터에서도 보인다.
- 원인 세 가지 (코드 기준)
  1. **여름 남는 양이 남지 않는다.** 물고기는 더운 철 순당 20%, 풀·뿌리 6%가 상한다. 저장고가 늘 20일치 언저리에서 멈춘다.
  2. **가을의 상한이 낮다.** 강가 견과 재고 900kg가 철 전체의 한계다. 아무리 모아도 그 이상 안 나온다.
  3. **발전의 효과가 작고 안 보인다.** 말리기 지식 부패 ×0.85, 그물 +1개 등. 한 달을 식량에서 빼서 쓸 만큼의 값이 아니고, 정산표에 "덕분에"가 보이지 않는다.

핵심 판단: 식량 전략은 "오늘 먹을 것", 발전은 **그릇을 키우는 것**(상한, 손실, 겨울 공급원)으로 나눠야 한다. 여름의 남는 양을 겨울로 넘기는 통로가 발전에만 있으면 "지금 먹을까, 그릇을 키울까"가 매달의 고민이 된다.


#### 6.4.1 두 칸의 규칙

##### 6.4.1.1 칸의 종류
| 칸 | 묻는 것 | 고를 수 있는 수 |
|---|---|---|
| **식량** | 이번 달 어떻게 먹을까 | 반드시 1개 (버티기 포함) |
| **발전** | 어디로 클까 | 1개 또는 "발전하지 않는다" |
| **큰 일** | 두 칸을 모두 쓴다 | 고르면 두 칸이 함께 잠긴다 |

##### 6.4.1.2 후보 생성
- 지금의 `generateCandidates`를 칸마다 돌린다. 점수 규칙(§6.1: priority + relevance + 흔들림)은 그대로.
- **식량 칸**: 3~4개. 급할 때(`urgentFoodDays`) 3개. 버티기(배급 줄이기) 1개 보장. 같은 분야 최대 2개.
- **발전 칸**: 2~3개 + "발전하지 않는다"(늘 있음). 급할 때도 2개는 보인다(급할수록 발전을 포기하는 고민이 핵심이므로 숨기지 않는다).
  - 짓는 중인 일(여러 달 걸리는 일)은 점수 +30으로 이어 가기 쉽게.
  - 이미 다 지은 1회성 발전은 후보에서 빠진다.
- **큰 일**: 조건을 만족할 때만 팝업 맨 위에 따로 한 줄. 최대 1개.
- 뜻밖의 후보(§6.2)는 발전 칸에서만 나온다(탐색, 이웃 찾기).

##### 6.4.1.3 일손 배분 — 사람 수를 보인다
- 자동 비율이 아니라 **발전 전략이 정한 인원**을 쓴다. 발전은 대부분 작은 무리(장인 1 + 2~3명)다.
- 순서: 큰 일 → 발전 무리(정해진 사람·자리 먼저: 이끼, 노을) → 식량 무리(원정이면 사냥꾼) → 나머지는 마을 일.
- 마을에 남는 최소 인원(`keepHome`)은 두 칸을 합쳐서 지킨다. 합쳐서 못 지키면 그 조합은 고를 수 없게 흐리고 이유를 보인다("마을에 6명이 남아야 합니다").
- 장작은 지금처럼 식량 전략의 `firewoodShare`와 자동 규칙이 정한다. 발전 칸에서 "장작 모으기"를 고르면 그 달 장작 몫을 올린다.
- 팝업 위의 **일손 막대**가 고를 때마다 갱신된다: "일손 20명 · 식량 16 · 발전 4". 발전 카드에는 **그 대가를 식량 kg로** 보인다("마을 식량 약 −90kg").

##### 6.4.1.4 결정 팝업 (텍스트 와이어프레임)
```
┌ 이번 달 전략 · 1년차 · 여름 · 6월 ───────────────────────────┐
│ 일손 20명  ■■■■■■■■■■■■■■■■□□□□   식량 16명 · 발전 4명          │
│                                                              │
│ ★ 큰 일 (두 칸을 모두 쓴다) — 이 달에는 없음                     │
│                                                              │
│ ① 식량 — 이번 달 어떻게 먹을까                                 │
│  [그림] 강가 채집과 어로       거의 확실하다      ● 고름          │
│         마을 16명                                             │
│  [그림] 숲에서 사슴 사냥       해볼 만하다                       │
│         사냥 5명 · 마을 11명 · 창 5자루                          │
│  [그림] 잡은 것부터 말린다     거의 확실하다                      │
│         마을 16명 · 장작 30%                                   │
│  [그림] 배급을 줄이고 버틴다   거의 확실하다                      │
│                                                              │
│ ② 발전 — 어디로 클까                                          │
│  [그림] 건조대 짓기 (1/1달)    해볼 만하다        ● 고름          │
│         이끼와 3명 · 마을 식량 약 −90kg                         │
│         다 지으면: 매 순 날것 40kg을 저절로 말린다                │
│  [그림] 그물 하나 더 엮기      거의 확실하다                      │
│         이끼와 1명 · 마을 식량 약 −45kg                         │
│         다 지으면: 강가 어로 +20%                                │
│  [그림] 남쪽 늪지 너머 탐색    결과를 알 수 없다                  │
│         4명 · 6일 · 마을 식량 약 −90kg                          │
│  ( ) 발전하지 않는다 — 4명이 식량에 보탠다                       │
│                                                              │
│ 바위 "그물로 겨울을 나진 못합니다. 지금 잡을 수 있을 때 잡읍시다."  │
│ 이끼 "건조대 하나면 지금 물고기가 눈달까지 갑니다."               │
│ 서리 "늪 너머는 아무도 모릅니다. 사람을 넷이나 보낼 땐가요."        │
│                                   [ 한 달을 시작한다 ]          │
└──────────────────────────────────────────────────────────────┘
```
- 같은 `DecisionPopup` 안에 구역 두 개. 한 번 확정으로 두 칸이 함께 나간다(클릭 수를 늘리지 않는다).
- 지난달 고른 발전이 이어지는 일이면 처음부터 골라져 있다(여러 달짜리 공사를 매달 다시 찾지 않게).
- 큰 일을 고르면 두 구역이 흐려지고 "순록 떼 대사냥이 모든 일손을 씁니다"가 뜬다.
- 키보드: 1~4 식량, 5~8 발전(또는 Tab으로 구역 이동 + 1~4). 모바일은 위아래로 쌓고 팝업 안에서 스크롤.
- 조언은 두 칸을 가로질러 엇갈린다(바위=식량·큰 일, 이끼=도구·시설, 서리=저장·의례, 노을=돌봄·사람 아끼기).


#### 6.4.2 지금 전략 25개 나누기

| 칸 | 전략 (id) | 비고 |
|---|---|---|
| 식량 | 봄 물고기 떼 어살 (`fish_run_weirs`) | |
| 식량 | 강가 채집과 어로 (`river_gather`) | |
| 식량 | 봄 순록 낙오자 사냥 (`spring_reindeer_hunt`) | 원정 4~8명 |
| 식량 | 숲 사슴 사냥 (`forest_hunt`) | 원정 4~6명 |
| 식량 | 열매와 견과 (`nut_gather`) | |
| 식량 | 소규모 사냥 + 겨울 준비 (`small_hunt_prep`) | 원정 4~6명 |
| 식량 | 올가미 (`snare_hunt`) | |
| 식량 | 얼음 구멍 낚시 (`ice_hole_fishing`) | |
| 식량 | 눈 위의 사슴 사냥 (`deer_hunt_snow`) | 원정 4~7명 |
| 식량 | 묻어 둔 고기 회수 (`recover_cache`) | 원정, 묻은 곳마다 |
| 식량 | 말리기 (`drying_racks`) → **"잡은 것부터 말린다"** | 일손을 말리기에 쓴다. 시설은 발전의 "건조대 짓기"로 분리 |
| 식량 | 배급 줄이고 버티기 (`hold_and_ration`) | 버티기 보장 |
| 발전 | 남쪽 늪지 탐색 (`marsh_scouting`) | 원정 3~4명, 이웃 |
| 발전 | 그물 엮기 (`net_making`) | 지속 효과 수치 상향 |
| 발전 | 바위굴 찾기 (`find_rock_cave`) | 원정 3~4명 |
| 발전 | 굴 다지기 (`cave_fortify`) | 저장 구덩이 |
| 발전 | 장작 덧집 (`firewood_stockpile`) | 1회성으로 바꿈 |
| 발전 | 가죽 손질과 겨울옷 (`tan_hides`) | |
| 발전 | 갈대호수 찾아가기 (`reed_lake_visit`) | 원정 3~4명, 교역 |
| 발전 | 끌개 엮기 (`make_sled`) | |
| 발전 | 얼음 낚시 도구 (`ice_tools`) | |
| 발전 | 장작 모으기 (`winter_prep`) | 되풀이 가능, 쌓는 일 |
| 발전 | 아픈 사람 간호 (`nurse_sick`) | "돌봄". 노을만 빠진다 |
| 큰 일 | 순록 떼 대사냥 (`reindeer_big_hunt`) | 원정 8~14명 |
| 큰 일 | 바위굴로 옮기기 (`move_to_cave`) | 부족 전체가 움직인다 |

식량 12 · 발전 11 · 큰 일 2.

##### 6.4.2.1 모자라는 발전 전략 (새로 쓸 것, 8개)
| 전략 | 철 | 무리 | 지속 효과 (요약) | 연결 |
|---|---|---|---|---|
| 건조대 짓기 | 늦봄~여름 | 이끼 + 3명, 1달 | 날것 자동 말림 | P1 |
| 돌 어살 쌓기 | 봄~여름 | 4명, 2달 | 강가 어로·물고기 떼 상한 증가 | P1, 봄 |
| 마을 저장 구덩이 | 여름~가을 | 3명, 2달 | 견과·말린 것 부패 감소, 은닉 습격 감소 | P4 (굴 없이도) |
| 새 채집터 찾기 (열매 골짜기) | 여름 | 3명, 원정 3일 | 가을 견과 상한 +800kg | 가을 상한 문제 |
| 올가미 엮기 익히기 | 가을 | 이끼 또는 손 좋은 1명 + 1명 | 올가미 ×1.5, 토끼 회복 빨라짐 | 겨울 식량원 |
| 불가의 옛이야기 (의례) | 언제나 (쿨다운 2) | 서리, 일손 −1 | 결속 +6, 옛이야기 단서 1개 | C6 단서의 출처 |
| 움집 짓기 (터 닦기) | 여름~가을 | 5명, 3달 | 장작 ×0.6, 영구 거처의 다른 길 | 굴을 못 얻었을 때 |
| 발전하지 않는다 | 언제나 | 0명 | 없음 (그 달 전원 식량) | 늘 후보 |

→ 전략 총 33개 (식량 12 · 발전 19 중 "하지 않는다" 포함 · 큰 일 2). M2 목표 "20개 이상"은 그대로 충족.


#### 6.4.3 발전의 지속 효과 (수치 초안)

기준: 마을 일손 약 16명, 월 소비 856kg(하루 28.5kg). "한 달 이득"은 효과가 가장 잘 듣는 철 기준.

| 발전 | 비용 | 지속 효과 (스탯) | 한 달 이득 (초안) |
|---|---|---|---|
| 그물 (+1, 최대 3) | 이끼 + 1명 1달, 가죽 1 | `yield.fish` ×(1 + 0.2 × (그물 − 1)) | 여름 어로 +60kg/개 |
| 돌 어살 | 4명 × 2달 | 강가 `fish` ×1.3, 물고기 떼 재고 1600 → 2400 | 봄 +400kg (한 번), 여름 +80kg |
| 건조대 | 이끼 + 3명 1달 | 매 순 날것 최대 40kg을 말림(일손 없이, 무게 ×0.8). "잡은 것부터 말린다"의 말림량 ×1.5 | 6~10월 합계 약 +400kg이 겨울까지 남는다 |
| 저장 구덩이 (마을 또는 굴) | 3명 × 2달 | 뿌리·견과·말린 것 부패 ×0.5, `cache.raid` ×0.3 | 가을~겨울 손실 약 −150kg |
| 새 채집터 | 3명, 3일 원정 (탐색 판정) | 견과 상한 +800kg (가을), 뿌리 +300 | 가을 +500kg |
| 장작 덧집 | 4명 1달 (1회) | 장작 상한 +600 (지금과 같음) | 겨울 장작 일손 2명 → 식량 +40kg/월 |
| 가죽옷 | 가죽 6, 2달 | 장작 ×0.8, 추위 사냥 동상 감소 (지금과 같음) | 한겨울 장작 120kg 절약 |
| 올가미 엮기 | 2명 1달 | `yield.snare` ×1.5, 토끼 회복 0.3 → 0.45/달 | 겨울 +150kg/월 |
| 얼음 낚시 | 지금과 같음 | 겨울 물고기 0 → 순당 1인 5kg, 그물이 있으면 ×그물 배율 | 겨울 +200kg/월 (지금 약 +130) |
| 끌개 | 지금과 같음 | 운반 ×1.4 / 눈 위 ×1.8 | 대사냥에서 버리는 고기 −200kg |
| 바위굴 · 움집 | 지금과 같음 / 5명 × 3달 | 장작 ×0.5 / ×0.6 | 한겨울 장작 300kg 절약 |
| 갈대호수 교역 약속 | 원정 + 가죽 | 계절마다 말린 물고기 150~300kg | 겨울 +200kg/월 |
| 옛이야기 (의례) | 서리, 일손 1 | 결속 +6, 단서 1개(사냥 판정 +1) | 겨울 사냥 한 번이 "위험해 보인다" → "해볼 만하다" |

**보이게 하기**: 월말 정산의 얻은 것(+)에 "덕분에" 줄을 넣는다. 예: "그물 2개 덕분에 +62kg", "건조대가 말린 고기 112kg". 장작 쓴 것(−)에는 "바위굴이라 −300kg 아낌". 엔진이 그 시설의 모디파이어를 뺀 값과 넣은 값의 차이를 장부에 남긴다. "발전이 숨통을 틔운다"를 화면에서 바로 읽히게 하는 장치다.

##### 6.4.3.1 가을~겨울 식량 흐름 예상 (손으로 계산한 값, 시뮬레이터로 확인할 것)

준비 정도는 §10.8의 다섯 가지 기준 그대로. 겨울(11~2월) 필요량 = 856 × 4 = 3424kg + 상함·사건 손실 약 400kg ≈ **3800kg**.

| | 지금 (실측, sure) | 준비 낮음 (발전 0~1) | 준비 보통 (발전 3~4) | 준비 높음 (발전 6+) |
|---|---|---|---|---|
| 6~10월 고른 발전 | 거의 없음 | 그물 1 | 건조대, 장작 덧집, 가죽옷 또는 굴 | 건조대, 어살, 새 채집터, 저장 구덩이, 굴, 올가미 또는 얼음 낚시, 교역 |
| 11월 1일 비축 | 약 150kg (5일치) | 약 600kg (20일치) | 약 1400kg (50일치) | 약 1700kg (60일치) |
| 겨울 한 달 수입 | 약 100kg (올가미뿐) | 약 400kg (겨울 사냥, 올가미) | 약 500kg | 약 600kg (+교역) |
| 겨울 장작 일손 | 많음 | 많음 | 덧집·옷으로 2명 줄어듦 | 굴로 4명 줄어듦 |
| 겨울 부족분 | 약 3300kg | 약 1600kg | 약 400kg | 약 0kg (최저 7~12일치) |
| 겪는 일 | 11월부터 굶주림 3달 | 12월 말 바닥, 1~2월 배급 감축·굶주림 | 2월에 배급 감축 2~3순 | 배급 감축 0~2순 |
| 첫 겨울 사망 (목표 §10.8) | 18 (p50) | 2~3 | 1~2 | 0~1 |

- 낮음의 "2~3명"은 비축만으로는 안 맞는다. 쓰러짐 확률(§10.5)과 겨울 사냥 수확도 함께 맞춰야 한다(남은 M2 작업 8번과 합친다).
- 높음이 너무 넉넉해지면(최저 30일치 이상) 건조대와 새 채집터 수치를 먼저 깎는다.
- **봄에는 발전이 비싸다**: 3월은 4일치에서 시작하므로 발전에 4명을 보내면 식량 −90kg(3일치)이다. 봄에 발전을 하려면 물고기 떼가 오는 4월을 기다리거나 위험을 감수해야 한다. 이것이 봄의 고민이 된다.


#### 6.4.4 시험 플레이의 재미를 해치는가

| 재미 요소 | 판단 | 지키는 방법 |
|---|---|---|
| 상황에서 나오는 선택지 | **좋아진다.** 지금은 식량 후보가 다른 후보를 밀어냈다. 칸이 나뉘면 굴·그물·탐색이 늘 화면에 남는다 | 두 칸 모두 `appearsWhen`과 relevance로 고른다. 발전 칸도 고정 목록이 되지 않게 철·사람·자원 조건을 둔다 |
| 조언 갈등 | **좋아진다.** "지금 먹을까, 그릇을 키울까"가 조언자 성격과 그대로 맞는다 | 조언 데이터에 칸을 가로지르는 줄을 둔다 |
| 대가 있는 성공 | 유지 | 발전도 판정을 한다(그물 엮다 가죽 2장 버림, 어살 쌓다 다리 다침, 탐색에서 열병). 큰 일은 그대로 |
| 중간 사건 | 유지, 단 넘치지 않게 | 사건 창은 두 칸에서 모두 열리지만 **한 순에 하나**. 식량 칸 먼저 굴리고, 안 나왔으면 발전 칸 |
| 위험 단서 4단계 | 그대로 | 카드마다 따로 |
| 뒤늦은 결과 | 좋아진다 | 시설이 겨울에 "덕분에" 줄로 돌아온다. 탐색·교역 약속은 지금 구조 그대로 |

**위험**
1. **결정 피로**: 매달 두 번 고르면 스프레드시트처럼 느껴질 수 있다 → 한 팝업·한 확정, 이어지는 공사는 미리 골라 두기, 평온한 달 요약은 그대로.
2. **새 정답**: "식량 1위 + 발전 아무거나"가 늘 정답이 될 수 있다 → 발전은 대부분 1회성이라 같은 것을 반복할 수 없다. 되풀이되는 발전(장작 모으기, 의례, 탐색)은 기회비용이 크게. 시뮬레이터에 칸별 선택률과 "발전하지 않는다" 선택률을 넣는다.
3. **식량 칸이 여전히 단조롭다**: 식량 칸 안의 고민은 "안전한 채집 vs 원정 사냥 vs 말리기 vs 버티기"로 남는다. 말리기가 식량 칸에 있는 것이 중요하다(지금 먹을 양을 줄여 나중을 산다).


#### 6.4.5 바뀌는 범위와 작업 순서

##### 6.4.5.1 엔진
- `PolicyTemplate.slot: 'food' | 'growth' | 'major'`. 여러 달짜리 일은 `project: { id, months }`(진행도는 `GameState.projects`).
- **시설**: `ChapterDefinition.facilities: FacilityDef[]`(id, 최대 단계, mods). `GameState.facilities: Record<id, level>`. 효과 `{ type: 'facility', id, delta }`, 조건 `{ type: 'facility', id, min }`. 장작 덧집(`wood_shed` 깃발 + 전역 모디파이어)은 시설로 옮긴다. 지식은 "아는 것", 시설은 "지은 것"으로 나눈다.
- `work.chosen` → `work.plan: { food: BoundPolicy; growth?: BoundPolicy } | { major: BoundPolicy }`. 명령 `choosePolicy` → `choosePlan`.
- `generateCandidates` → 칸별 후보. 원정대 구성은 큰 일 → 발전 → 식량 순으로, 이미 뽑힌 사람을 뺀다.
- 순 처리(`month.ts`): 두 칸의 단계를 함께 돈다(발전 서술 → 식량 서술 → 마을 일). 사건 창은 순당 하나.
- 장부에 "덕분에" 줄: 시설 모디파이어를 뺀 값과의 차이(`ledger` source `bonus.<facility>`).
- 세이브 v4: `work.chosen`, `wood_shed` 깃발 → 새 구조로 옮기는 마이그레이션.
- 시험: 두 칸 진행, 일손 합 제한, 사건 순당 하나, 시설 효과와 덕분에 줄, 세이브 왕복, 시드 재현.

##### 6.4.5.2 데이터
- 25개에 `slot` 달기, `drying_racks` 나누기, 새 발전 8개(서술 각 2변형, 문자열, 장면 id), 시설 정의, 수치(§6.4.3) → `ch1/balance.ts`.
- 조언 데이터에 칸을 가로지르는 줄.
- 검증기: 모든 전략에 slot, 발전 전략은 지속 효과(시설·지식·단서·깃발) 하나 이상, 시설 id 참조 확인.

##### 6.4.5.3 화면
- `Decision.tsx`의 `decisionModel`에 구역 두 개 + 큰 일 줄 + 일손 막대. 카드는 지금 컴포넌트를 그대로 쓴다.
- 이달의 결과에 "덕분에" 줄, 측면에 "지은 것" 목록(짧은 효과와 함께).
- 진행 화면 문단 이름표에 `growth`(발전) 무리 추가.

##### 6.4.5.4 시뮬레이터
- 전략이 두 칸을 고른다: sure(식량 sure + 발전 sure), foodmax(발전 안 함), greedy(준비 체크리스트를 채우는 발전 우선), random.
- 리포트: §6.4.3.1 표를 그대로 뽑는다(준비 정도별 11월 1일 비축, 첫 겨울 사망, 최저 며칠치), 칸별 선택률, "발전하지 않는다" 선택률.
- **목표 추가**: foodmax(발전 안 함)가 greedy보다 첫 겨울 사망이 확실히 많아야 한다(중앙값 2명 이상 차이). 이것이 "식량만 고르면 안 된다"의 숫자 검증이다.

##### 6.4.5.5 작업 순서와 커밋 (확정)
1. 문서 반영 (이 절, §9.1, CLAUDE.md)
2. **커밋 ① 엔진**: 칸, `choosePlan`과 `previewPlan`, 일손 배분, 시설과 공사, 덕분에 줄과 아낀 양, 세이브 v4, 시험. 결정 팝업은 최소 동작(칸 제목, 칸마다 하나 고르기, 발전하지 않는다, 대가 kg). 25개 전략에 칸만 달았다 — **2026-11-24 완료**
3. **커밋 ② 데이터와 화면**: 새 디자인 시안(진행 화면, 이달의 결과, 결정 팝업 두 칸)을 받은 뒤. 칸 나누기 마무리(`drying_racks` 나누기, 원정이 아닌 발전을 `crew.atHome` 무리로 바꾸기), 새 발전 8개, §6.4.3 수치, 덕분에 줄과 아낀 양, 지은 것 목록
4. **커밋 ③ 시뮬레이터와 밸런스**(§22.5의 8번 포함): 두 칸 전략(sure, foodmax, greedy, random), §6.4.3.1 표 리포트, 칸별 선택률, 새 목표 "발전 안 하는 전략(foodmax)이 준비 노리는 전략(greedy)보다 첫 겨울 사망 중앙값 2명 이상 많음"
5. 그 뒤 §22.5의 9(서술 변형), 10(첫 해 끝 화면) → ⚑ 플레이테스트

---

## 7. 결과 등급

### 7.1 계산
```
힘 = Σ PowerTerm (인원 × 숙련, 도구, 지식, 날씨, 장소 재고, 인물 특성, 단서)
여유 m = 힘 − 난이도
굴림 r = (u1 + u2 − 1) × spread         // 삼각 분포, spread는 balance
값 v = m + r
등급: v ≥ T.triumph → 대성공 / ≥ T.success → 성공 / ≥ T.costly → 대가 있는 성공 / ≥ T.failure → 실패 / 그 아래 → 참사
```
- 삼각 분포는 등급별 확률을 **닫힌 식으로 계산**할 수 있다. 그래서 위험 단서를 정확히 낼 수 있고, 시뮬레이터 없이도 테스트할 수 있다.
- **"대가 있는 성공" 구간을 넓게 잡는다**(balance 초안: 성공 구간과 같은 폭). 시험 플레이에서 가장 기억에 남은 유형이다.

### 7.2 위험 단서 (4단계)
- 대가 있는 성공 이상이 나올 확률 p로 정한다. 거의 확실하다(p ≥ 0.85), 해볼 만하다(0.55 ≤ p < 0.85), 위험해 보인다(p < 0.55). 경계는 balance에 둔다.
- **결과를 알 수 없다**는 확률 구간이 아니다(확정 D3). 판정에 아직 모르는 변수(`hidden`)가 있을 때 쓴다. 예: 곰이 깊이 잠들었는지, 순록 본 무리가 어디로 올지, 이웃이 반길지, 묻어 둔 고기가 남았는지.
  - 정찰, 노인의 옛이야기, 이웃의 정보가 그 변수를 밝히면 단서가 세 단계 중 하나로 바뀐다.
  - 이것이 "정보를 모으는 행동"의 가치를 만든다.

### 7.3 대가 표와 조언
**대가 표**(`CostEntry`)는 대가 있는 성공에서 1개, 참사에서 1~2개 뽑는다.
```ts
{ weight: 3, when: [...], effects: [{ type: 'injure', who: { participant: 'bravest' }, kind: 'claw', severity: 2 }] }
{ weight: 1, when: [{ type: 'animal', id: 'bear', state: 'awake' }], effects: [{ type: 'kill', who: { participant: 'random' }, causeKey: 'death.bear' }] }
{ weight: 2, effects: [{ type: 'goods', key: 'spear', delta: -3 }] }
{ weight: 2, effects: [{ type: 'leftover', to: 'cache' }] }   // 다 못 가져와 묻어 둔다
```
죽음 비용의 가중치는 활동의 위험도(`danger`)와 날씨에 비례한다. 첫 겨울 목표치(§10.5)를 맞추는 손잡이다.

**조언**: 조언자마다 입장이 있다(시험 플레이 기준: 바위 대담, 서리 신중, 노을 실용, 이끼 기술). 방침 후보와 사건 선택지를 입장 점수로 평가한다.
- bold: 기대 수확↑, 위험 무시
- cautious: 죽음 위험↓, 불과 지붕 먼저, 옛 겨울의 기억(단서를 말하는 쪽)
- practical: 식량과 장작의 며칠분, 가까운 곳에서 조금씩
- inventive: 도구와 지식 진행, 새 방법 시도
각 조언자는 가장 높게 친 선택에 대해 **대사 템플릿**을 말한다(분야 × 입장 × 상황 조건). 서로 같은 걸 고르면 둘째 후보를 말하게 해서 엇갈림을 보장한다. 다치거나 슬픈 조언자는 다른 대사 세트를 쓴다.

### 7.4 표시 원칙
- 확실한 비용(장작 80kg, 인원 14명 차출)은 수치로 보여 준다
- 불확실한 결과는 단서 문구만 보여 준다
- 정산표에서 등급과 원인을 짧게 공개한다(예: "눈보라 탓에 성공 확률이 낮았다"). 그래야 다음 선택을 배울 수 있다

---

## 8. 세계의 기억 (지연 결과)

```ts
interface MemoryState {
  caches: { id: Id; placeId: Id; lots: FoodLot[]; hiddenMonth: number; scent: number }[];
  promises: { id: Id; neighborId: Id; kind: Id; due: { from: number; to: number } | { season: SeasonId }; textKey: string }[];
  ledger: Record<Id, LedgerEntry[]>;                 // 이웃별 은혜와 원한 { month, kind: 'gift'|'help'|'theft'|'raid'|'refusal', weight }
  clues: { id: Id; sourcePersonId?: Id; textKey: string; mods: ModifierDef[]; reveals?: HiddenVarId[]; expiresMonth?: number }[];
  scheduled: { uid: Id; eventId: Id; window: { from: number; to: number }; when?: Condition[]; actors: Record<string, Id> }[];
}
```
- **은닉물**: 매달 부패하고, `scent`가 쌓이면 늑대나 여우가 노린다. 되찾는 방침이 후보로 생긴다("여울의 고기를 찾으러 간다")
  - 은닉물의 현재 상태(남은 양, 짐승이 손댔는지)는 **숨은 변수**다. 묻은 직후에는 알고 있지만, 한 달이 지나면 "결과를 알 수 없다"로 바뀐다. 근처를 지나간 사람이나 정찰이 다시 밝힌다.
  - 시험 플레이처럼 회수 선택지가 매달 나오고, 시간이 지날수록 불확실해진다.
- **약속**: 기한 창 안에서 조건이 맞는 첫 달에 월초 사건이 된다
- **장부**: 이웃의 반응 점수에 합산된다. 오래된 항목은 가중치가 줄지만 사라지지는 않는다(원한은 더 천천히 준다)
- **단서**: 확률 보정 또는 숨은 변수 공개. 노인의 옛이야기, 정찰, 이웃의 말에서 생긴다
- **"아직 남은 일"** 패널은 이 장부를 사람이 읽을 문장으로 보여 준다. 예: "여울 돌무더기 아래 고기 약 90kg (묻은 지 한 달)", "갈대호수 사람들: 얼음이 녹으면 다시 온다"

---

## 9. 지식

지식은 진행도 값을 가진다. 진행도가 차는 원천은 다음과 같다.
- **반복**: 관련 방침을 할 때마다(실패해도 조금)
- **배움**: 이웃 교류 사건
- **제안**: 인물이 시도를 제안하는 사건 → "시험해 본다" 방침이 후보에 오른다

진행도가 차면 해금 장면이 뜨고, 효과(모디파이어)와 새 방침이나 선택지가 열린다.

1장 초안(M4에서 확정):

| 지식 | 주된 원천 | 효과 |
|---|---|---|
| 고기 말리기·훈연 | 반복(손질 방침), 이웃 | 날고기를 말린 고기로 바꾸는 방침, 부패 크게 감소 |
| 저장 구덩이 | 제안(이야기꾼) | 마을 안 은닉, 동물 습격 감소 |
| 끌개 엮기 | 제안(장인), 운반 한계로 고기를 남긴 경험 | 눈 위 운반 ×1.8 |
| 얼음 낚시 | 제안(장인) + 시험 방침 | 겨울 식량원 |
| 물고기 말리기 | 이웃(갈대호수) | 물고기 부패 감소, 교역품 |
| 올가미 엮기 | 반복 | 토끼 올가미 확대(고갈 주의) |
| 가죽옷 짓기 | 반복(가죽 손질) | 추위 피해 감소, 장작 소비 소폭 감소 |
| 굴 다지기 | 제안 | 바위굴 장작 효율, 방어 |
| 별과 짐승 길 읽기 | 옛이야기 단서 누적 | 순록 이동 예측(숨은 변수 공개) |
| 움집 짓기 | 이웃 또는 반복 | 영구 거처 목표의 길 |
| 씨앗 심기 | 채집 반복 + 정착 상태 | 식량 안정 목표의 길, 신석기 |
| 짐승 길들이기 | 사건(늑대 새끼, 다친 순록) | 신석기 |
| 토기 | 제안(장인) + 정착 상태 | 저장 효율, 신석기 |

### 9.1 시설 (지은 것, 2026-11-24)
- 지식은 **아는 것**, 시설은 **지은 것**이다. `FacilityDef { id, max, mods, perPhase? }`, 상태는 `GameState.facilities[id] = 단계`.
- 단계가 1 이상이면 `mods`가 걸린다. 단계별 차이는 모디파이어의 `when`에 `{ type: 'facility', id, min }`.
- `perPhase`: 순마다 저절로 하는 일(건조대가 날것을 말린다). 마을 살림 맨 앞에서 적용한다.
- 짓는 일: 전략의 `builds: { facility, months }`. 고른 달마다 `projects[id]`가 1씩 오르고 months에 닿으면 단계가 오른다("다 지었다" 줄, 연대기 후보). 다 지은 시설의 전략은 후보에서 빠지고, 짓다 만 공사는 점수 +`balance.policy.projectBonus`.
- 효과 `{ type: 'facility', id, level?, progress? }`: 실패한 판정이 공사를 늦출 때 `progress: -1`.
- 1장 시설: 장작 덧집(`wood_shed`, 장작 상한 +600). 이전의 깃발 `wood_shed`는 세이브 v4에서 시설로 옮긴다. 나머지(건조대, 돌 어살, 저장 구덩이, 움집 등)는 커밋 ②에서 §6.4.3 수치로 넣는다.

---

## 10. 밸런스 초안

모든 수치는 `data/balance.ts`(공통)와 `data/chapters/ch1/balance.ts`(1장)에 둔다. **시험 플레이 기록의 수치를 기준점**으로 삼는다. 표의 "기록" 열은 `docs/playtest-log.md`에서 나온 값이다.

### 10.1 사람과 소비
| 항목 | 값 | 기록 |
|---|---|---|
| 연령 경계 | 아이 0~13, 성인 14~49, 노인 50+ | |
| 월 소비 | 성인 30kg, 노인 25kg, 아이 18kg (하루 1/30) | 같음 |
| 노동 | 성인 1.0, 노인 0.5(가벼운 일만), 아이 0 | 같음 |
| 시작 인원 | 34명: 성인 18(남 9, 여 9), 노인 4, 아이 12 | 같음 |
| 월 소비 합계 | 18×30 + 4×25 + 12×18 = **856kg (하루 약 28.5kg)** | 856 |

### 10.2 시작 물자
**봄 시작 (화면에 보이는 프리셋, 1년차 3월 녹는달)**: 긴 겨울을 막 넘긴 부족.
| 항목 | 값 |
|---|---|
| 인원 | 34명 (성인 18, 노인 4, 아이 12) — 시험 플레이와 같음 |
| 식량 | 약 120kg (4일치): 뿌리와 겨울에 남은 말린 고기 |
| 장작 | 80kg |
| 가죽 | 4장 (겨울에 다 썼다) |
| 거처 | 낡은 가죽 천막 5채 |
| 도구 | 돌창 14, 돌칼 9, 그물 1 |
| 건강 | 노인 1명 기침 (서리는 아니다. C5를 위해 서리는 건강하게 둔다) |
| 결속 | 55 (겨울을 넘긴 안도와 지친 기색) |

- **확인 조건**(사용자 지시): 3월에 "거의 확실하다" 방침(봄 어로, 새순 채집)만으로 굶주림 없이 4월로 넘어갈 수 있어야 한다. 시뮬레이터 단계에서 확인하고, 안 되면 **시작 수치를 바꾸기 전에 먼저 보고한다.** 봄 물고기 떼(§10.3)가 이를 받친다.

**늦가을 시작 (숨은 테스트 프리셋, 낙엽달)**: 시험 플레이 재현 테스트(§10.8)에만 쓴다. 화면의 시작 목록에 나오지 않는다.
| 항목 | 값 |
|---|---|
| 식량 | 520kg (18일치) |
| 장작 | 150kg |
| 가죽 | 12장 |
| 거처 | 가죽 천막 5채 |
| 도구 | 돌창 14, 돌칼 9, 그물 1 |

### 10.3 생산과 소모 (첫 겨울 기준점)
| 항목 | 값 (초안) | 기록 |
|---|---|---|
| 순록 한 마리 | 고기 50kg, 가죽 1 | 3마리 150kg |
| 순록 대사냥 (14명, 본 무리) | 성공 10~14마리 / 대성공 15~18 | 14마리 700kg |
| 붉은사슴 한 마리 | 고기 90kg | 9마리 810kg |
| 곰 | 고기와 기름 250kg, 곰 가죽 1 | 250kg |
| 올가미 (30개, 순당) | 120kg → 고갈로 매 순 약 −15% | 120 / 340 / 220 |
| 마을 채집 (늦가을, 순당 1인) | 약 5kg | 한 달 90kg |
| 운반 한계 | 1인 32kg | 450kg / 14명 |
| 장작 소모 (천막, 하루) | 늦가을 4kg, 초겨울 13kg, 한겨울 20kg | 110 / 130(순) / 월 600 |
| 거처 배율 | 바위굴 ×0.5, 움집 ×0.6 | "장작이 절반만" |
| 날씨 배율 | 한파 ×1.3, 눈보라 ×1.5 | |
| 장작 모으기 (1인 하루) | 늦가을 5kg, 겨울 3kg (눈) | 열흘 180kg |
| 큰 불 지키기 (사흘 밤) | 장작 80kg | 80kg |
| 부패 (순당) | 날고기: 늦가을 1.5%, 겨울 0.5%, 봄 6%, 여름 15% / 말린 고기·물고기 0.5% / 은닉 고기: 날고기 ×1.5 + 짐승 습격 판정 | 한 달 20kg |
| 교역 (갈대호수) | 순록 가죽 10장 ↔ 말린 물고기 150kg | 같음 |
| **봄 물고기 떼** (3~4월, 동물 주기처럼 오는 상태) | 강가 어로 1인 순당 약 12kg (평소 봄 2kg). 상태 `fish_run`이 끝나면 평소로 | — |
| 여름 채집 (1인 순당) | 약 9kg. 남는 양이 생기지만 날것은 순당 15% 상한다 | — |
| 가을 열매·견과 (9~10월) | 1인 순당 약 10kg, 견과는 오래 간다 | — |
| 장작 모으기 (여름, 1인 하루) | 6kg (겨울의 2배) | — |
| 끌개 엮기 (수정) | 운반 ×1.4 (모든 계절), 눈 위 ×1.8. 지금 데이터는 겨울에만 붙어 가을 대사냥에 안 쓰인다 → 고친다 | — |

**계절별 식량 흐름 목표**: 봄은 굶주림에서 회복하고 남는 양이 거의 없다. 여름은 남지만 빨리 상한다(말리기가 답). 가을은 크게 남고 저장·운반이 얼마나 남길지 정한다. 겨울은 줄기만 하고 앞 계절의 준비로 버틴다.

**첫 겨울 감각 점검**: 기록에서 대사냥과 사슴 사냥 9마리를 해도 열흘분 남짓이 남았다. 초안 수치로 다시 계산해도 1달 정산이 약 320kg(11일분)으로 기록과 맞는다. 첫 겨울은 이대로 빡빡하게 둔다(확정 D6).

### 10.4 발전이 풀어 주는 압박 (확정 D6)
첫 겨울의 빡빡함은 아래 수단으로 **확실히** 풀려야 한다. 각 수단이 숫자로 얼마나 풀어 주는지 목표를 정해 둔다. 기준은 한겨울 한 달이다.

| 수단 | 효과 | 한 달 기준 이득 |
|---|---|---|
| 고기 말리기 | 날고기 → 말린 고기. 부패가 거의 없고 운반 무게 절반 | 가을 대사냥의 고기를 봄까지 보관. 운반량 2배 |
| 저장 구덩이 | 은닉물 습격과 부패가 줄어든다 | 은닉 손실 −70% |
| 끌개 엮기 | 눈 위 운반 ×1.8 | 대사냥에서 남기는 고기가 거의 없어진다 |
| 얼음 낚시 | 겨울 식량원 (1인 순당 6kg) | 6명이면 한 달 약 110kg + 고갈 없음 |
| 가죽옷 | 추위 피해 감소, 장작 −20% | 천막 한겨울 기준 약 120kg 절약 |
| 바위굴·움집 | 장작 ×0.5 / ×0.6 | 300kg 절약 |
| 갈대호수 교역 | 가죽 → 말린 물고기 정기 교역 | 계절마다 150~300kg |

### 10.5 굶주림
| 단계 | 조건 | 결과 |
|---|---|---|
| 배급 감축 | 다음 순까지 먹을 양이 모자람 | 0.75배 배급. 노동 효율 0.9, 결속 −2/순 |
| 굶주림 | 배급 감축이 3순 이상 이어지거나 식량 0 | 0.4배 배급. 노동 효율 0.7, 결속 −5/순, 병 확률↑ |
| 쓰러짐 | `hungerDays` ≥ 20 | 약한 사람(아이, 노인, 병자) 순으로 사망 판정. 순당 약 8% (기록: 느티, 굶주림 약 한 달째) |

### 10.6 결속
- 0~100, 시작 60
- 하락: 죽음 −4/명, 굶주림 −5/순, 불공정한 분배(사건 선택) −5~15, 약속 어김, 고기를 버림 −2
- 상승: 의례 +5~10, 큰 사냥 성공 +5, 애도 의례 +3, 이웃과의 좋은 일
- 30 아래: 다툼 사건이 생긴다
- 10 아래가 3달 이어지면: 분열 패배

### 10.7 게임 길이 (확정 D1)
- **시작** = 1년차 3월(녹는달, 봄)
- **첫 겨울** = 9~12달째, 1년차 11월~2월(낙엽달 → 얼음달). 시험 플레이의 넉 달과 같은 구간이다.
- **M2 플레이 범위** = 1년차 3월 ~ 2월(12달), 2년차 3월 보고 화면에서 멈춘다(C7 확인). 예상 60~90분.
- 정밀 플레이는 **36~48달**이 목표다. 60달을 넘기면 생존 결말이다.
- 시대 목표 3개를 달성하면 신석기 전환 사건으로 1장이 끝난다. 전환 뒤에는 플레이하지 않는다.
- **전환 장면**: "여러 세대가 흘렀다"는 서술 → 이 부족의 연대기 묶어 보기 → 다음 시대 예고(2장으로 이어지는 씨앗: 달성한 길과 powerSeeds에 따른 문구)
- 장 안에서는 시간을 건너뛰지 않는다. 평온한 달은 한 화면 요약으로 빠르게 넘긴다(§19).

### 10.8 시뮬레이터 목표치 (2026-11-20 봄 시작 기준으로 교체)
**준비 정도**: 1년차 11월 1일(첫 겨울 시작)에 다섯 가지를 잰다.
1. 오래 가는 식량(말린 고기·물고기, 견과)이 30일치 이상
2. 장작이 겨울 필요량의 50% 이상
3. 거처가 바위굴이나 움집
4. 가죽옷 지식, 또는 가죽 20장 이상
5. 겨울 식량원이 하나 이상(얼음 낚시 지식, 또는 갈대호수와의 교역 약속)

0~1개 = **낮음**, 2~3개 = **보통**, 4~5개 = **높음**. 리포트는 준비 정도별로 나눠 보여 준다.

| 지표 | 목표 |
|---|---|
| 3월을 굶주림 없이 넘김 ("거의 확실하다" 방침만 고르는 전략) | 95% 이상 (§10.2 확인 조건) |
| 봄~가을(3~10월) 사망 | 중앙값 0 |
| 준비 높음 → 첫 겨울 사망 | 0~1명인 판 85% 이상 |
| 준비 높음 → 그래도 아슬아슬 | 배급 감축을 겪은 판 40% 이상, 겨울 최저 식량 중앙값 5~15일치 |
| 준비 보통 → 첫 겨울 사망 | 중앙값 1~2 |
| 준비 낮음 → 첫 겨울 사망 | 중앙값 2~3 (시험 플레이 수준), 굶주림을 겪은 판 80% 이상 |
| 첫 겨울 멸족 | 준비 낮음에서도 5% 이하 |
| greedy(준비를 노리는) 전략 | 준비 높음에 닿는 판 70% 이상 |
| random 전략 | 대부분 낮음·보통 |
| 평온한 달 비율 | 봄~여름 30~50%, 첫 겨울 20% 이하 (§19) |
| 한 방침의 선택률(제시됐을 때) | 60% 이하 (넘으면 지배적 후보) |
| 시대 목표 3개 달성 시점 중앙값 | M5에서 잰다 (greedy 30~45달, random 달성률 20% 이하) |

- greedy 전략은 겨울 준비와 지식 해금을 일부러 노리는 휴리스틱을 쓴다(준비를 할 줄 아는 플레이어 모델).
- **"둘째 겨울이 눈에 띄게 수월하다"(D6)**는 2년차 콘텐츠가 필요해 **M4 목표로 옮긴다**(굶주림 순 수 첫 겨울의 50% 이하, 사망 감소, 최저 며칠치 2배 이상인 판 80% 이상).
- **기준 시나리오 재현 테스트**: 숨은 늦가을 프리셋으로 시험 플레이의 선택(대사냥 → 큰 불 → 바위굴 → 곰 사냥 → 올가미 → 교역 → 사슴 → 눈보라 사냥)을 고정 순서로 넣어 여러 시드로 돌린다. 첫 4달 정산이 기록과 비슷한 범위에 드는지 확인한다(식량 ±40%, 사망 0~3명). 이 결과가 "준비 낮음" 겨울의 기준점이다.

---

## 11. 그림 시스템

### 11.1 레이어 목록 초안 (M2 범위 = 사계절. 봄·여름은 2026-11-20에 M4에서 앞당김)
봄 시작으로 M2에 추가하는 것: 지면 `ground.spring`, `ground.summer` / 주체 `sub.fish_run`, `sub.birds`, `sub.berries`, `sub.flood` (봄·여름 장면은 가볍게, 수는 작업 4에서 확정)

| 레이어 | id 초안 | 수 |
|---|---|---|
| 배경 (장소) | `bg.river_ford`, `bg.north_forest`, `bg.steppe`, `bg.marsh`, `bg.cave_mouth`, `bg.cave_inside`, `bg.camp_tents`, `bg.reed_lake` | 8 |
| 계절 지면 | `ground.autumn`, `ground.snow`, `ground.ice` (배경 위에 겹친다. 봄·여름은 M4) | 3 |
| 주체 | `sub.reindeer_herd`, `sub.reindeer_one`, `sub.wolves`, `sub.wolf_eyes`, `sub.bear_sleeping`, `sub.bear_awake`, `sub.hunters`, `sub.gatherers`, `sub.fire_circle`, `sub.strangers`, `sub.elder_telling`, `sub.carcass`, `sub.meat_rack`, `sub.firewood`, `sub.ice_hole`, `sub.grave`, `sub.messenger`, `sub.claw_marks` | 18 |
| 날씨 | `ov.snow`, `ov.blizzard`, `ov.fog`, `ov.dusk`, `ov.night`, `ov.rain` | 6 |
| 초상 | 조언자 4명 + 족장 + 상태 표지 `badge.injured`, `badge.grief` | 7 |

**합계 약 42개**: 장면 조합은 8 × 3 × (주체 0~3) × 6이라 사실상 무한하다.

### 11.2 매니페스트 (M2 확정: 인라인 SVG 컴포넌트 또는 이미지 파일)
```ts
// src/assets/manifest.ts — 콘텐츠는 id만 안다. 무엇으로 그릴지는 매니페스트만 안다.
export const manifest: Record<SceneId, SceneAsset> = {
  'bg.steppe':     { kind: 'bg', svg: BgSteppe },                       // 지금: 인라인 SVG 컴포넌트
  'sub.reindeer_herd': { kind: 'subject', svg: SubReindeerHerd, motion: 'herd' },
  'ov.snow':       { kind: 'overlay', svg: OvSnow, motion: 'fall' },
  'portrait.bawi': { kind: 'portrait', svg: PortraitBawi },
  // 나중에 일러스트로 바꿀 때: 같은 id를 이미지 파일로 연결한다. 콘텐츠 데이터는 고치지 않는다.
  // 'bg.steppe':  { kind: 'bg', image: bgSteppeWebp },
};
```
- 한 항목은 `svg`(React SVG 조각) 또는 `image`(파일 URL) 중 하나를 가진다. `SceneView`는 둘을 같은 자리에 겹쳐 그린다.
- **인라인 SVG로 정한 이유**(M2 결정): 이미지로 넣은 SVG에는 페이지 CSS가 닿지 않는다. 그러면 레이어 움직임(무리 이동, 갈대, 불, 눈)을 "빨리 보기", 속도 설정, `prefers-reduced-motion`으로 조절할 수 없고, 테마 색도 바꿀 수 없다.
- 장면 레이어는 모두 같은 좌표(`viewBox 0 0 1200 440`)로 그린다. 썸네일과 큰 장면은 `preserveAspectRatio="xMidYMid slice"`로 잘라 쓴다. 인트로처럼 화면 전체를 채우는 장면도 같은 레이어를 쓴다.
- `motion`은 레이어의 움직임 종류다(`herd`, `run`, `reed`, `fire`, `star`, `ember`, `fall`, `drift`). 움직임은 CSS 클래스로 걸고, 앱의 움직임 설정이 끄거나 늦춘다.
- 주체 배치는 슬롯(`left`, `center`, `right`, `far`)으로만 정한다. 좌표 체계는 두지 않는다.
- `SceneSpec`의 `'{place}'`, `'{weather}'` 같은 자리표시자는 엔진이 확정한다. 저장과 재현이 가능하다.
- 검증기는 모든 콘텐츠의 장면 id가 매니페스트에 있는지 검사한다.

### 11.3 스타일
동굴벽화풍. 황토·숯·뼈색과 불빛 주황을 쓰고, 굵은 선과 실루엣으로 그린다. viewBox는 장면 레이어 1200×440, 초상 56×56으로 통일한다. 색은 CSS 변수로 받아 장 테마를 바꿀 수 있게 한다. 화면 시안은 `docs/design/design-handoff/`(README의 디자인 토큰과 움직임 원칙)를 따른다.

---

## 12. 서술 시스템

- 문장은 `ko` 리소스의 키다. 변수: `{leader}`, `{hunters}`, `{meat}`, `{carried}`, `{place}`, `{days}` 등. 수량 서식(kg, 며칠분)은 i18n 함수로 처리한다.
- **변형 선택**:
  1. 조건과 계절이 맞는 변형을 모은다
  2. 최근 사용한 것(`narrativeRecent`, 최근 N회)을 뺀다
  3. 시드로 하나 뽑는다
- **조건부 조각**: 날씨, 거처, 인물 상태에 따라 앞뒤에 한 문장을 붙인다. 예: 눈보라면 "눈보라가 발자국을 지웠다."
- **최소 변형 수**(balance): 방침 활동의 등급별 2개(M2) → 3개(M6). 중간 사건 본문은 1개 + 조건 변형. 검증기가 검사한다.
- **문장 길이**: 서술 한 덩어리 1~3문장, 선택지 라벨 15자 이내, 대사 40자 이내.
- **화면 정보와 이야기 문장의 구분**(2026-11-20, CLAUDE.md "화면 표기 원칙"): 화면 정보는 쉬운 말과 아라비아 숫자만, 분위기 있는 표현과 달 이름은 이야기 문장에서만 쓴다.
  - 화면용 키: `ui.*`, `chip.*`, `row.*`, `settle.*`, `brief.*`, `alert.*`, `*.cost`, `*.lock`, 땅 정보 카드(`preset.*.land.*`). 검증기는 여기서 `:count`, `:num` 서식이 나오면 오류로 잡는다.
  - 숫자 서식: `{n:days}` → "18일치", `{n:count}` → 10 이하는 우리말 관형사("세"), 넘으면 아라비아 숫자("14"). `{n:num}`(우리말 수사)은 이야기 문장에서만.
- **조사 서식**: `{v:은}`, `{v:이}`, `{v:을}`, `{v:와}`, `{v:으로}`, `{v:아}`(부름). 값의 마지막 글자 받침으로 고른다. 한글이 아니면(숫자 등) 읽는 소리의 받침으로, 판단할 수 없으면 "은(는)"처럼 둘 다 쓴다. ㄹ 받침 + 으로 → "로". 기존 규칙 "조사를 변수 뒤에 붙이지 않는다"는 이 서식으로 대체한다.
- **부족 이름**은 `{tribe}` 변수로만 넣는다. 문자열에 "잿빛강 사람들"을 직접 쓰지 않는다(장소 이름 "잿빛강", "잿빛강 땅"은 예외).
- **정산표와 연대기의 문장**은 서술과 따로 둔다. 연대기는 기록자 시점이다. 예: "서리달, 바위굴에서 곰을 잡았으나 돌쩌귀를 잃었다."

---

## 13. 시대 목표 (1장)

| 목표 | 길 | 판정 |
|---|---|---|
| **식량 안정** | 굶주림 없이 겨울을 넘김 | 겨울 3달 동안 굶주림 단계 0 |
| | 석 달분 비축 | 말린 고기·물고기 등 오래 가는 식량이 90일분 이상 (저장 지식 필요) |
| | 첫 수확 | 씨앗 심기 → 수확 사건 성공 |
| **영구 거처** | 바위굴 거점 | 바위굴에서 12달 거주 + 굴 다지기 |
| | 움집 마을 | 움집 짓기 지식 + 움집 4채 이상 |
| | 강가 고정 야영지 | 같은 강가에서 사계절 + 물고기 말리기 |
| **부족의 확장** | 혼인 동맹 | 이웃과 혼인 사건 → 동맹 |
| | 교역 산하 | 교역 장부 누적 + 의존 사건 |
| | 무력 굴복 | 습격 승리 + 굴복 사건 |
| | 떠돌이 받아들이기 | 떠돌이 무리 합류 사건 수용, 인구 +N |

- 목표를 달성하면 길이 `goal.<id>.<path>` 플래그로 남는다. 이후 서술과 ChapterResult의 `powerSeeds`에 쓰인다(예: 무력 굴복 → 정복, 교역 산하 → 교역, 혼인 동맹 → 연합).
- **패배**:
  - 멸족(인구 0)
  - 분열(결속 10 미만 3달)
  - 흡수당함(이웃 관계에서 굴복 사건을 받아들이거나 강제당함)

---

### 13.1 진행도 표시 (M2 결정)
- 목표 데이터(이름, 길)는 M2에 넣는다. 지금 잴 수 있는 길만 진행도를 계산하고, 아직 잴 수 없는 길은 0%가 아니라 **흐리게** 표시한다.
- 진행도 계산은 `engine/goals/progress.ts`의 측정기(measure) 등록표로 분리한다. 길 데이터는 측정기 id와 목표값만 가진다. M5에서 측정기를 늘리거나 바꿔도 화면과 콘텐츠는 그대로다.

## 14. 2장 확장 지점

| 바뀌지 않는 것 (엔진) | 2장에서 데이터로 바뀌는 것 |
|---|---|
| 월/순 상태 기계, 방침 후보 생성, 등급 판정, 기억 장부, 서술 조립, 장면 합성, 저장 | 달력(달 이름), 식량 종류(곡물), 물자(토기, 청동), 거처(마을, 성채), 장소, 동물, 이웃, 지식, 목표, 테마, 그림 세트 |
| ChapterResult → StartState 변환기 | 인구 규모. 수백 명이 되면 개인 기록 대신 **집단 묶음 + 이름 있는 인물** 방식으로 바꾼다. 이 변환은 2장 설계 때 정한다 |

- 선택 해상도 해금(방침 조합, 상시 지시, 인원 조정)은 1장 M4에서 엔진에 넣고, 장마다 해금 조건만 데이터로 둔다.

---


## 15. 확정된 결정과 가정

### 15.1 확정 (M0 질문 답변, 2026-11-20)
- **D1. 1장 길이**: 정밀 플레이 36~48달, 60달 초과 시 생존 결말. 시대 목표 3개 달성 시 전환 사건으로 1장을 끝내고, 전환 뒤에는 플레이하지 않는다. 전환 장면에서 연대기와 다음 시대 예고를 보여 준다(§10.7).
- **D2. 기준 시나리오**: `docs/playtest-log.md`. 끝의 "사건 연결 지도"가 콘텐츠 연결의 기준이다(§18).
- **D3. 결과를 알 수 없다**: 모르는 정보가 있다는 뜻이다. 정찰·옛이야기·이웃의 정보로 알게 되면 나머지 세 단계 중 하나로 바뀐다(§7.2).
- **D4. 부족원 개인 기록**: 전원에게 이름, 나이, 건강 상태, 부모·자식 관계를 준다. 개인 기록은 엔진에만 두고, 화면은 성인·노인·아이 비율, 일손, 아픈/다친 사람 수, 주요 인물 4명만 보인다(2026-11-24 3차 피드백)(§3.2).
- **D5. 템포**: 사건이 없는 평온한 달은 상순·중순·하순을 한 화면 요약으로 빠르게 넘길 수 있다(§19).
- **D6. 밸런스**: 첫 겨울은 시험 플레이처럼 빡빡하게 두고, 발전이 압박을 확실히 풀어 준다. 운반 한계를 넘는 방법(왕복, 끌개, 현장 건조, 저장 구덩이)을 넣는다. 시뮬레이터 목표에 "잘 플레이하면 두 번째 겨울이 첫 겨울보다 눈에 띄게 수월하다"를 넣는다(§3.3, §10.4, §10.8).

### 15.2 가정 (질문하지 않고 정한 것)
- **A2. 족장(플레이어)**: 이름이 있는 인물로 기록되지만, 브리핑에서는 "당신"으로 부른다(시험 플레이 기준). 기본은 마을에 남는다. 일부 선택지 "족장이 직접 이끈다"는 성공률을 올리는 대신 족장이 대가 표의 대상이 된다. 족장이 죽으면 계승 사건이 일어난다(M3).
- **A4. 날씨 단위**: 순마다 정하고, 월초에는 전망만 보여 준다.
- **A6. 시작** (2026-11-20 변경, §15.3): 프리셋 "잿빛강 땅", 녹는달(1년차 3월, 봄). 긴 겨울을 막 넘긴 부족. 강 굽이의 바위 그늘, 낡은 가죽 천막 5채. 북쪽 소나무 숲, 동쪽 초원, 남쪽 늪지. 첫 달에 강이 녹으며 물고기가 돌아오고, 철새가 오고, 순록 떼가 북쪽으로 올라가고, 곰이 깬다. 부족 이름은 기본 "잿빛강 사람들"(입력 화면은 보류).
- **A7. 이웃 초안**:
  - 갈대호수 사람들(남쪽 늪지 너머 호숫가, 말린 물고기, 늙은 여인 우두머리, 온화한 교역)
  - 검은바위 사람들(흑요석, 자존심이 셈)
  - 떠돌이 무리(합류 후보)
  - M5에 호전적인 무리를 하나 더 둘지 정한다.
- **A8. 조언자**: 시험 플레이의 넷을 그대로 쓴다. M2의 "인물 5명"은 이 넷과 족장이다.

  | 이름 | 역할 | 입장 |
  |---|---|---|
  | 바위 | 사냥 우두머리, 장년 | 대담 |
  | 서리 | 이야기꾼, 노인 | 신중 (옛 겨울의 기억 → 단서) |
  | 노을 | 약초꾼, 청년 | 실용 |
  | 이끼 | 장인, 청년 | 기술 |

  이름이 고정된 부족원: 갈대(젊은 사냥꾼), 돌쩌귀(사냥꾼), 솔(막내 사냥꾼), 느티(노인). 이들이 시험 플레이처럼 죽는다는 보장은 없고, 대가 표가 고른다.
- **A9. 달 이름**:
  - 봄: 녹는달, 새싹달, 알달
  - 여름: 긴해달, 뜨거운달, 천둥달
  - 가을: 열매달, 순록달, 낙엽달
  - 겨울: 서리달, 눈달, 얼음달
  - 화면 숫자 대응(확정 2026-11-20): 녹는달 3월, 새싹달 4월, 알달 5월, 긴해달 6월, 뜨거운달 7월, 천둥달 8월, 열매달 9월, 순록달 10월, 낙엽달 11월, 서리달 12월, 눈달 1월, 얼음달 2월. 년차는 3월에 바뀐다.

### 15.3 봄 시작 전환 (사용자 플레이 피드백, 2026-11-20)
사용자가 M2 화면을 브라우저에서 플레이했다. "전보다 훨씬 재밌다." 그러나 겨울에서 바로 시작하니 고를 수 있는 게 버티기뿐이라 너무 어렵다. 그래서 아래로 바꿨다.
- **S1. 봄 시작**: 1년차 3월. M2 범위는 첫 해 12달(§10.7). 봄·여름·가을은 가볍게, 평온한 달은 한 화면 요약.
- **S2. 시험 플레이의 겨울** = "준비가 부족했을 때의 겨울". C1~C7은 그대로 살린다. 준비 → 겨울 연결 P1~P10을 새로 둔다(§18.2).
- **S3. 밸런스**: 잘 준비하면 첫 겨울 사망 0~1명(아슬아슬), 소홀하면 2~3명. 준비 정도별 분포를 잰다(§10.8).
- **S4. 시작 프리셋**: §10.2. 늦가을 프리셋은 숨은 테스트용.
- **S5. 날짜 표기**: "1년차 · 봄 · 3월"(§3.1, A9).
- **S6. 숫자와 조사**: 화면은 아라비아 숫자만. 조사는 서식으로(§12).
- **S7. 부족 이름**: `GameState.tribeName`, `{tribe}` 서식, 세이브 v3. ~~입력 화면과 추천 4개~~는 2026-11-24 플레이 피드백으로 **보류**했다. 새 게임은 기본 이름(`nameSuggestions[0]` = 잿빛강 사람들)으로 바로 시작한다. 추천 이름 데이터는 남아 있다.
- **S11. "전략" 표기**(2026-11-24): 화면의 "할 일"을 "전략"으로 바꿨다(§21.1).
- **S12. 장부 순서**(2026-11-24): 시작 → 얻은 것 → 쓴 것 → 최종(§21).
- **S8. 쉬운 표현**: §21.1 교체표. "결속"(단단함·흔들림·무너짐)과 "상순·중순·하순"은 그대로, 위험 단서 4단계는 배지·카드 모두 전체 문장 그대로.
- **S9. 회수 방침 장소**: 묻은 고기마다 후보 하나(`target: { cache: 'each' }`, 가치·거리 순 최대 2개). 이름과 서술은 `{place}`.
- **S10. 원정 첫 수확 운반**: 따로 보내지 않는다. 원정이 끝날 때 한꺼번에 운반 한계를 거치고, 남은 고기 처리에 "마을에서 사람을 불러 나른다"(거리 4일 이하, 마을 일손 N명이 며칠 빠져 마을 채집·장작이 준다)를 더한다.

---

## 16. 시험 플레이 한 달을 데이터로 다시 짜 보기 (구조 검증)

기준 시나리오의 "제2달 서리달"이 이 설계로 어떻게 나오는지 확인한다. (봄 시작 뒤에는 1년차 12월이며, **준비가 부족했을 때의 겨울** 예시다. 여름에 바위굴을 미리 찾았다면 이 달은 P3 경로로 바뀐다.)

1. **월초**:
   - 날씨 전망: 추위가 깊어짐
   - 동물: 곰은 겨울잠(`bear.state = denning`, 위치 모름). 늑대 무리가 여울 쪽으로 이동(은닉물 `scent`에 반응)
   - 소식: 강가 얇은 얼음, 장작 30kg, 늑대가 여울로, 가죽 29장
2. **방침 후보** (기록: 5개)
   - `recover_cache`(은닉물 존재. 늑대 근처 → 위험해 보인다)
   - `firewood_drive`(장작 며칠분 < 5 → relevance +60)
   - `tan_hides`(가죽 ≥ 20)
   - `ice_hole_mixed`(강 얼음 + 장작 겸업)
   - `find_rock_cave`(거처 = 천막, 겨울. 굴이 비었는지 숨은 변수 → 결과를 알 수 없다)
   - 조언: 바위 → 회수, 서리 → 장작, 이끼 → 가죽, 노을 → 바위굴. 네 입장이 엇갈린다.
3. **상순**(`find_rock_cave.early`, activity: 정찰)
   - 성공 → 서술 `cave_found`
   - 서술의 facts: `place.north_cave.fact = claw_marks`, `animal.bear.placeId = north_cave`, `bear.known = true`
   - 마을 기본 일: 장작 180kg 모음, 130kg 태움
4. **중순**(eventWindow):
   - 후보 `cave_bear_last_sack`이 뜬다. 조건: `place fact claw_marks` + `foodDays < 5`
   - 대사: 서리(cautious), 바위(bold), 노을(practical)
   - 선택지:
     1. 잠든 곰 사냥 — activity, hidden `bear.depth`. 노을의 말("벌써 겨울잠에 들었어요")이 변수를 밝혀 "위험해 보인다"
     2. 굴 입구만 쓴다 — 해볼 만하다. 봄에 곰이 깨는 예약 사건을 남긴다
     3. 여울의 고기를 찾으러 간다 — 은닉물 상태가 숨은 변수라 "결과를 알 수 없다"
     4. 배급을 줄이고 버틴다 — 거의 확실하다. 노인과 아이의 `hungerDays`가 쌓인다
5. **하순**: 1번 선택 → 대가 있는 성공
   - 곰 고기와 기름 250kg, 곰 가죽 1
   - 대가 표 2개: `kill { participant: 'front' }` → 돌쩌귀, `injure { who: 'leader', kind: 'claw' }` → 바위
   - 애도 장면(서리의 옛 노래)
   - 거처 `shelter → rock_cave`, 장작 ×0.5
   - 곰 힘줄 → 이끼의 올가미 단서(다음 달 올가미 방침 강화)
   - 굶주림 노인 중 한 명이 기침(병 판정) → 서리
6. **정산**:
   - 식량: 319 + 30 + 250 + 70 − 669 → 0 (굶주림 시작)
   - 인구 34 → 33
   - 거처: 천막 → 바위굴
   - 부상·병: 갈대(다리, 1달 남음), 바위(팔), 서리(기침)
   - 결속: 죽음 −4, 큰 사냥 +5
   - 연대기: "서리달, 북쪽 숲 바위굴에서 잠든 곰을 잡았으나 돌쩌귀가 돌아오지 못했다."

→ 기준 경험의 모든 요소가 데이터와 규칙만으로 나온다. 다만 **"발톱 자국 → 곰 사건"처럼 서술이 사실을 남기는 연결**을 콘텐츠 작성 규칙으로 강제해야 한다(§18).

---

## 17. M1 작업 순서

1. 폐기 대상 삭제(§1.3)
2. 타입 교체
3. 조건/효과/스탯 이식
4. 사람과 물자 모델
5. 월/순 상태 기계: 결정 지점까지 미리 계산하는 구조. 방침은 테스트용 2~3개
6. 날씨와 계절
7. 정산
8. 저장 v1
9. 단위 테스트
   - 한 달 처리
   - 순 진행과 사건 대기
   - 정산
   - 부패
   - 고갈
   - 운반 한계와 남은 고기 처리
   - 지연 결과
   - 저장 왕복
   - 시드 재현
   - 등급 확률의 닫힌 식과 실제 굴림 분포 비교
10. 상태 확인용 최소 화면

---

## 18. 사건 연결 지도 (콘텐츠 연결 기준)

`docs/playtest-log.md` 끝의 연결 지도를 M2 콘텐츠의 **필수 연결**로 삼는다. 각 연결은 "앞 결과가 남긴 사실 → 뒤 사건의 조건"으로 데이터에 존재해야 한다.

| # | 연결 | 남기는 사실·기억 | 받는 쪽 |
|---|---|---|---|
| C1 | 대사냥 → 운반 한계 → 여울 은닉 고기 → 늑대가 여울로 | `memory.caches[ford]`, `wolves.target = ford` | `recover_cache` 방침이 매달 후보. 시간이 지나면 은닉물 상태가 숨은 변수로 바뀜 |
| C2 | 늑대 쫓는 불 → 장작 고갈 → 장작 위기 → 바위굴 탐색 | 장작 −80, `firewoodDays` 낮음 | `firewood_drive`, `find_rock_cave` relevance 상승 |
| C3 | 바위굴 → 발톱 자국 → 동굴곰 → 곰 사냥 | `place.north_cave.fact = claw_marks`, `bear.known` | `cave_bear_last_sack` 사건, 결과로 사망·굴·곰 가죽 |
| C4 | 곰 가죽 → 갈대호수 사람들의 관심 | `goods.bear_hide ≥ 1` | `reed_lake_strangers` 사건의 "곰 가죽을 내주고 크게 거래" 선택지 |
| C5 | 굶주림 + 노인 → 병 → 버드나무 껍질 → 회복 / 다른 노인 사망 | `ailment cough`(굶주림이 병 확률을 올림), 교역 시 `item willow_bark` | 노을의 치료 선택지 성공률, 쓰러짐 판정 |
| C6 | 서리의 옛이야기 → 사슴 단서 → 사냥 성공률 상승 | `clue deer_cross_river`(서리 생존 + 늦겨울) | `deer_hunt` 숨은 변수 공개 + 보정 |
| C7 | 갈대호수의 약속 → 봄 재방문 | `promise reed_lake { season: spring }` | 녹는달~새싹달 월초 사건 |

**검증기 규칙** (`validate:content`)
- 위 C1~C7의 사실 생산자와 소비자가 모두 존재하는지 검사한다(연결 목록을 데이터로 두고 확인).
- 일반 경고:
  - 사실을 하나도 남기지 않는 성공 서술
  - 어떤 조건에서도 읽히지 않는 사실이나 기억 종류
  - 아무것도 남기지 않는 사건 선택지가 그 사건의 절반을 넘는 경우

**M2 필수 상황** (CLAUDE.md M2 + 기록): 순록 떼 대사냥, 두 소식이 한꺼번에(본 무리 vs 늑대), 여울 은닉 고기, 장작 위기, 바위굴과 동굴곰, 마지막 고기 자루, 올가미, 낯선 사람들(갈대호수 교역), 서리의 병과 버드나무 껍질, 서리의 사슴 이야기, 눈보라 속 사냥, 녹는달의 약속. 기록 1~4달의 방침 20개와 사건 5개가 겨울 콘텐츠의 출발점이다.

봄 시작 뒤 C1~C7은 모두 살린다. 다만 봄~가을의 준비에 따라 약해지거나 다른 경로로 열린다(§18.2). 준비를 소홀히 하면 시험 플레이처럼 흘러간다.

### 18.1 첫 1년의 흐름 (초안, 2026-11-20)
방침은 그 달에 나올 수 있는 핵심 후보이고, 사건은 조건부다. **볼드**는 꼭 넣을 상황이다.

| 달 | 핵심 준비 거리 (방침) | 사건 (조건부) |
|---|---|---|
| **3월** 봄 | 봄 어로, 새순 채집과 회복, 북쪽으로 가는 순록 사냥(소규모) | **강 얼음이 깨진다**(홍수: 천막을 옮길까), **굶주린 곰이 깼다** |
| **4월** | 늪지 너머 탐색(시안), 그물 짜기(이끼) | **봄 물고기 떼**(풍어인데 말릴 손이 모자람 → 말리기를 시도하는 계기), 늪 너머의 연기 |
| **5월** | 물고기와 고기 말리기, 갈대호수 찾아가기 | **갈대호수 첫 만남**(교역, 말리기 배우기, "가을에 순록 가죽을 가져오면" 약속), 철새 알 줍기 |
| **6월** 여름 | **북쪽 숲 바위굴 찾기**(곰이 나가 있어 굴이 빈 철), 장작 비축 | **비어 있는 굴과 발톱 자국**(C3의 여름판), 늑대 굴의 새끼들(건드릴까 둘까) |
| **7월** | 굴 다지기(가시 울타리, 저장 구덩이), 가죽 손질과 겨울옷 | **고기가 상한다**(더위), 가뭄 |
| **8월** | 장작 비축, 가죽옷 짓기 | **천둥비와 불어난 강**(봄에 옮겨 두었으면 피해가 적음), 서리의 여름밤 이야기(단서를 고른다) |
| **9월** 가을 | 열매 채집 총력, 끌개 엮기 또는 뼈 작살(이끼) | 이끼의 제안(지식이 시작되는 사건), 갈대호수의 가을 사절(약속을 지킴) |
| **10월** | **순록 떼 대사냥**(남쪽으로 내려가는 1차), 소규모 사냥 + 겨울 준비(시안) | **두 소식이 한꺼번에**(C1), 불빛 가장자리의 눈 |
| **11월** | 대사냥 2차(1차를 놓쳤으면), 겨울 준비 마무리, 굴로 옮기기 | **곰이 굴로 돌아온다**(굴에 먼저 들어갔으면) |
| **12월** 겨울 | 장작 총력, 여울의 고기 회수, 얼음 구멍 낚시, 바위굴 찾기(아직 못 찾았으면) | **마지막 고기 자루**(C3), 장작이 바닥난 밤(C2) |
| **1월** | 올가미 사냥, 아픈 사람 간호 | **낯선 사람들**(C4, 아직 못 만났으면), **서리의 기침과 버드나무 껍질**(C5) |
| **2월** | 눈 위의 사슴 사냥, 올가미 자리 옮기기 | **눈보라**(C6 연계), 올가미 자리가 빈다(고갈) |
| 2년차 3월 | (보고 화면에서 멈춤) | **얼음이 녹으면, 다시**(C7) |

콘텐츠 규모 목표: 방침 20개 이상, 사건 24개 안팎(봄~가을 약 60%, 겨울 약 40%).

### 18.2 준비 → 겨울 연결 (P1~P10, 검증기 연결 목록에 C1~C7과 함께 넣는다)
| # | 준비 (봄~가을) | 남기는 사실 | 겨울에 돌아오는 것 |
|---|---|---|---|
| P1 | 봄 물고기 떼, 여름 말리기 → **고기 말리기** 지식 | 지식 + 말린 식량 | 오래 가는 겨울 식량. 대사냥에서 현장 건조를 고를 수 있다(C1이 약해짐) |
| P2 | 여름·가을 장작 비축 (여름은 1인 하루 6kg) | 장작 재고 | 장작 위기(C2)가 늦게 오거나 오지 않는다 |
| P3 | 6월 바위굴 발견 → 발톱 자국 | `north_cave.fact = claw_marks` | 11월에 곰이 굴로 돌아오는 사건. 이기면 장작 ×0.5. 못 찾았으면 12월에 C3가 시험 플레이처럼 나온다 |
| P4 | 굴 다지기 → **저장 구덩이** | 지식 | 묻은 고기와 저장고의 손실 −70% (C1 완화) |
| P5 | 가죽 모으기(봄·가을 순록) → **가죽옷** | 지식 | 장작 −20%, 눈보라 사냥에서 동상이 줄어든다 |
| P6 | 5월 갈대호수 첫 만남 → 약속 | `promise reed_lake { season: autumn }`, 관계 | 9월 사절, 겨울 교역 상대, 버드나무 껍질(C5 완화). 못 만났으면 1월에 C4로 처음 만난다 |
| P7 | 9월 이끼의 제안 → **끌개 엮기** | 지식 | 대사냥 운반량이 늘어 묻을 고기가 줄어든다 |
| P8 | 9월 이끼의 제안 → 뼈 작살·돌망치 → **얼음 낚시** | 지식 | 12월부터 겨울 식량원 |
| P9 | 8월 서리의 여름밤 이야기 | 사슴 단서 또는 곰 굴 단서 | C6가 일찍 열리거나, 곰 사건의 "알 수 없다"가 풀린다 |
| P10 | 6월 늑대 굴 (건드림 / 둠) | `wolves.grudge` 또는 개체 수 | 겨울에 늑대가 마을과 묻은 고기를 노리는 확률이 바뀐다 |

---

## 19. 평온한 달의 빠른 진행 (확정 D5)

**평온한 달의 판정**: 엔진이 달 전체를 미리 계산한 뒤(§3.8) 아래를 **모두** 만족하면 `report.quiet = true`다.
- 방침 외의 결정 지점(중간 사건, 남은 고기 처리)이 없었다
- 사망, 새 부상·병, 출생, 합류가 없었다
- 결과 등급이 성공 또는 대가 없는 대성공이다(대가 있는 성공, 실패, 참사는 평온하지 않다)
- 새 지식, 새 기억(약속·은닉·단서), 이웃 첫 만남, 목표 달성이 없었다
- 굶주림 단계가 바뀌지 않았다

**화면** (2026-11-24 3차 피드백으로 바뀜)
- 평온한 달 요약 화면과 설정은 없앴다. 모든 달이 진행 화면(순 자동 진행, 속도 3단계)을 거쳐 **이달의 결과**에서 순마다 한 줄 회고 + 장부로 끝난다. 이 회고가 예전 요약의 역할을 한다.
- 엔진의 판정(`MonthReport.quiet`)은 시뮬레이터 지표용으로 남긴다.
- 시뮬레이터 리포트에 평온한 달 비율을 넣는다. 목표는 1년차 봄~여름 30~50%, 첫 겨울 20% 이하, 2년차 이후 30~50%. 너무 높으면 세계가 조용하다는 신호다. 봄 시작에서는 평온한 달 요약이 템포의 핵심이라 M2에 만든다.

---

## 20. M1 구현 중 정한 것

- **방침의 위험 단서** = 그 방침 안의 활동 중 가장 나쁜 단서 (알 수 없다 > 위험해 보인다 > 해볼 만하다 > 거의 확실하다).
- **조건부 단계**: 방침 단계에 `when`을 둘 수 있다. 예: 중순 사건에서 사냥을 접으면(`hunt_called_off`를 이번 달에 세움) 하순 사냥을 건너뛴다. 깃발 값은 "마지막으로 세운 달"이다.
- **은닉물 효과** `cache { at, action: recover | check }`: 회수하면 짐으로 꺼내 운반 한계를 다시 거친다. 확인하면 상태만 새로 안다.
- **마을 소식**은 그달에 아직 사건이 없을 때만 중순에 판정한다. 방침 사건과 겹치지 않는다 (한 달 0~1개, 드물게 2개).
- **배급**: 감축(0.75)으로도 모자라면 남은 식량을 다 먹는다. 굶주림 단계는 실제로 먹은 비율로 정한다. 먹은 뒤 `hungerDays`를 갱신하고, 그다음에 쓰러짐을 판정한다.
- **쓰러짐 곡선**: 순당 `collapseChance × (1 + 넘긴 날 / collapseSlopeDays)`, 최대 `collapseMax`. 첫 시험에서 한 달에 16명이 죽어 완만하게 고쳤다.
- **원정대**는 기본적으로 족장을 빼고 뽑는다(`includeChief`로 바꿀 수 있다). 숙련 높은 순 → id 순이라 난수가 없고, 미리보기와 실제가 같다.
- **장면**: M1은 레이어 id만 보고에 담고 화면에 글로 표시한다. 검증기는 id 형식만 검사한다. 매니페스트와 SVG는 M2에서 만든다.
- **세이브**: `generation: 'monthly'` 필드로 이전 설계(카드)의 세이브를 확실히 거부한다. 버전은 1부터 다시 시작한다.

---

## 21. M2 화면 구현에서 정한 것 (시안 기준)

- **화면 흐름**: 시작 화면(시드·이어 하기·불러오기, 시안에 없음) → 인트로 → 월초 상황 화면 ⇄ 결정 팝업 → 진행 화면(상순·중순·하순·정산) → 다음 달. 결말 화면은 진행 화면과 같은 틀이다.
- **결정 팝업 하나로**: 방침, 월초 사건(예약된 손님), 중순 사건, 남은 고기 처리가 모두 `DecisionPopup`을 쓴다. 고른 것은 팝업을 닫아도 남고, 확정해야 엔진 명령이 나간다(엔진은 그대로).
- **월초 보고**는 엔진이 데이터 규칙(`ChapterDefinition.briefing`)으로 만든다: 머리글(처음 맞는 것), 소식(우선순위 순 최대 3개), 상황 칩, 장면.
- **조언**은 입장(`advisors.stances`) 점수로 후보를 고르고, 다른 조언자가 고른 후보는 피한다. 대사는 자리+방침 > 자리+분야 > 입장 순으로 구체적인 것을 쓴다.
- **진행 화면**: 단계 보고에 무리 이름표(사냥대·마을·사건), 단계별 장부 행, 알림, 시작·끝 식량이 담긴다. **진행 중에는 장부·증감 없음, 이달의 결과에서만**(2026-11-24 3차 피드백): 진행 화면은 서술과 그림만 보이고 상단 지표는 월초 기준으로 고정된다. 장부 행과 시작·끝 값은 엔진 보고에 그대로 남고 이달의 결과가 읽는다. 원정지의 짐(운반 전 고기)은 서술 문장("고기 428kg이 남았다")과 남은 고기 결정 팝업으로 보인다.
- **우리말 수**: 문자열에서 `{n:num}`(셋), `{n:count}`(세 명), `{n:days}`(열여드레)를 쓴다.
- **시안과 다른 작은 점**
  - 비활성 버튼 글자 `#8f8370` → `#a39680` (배경 `#2a241d`에서 4.13:1이라 4.5:1을 맞추려고).
  - 배지·눈금 글자는 시안대로 13px이다. 본문은 17px 이상을 지킨다.
  - "마을 N명"은 원정대를 뺀 일할 수 있는 사람 수(노인 포함)다. 시안의 "마을 4명"은 성인만 센 값이다.
  - 그림 id 목록은 React·CSS 없이 읽을 수 있게 `src/assets/sceneIds.ts`에 따로 두고, 매니페스트가 타입으로 같은 목록을 빠짐없이 연결한다.
  - **장부 순서**(2026-11-24 플레이 피드백): **시작 → 얻은 것(+, 초록) → 쓴 것(−, 경고색) → 구분선 → 최종 · 며칠치**. 3차 피드백부터 장부는 이달의 결과(`ResultScreen`)에만 있다. 얻은 것·쓴 것은 각각 4줄까지 보이고 나머지는 "그 밖 n개"로 합친다(`story.ts`의 `orderRows`, `foldRows`). 장작은 한 줄(시작 · 모음 · 태움 → 최종).

### 21.1 쉬운 표현 교체표 (확정 2026-11-20)
화면 정보에만 적용한다. 이야기 문장과 내부 용어(코드의 `policy`, 문서의 "방침")는 그대로다.

| 지금 | 바꾼 표기 |
|---|---|
| 제3달 · 서리달 · 초겨울 | 1년차 · 겨울 · 12월 |
| 월초 보고 | 이번 달 상황 |
| 방침 / 방침 정하기 / 이번 달의 방침 / 고른 방침 | 전략 / 전략 정하기 / 이번 달 전략 / 고른 전략 (2026-11-24: "할 일" → "전략") |
| 월말 정산 / 정산으로 | 이달의 결과 / 결과 보기 |
| 원정 14명 · 마을 8명 / 원정대 | 나가는 사람 14명 · 남는 사람 8명 / 사냥대·탐색대 (방침별 `crewLabel`) |
| 원천 (장부 열) | 어디서 |
| 원정지의 짐 (아직 마을에 오지 않음) | 아직 못 가져온 고기 |
| 약 18일분 / 열여드레분 | 18일치 |
| 식량 열흘 못 감 / 순록 떼 보름 안에 지나감 | 식량 10일치 미만 / 순록 떼 15일 안에 지나감 |
| 몸져누운 사람 | 아픈 사람 |
| 새로운 앎 | 새 기술 |
| 대성공 / 참사 | 큰 성공 / 큰 실패 |
| 아직 잴 수 없다 | 아직 알 수 없음 |
| 연대기 | 부족의 기록 |
| 거처: 가죽 천막 5채 | 사는 곳: 가죽 천막 5채 |
| 시드 | 세계 번호 (같은 번호면 같은 이야기) |
| 내보내기 / 불러오기 | 저장 파일 내보내기 / 저장 파일 불러오기 |
| 기후 "한랭 대륙성 · …" | 날씨 "춥다 · 여름은 짧고 겨울은 길다" |
| 강수 / 위험 요소 / "봄철 해빙 홍수" | 비와 눈 / 위험 / "봄에 얼음이 녹으며 나는 홍수" |
| 배급 감축 (상태) | 먹는 양 줄임 |

**바꾸지 않는 것**: 결속(단단함·흔들림·무너짐), 상순·중순·하순, 위험 단서 4단계 전체 문장(배지와 카드 모두), 일손. 카드에서 위험 단서 문장이 넘치면 구현 전에 먼저 말한다.

### 21.2 3차 피드백 화면 (2026-11-24, 시안 Situation · Decide · Progress · Result)
- **스크롤 없음**: 결정 팝업, 진행 화면, 이달의 결과는 1366×768(보이는 높이 약 650px)과 1920×1080(약 950px)에서 세로 스크롤이 없다. 스크롤은 월초 상황 화면만. 글자 크기 설정을 키우거나 폭 900px 아래면 잘리지 않게 칸 안에서 스크롤한다.
- **수치는 이달의 결과에서만**: 진행 중에는 장부·증감·굴러가는 숫자가 없다. 상단 지표 바(`StatusBar`: 인구, 식량 kg·며칠치, 장작, 일손·아픈 사람, 결속)는 진행 중 "월초 기준"으로 고정되고(엔진 `work.start`, 세이브 v5), 이달의 결과에서 새 값과 증감을 보인다. 서술 문장 안의 수치("고기 416kg을 메고")는 문체 기준이라 그대로 둔다.
- **결정 팝업 (전략 틀)** *(4차 피드백 §21.3에서 두 단계로 바뀜. 아래는 3차 기준)*: 머리(제목·날짜·칩·닫기 한 줄) → 조언 4칸(칸마다 최대 2줄) → 일손 막대("식량 n명 · 발전 n명") → 식량 줄(가로 제목 + 4열 카드) → 발전 줄(4열, "발전하지 않는다"는 이 줄의 카드) → 큰 일 얇은 줄 → 아래 줄(고른 것 + "고른 전략의 대가", 확정). 카드 = 그림 36px(장면 id 그대로) + 번호·제목 / 위험 배지 / 한 줄 설명(`policy.<id>.brief`, 18자 넘으면 검증기 경고) / 대가 한 줄(사람 수·공사 진행·식량 kg). 긴 설명(`summary`)과 대가 글(`cost`)은 카드에 없고, 아래 줄과 카드의 title에 있다. 발전 카드의 식량 kg는 지금 고른 식량 전략 기준이고, 함께 못 고르는 발전은 흐리게 + 이유 한 줄(고른 발전이 막히면 "발전하지 않는다"로 돌아간다). 이어지는 공사는 처음부터 골라 둔다. 키보드 1~4 식량, 5~8 발전, 0 큰 일.
- **후보 수**: 식량 최대 4, 발전 최대 3 + "발전하지 않는다", 큰 일 최대 1(`balance.policy` 그대로). 4열을 넘지 않는다(시험 `plan.test.ts`).
- **결정 팝업 (사건 틀)**: 그림(40%, 최대 440px) 옆에 본문(17px)과 대사, 그 아래 선택지 2~4개를 한 줄로(카드에는 대가 글 최대 2줄).
- **진행 화면** *(4차 피드백 §21.3에서 세 순이 쌓이게 바뀜)*: 왼쪽 그림(38%, 최대 640px) + 아래 한 줄(고른 전략 · 무리 인원), 오른쪽 서술. ~~지난 순은 한 줄 회고로 흐리게~~, 지금 순은 전문 타이핑(19px). 문단 이름표(사냥대·마을·발전·사건 제목)는 문단 앞에 붙여 쓴다(따로 한 줄을 쓰면 두 칸 전략의 순에서 650px을 넘었다). 사람 알림은 수치 없는 한 줄 칩. 중순 사건은 사건 직전 문장(`event.<id>.lead`, 없으면 본문 첫 문장)을 먼저 타이핑하고 "결정이 필요하다" 띠 → 1.5초×속도 배율 뒤 팝업(설정 "결정 팝업 자동 열기"). 아래: 속도(느림·보통·빠르게), 일시정지, 글 바로 보기, 계속.
- **속도**(`src/ui/timing.ts`): 진행 화면만 한 단계씩 빨라졌다. 배율 느림 1 / 보통 0.6 / 빠르게 0.3 × 기본값(글자당 30ms, 첫 글 1.2초, 문단 사이 0.6초, 순 사이 쉼 0.8·1.5·3초). 인트로, 월초 소식, 화면 등장 움직임은 예전 배율(1.5 / 1 / 0.6). 속도 이름 "느리게"는 시안대로 "느림"으로.
- **이달의 결과**: 제목 + 등급 배지(이달의 등급 중 큰 실패 > 대가 있는 성공 > 실패 > 큰 성공 > 성공 순으로 하나) → 순별 한 줄 회고(중순 사건은 "고른 것") → 덕분에 칸(`bonus.*` 장부 행 + 아낀 양) · 사람 칸(사람마다 마지막 일, 3명 + 외 n명) → 아직 남은 일 한 줄 / 오른쪽 식량 장부(얻은 것·쓴 것 각 4줄, 나머지 "그 밖") · 장작 한 줄 / 아래 연대기 한 줄 + 다음 달로.
- **월초 상황 화면**: 지표 바 → 그림(240px) → 그림 아래 소식(겹치지 않게) → 사람들(주요 인물 4명: 이름·역할·상태·이번 달 한마디 + 성인·노인·아이 비율 막대 + 일손·아픈 사람·다친 사람·거처·가죽) → 옆줄(시대 목표, 아직 남은 일, 부족의 기록) → 맨 아래 잿빛강 땅. 땅 정보는 선 아이콘(`LandFact.icon`, 시안 SVG), 위험 칸은 경고색(`tone: 'warn'`). 부족원 명단은 없앴다.
- **시안과 다르게 둔 것**: 제목 "연대기" → "부족의 기록"(§21.1), 결속 "보통" → 기존 구간 이름, 식량 카드의 "약 +420kg"(원정 수확 기대값)은 엔진에 그런 값이 없어 넣지 않았다, 시안 12px 글자 → 13px, 시안의 "다시 보기"(진행 화면)는 없앴다.

### 21.3 4차 피드백: 사용성 (2026-11-25, ②a-2)
- **결정 팝업 자동 열림**: 월초에는 저절로 열지 않는다. 설정 `autoOpenPlan`(기본 끔, "월초에 전략 팝업 자동으로 열기")은 상황 화면에만 쓰이고, 전략과 월초 사건(예약된 손님 등) 모두 이 설정을 따른다. 예전 설정 `autoOpen`은 불러올 때 버린다(새 기본값으로 시작). 상황 화면 아래 "전략 정하기"·"결정하기" 버튼은 맥박 움직임(`u.call`). **진행 화면의 결정(중순 사건, 남은 고기)은 설정과 상관없이 늘 자동으로 연다**(띠 → 1.5초×속도 배율).
- **팝업 위치**: 폭 640px 이상은 화면 가운데(가로·세로) 대화상자 — 너비 `min(1180px, 100% − 48px)`, 높이 `max-height: 100dvh − 48px`, 살짝 커지며 나타남. 폭 640px 미만만 아래에서 올라오는 시트. 전략·사건·남은 고기 모두 같은 `DecisionSheet`.
- **전략 팝업 두 단계** (`DecisionPopup`의 `step`, `PlanSteps`, `PlanBody step`):
  - 머리 줄의 단계 표시 "1 식량 · 2 발전"(누르면 이동, 지금 단계 강조, ②는 식량을 골랐고 큰 일이 아닐 때만).
  - ①단계: 조언 4칸 → 식량 카드 최대 4개(세로 카드, 위에 장면 그림 100px) → 큰 일 줄(번호 0). 식량을 고르면 "다음: 발전 고르기", 큰 일을 고르면 ②를 건너뛰고 "한 달을 시작한다".
  - ②단계: 고른 식량 한 줄("식량: 물고기 떼 잡기 · 16명 · 바꾸기") → 일손 막대 → 발전 카드 최대 3개 + "발전하지 않는다"(세로 카드, 그림 100px). 대가 kg는 고른 식량 기준, 이어지는 공사는 미리 골라 둔다(그대로).
  - 팝업을 닫았다 열면 마지막 단계와 고른 것이 남는다. 상황 화면 아래 바의 "한 달을 시작한다"는 ②단계까지 보았거나 큰 일을 골랐을 때만 보인다(①만 고르고 바에서 바로 시작하지 않게).
  - 아래 줄: ①은 "식량 ○○ · 다음은 발전" + 식량의 대가 글, ②는 "식량 ○○ + 발전 ○○" + 발전의 대가 글(또는 막힌 이유).
  - 키보드: 지금 단계의 카드 1~4, ①단계 0은 큰 일, Enter 다음/확정, Backspace 이전 단계.
- **진행 화면: 세 순이 한 칸에 쌓인다**: 순마다 화면을 바꾸지 않는다(`GameView`의 화면 열쇠가 달마다 하나). 서술 칸에 "상순 · 1~10일", "중순 · 11~20일", "하순 · 21~30일" 소제목과 문단이 차례로 붙고, 지난 순 글(사람 소식 띠, 사건 직전 문장, 고른 것 포함)은 그대로 남는다. 지금 순만 타이핑하고, 다음 순 글은 앞 순 글이 다 나온 뒤에 시작한다(순마다 시계를 새로 잰다). 페이지는 스크롤 없음, 서술 칸(`data-fit="story"`) 안쪽만 스크롤. 새 글이 붙어 칸 높이가 늘면 바닥 근처(40px)일 때 부드럽게 따라가고, 위로 올려 읽고 있으면 따라가지 않고 "새 글 아래에 있음 ↓" 버튼을 띄운다(위로 굴리면 곧바로 따라가기를 멈춘다). 왼쪽 그림은 지금 순 그림. 진행 화면의 한 줄 회고는 없앴다(이달의 결과에는 그대로).
- **이달의 결과: 최종을 맨 위에 크게**: 제목 줄 아래 "최종" + 큰 숫자 칸 두 개("식량 395kg · 14일치 (−36)", "장작 104kg (+30)", 증감 초록/경고색, 0이면 ±0). 그 아래 두 열(회고·덕분에·사람 | 상세 장부)은 그대로 작게. 상세 장부는 시작 → 얻은 것 → 쓴 것 → 최종(작은 한 줄, 장부 순서 규칙 때문에 남김).
- **인트로 약 8초**(`timing.ts`의 `INTRO_TIMING`): 풍경 1.5초 → 4줄(봄·늦가을 프리셋 모두 새 문장) 35ms/글자, 줄 사이 400ms → 마지막 줄 뒤 0.4초 → 부족 이름. 메타 줄 0.6초, 버튼 1초 뒤 0.8초에 걸쳐 나타남. 실측(헤드리스 Chrome, 1366×650, 3회): 버튼이 생겨 누를 수 있게 되기까지 7.1초, 다 나타나기까지 8.9초. 건너뛰기·다시 보기 유지.
- **측정 (2026-11-25, 헤드리스 Chrome + CDP, UI를 직접 눌러 3시드 진행, 판당 7~11달)**: 1366×650 / 1920×950에서 결정 팝업 ①(최대 545px) ②(513px) 사건(482px) 월초 사건(524px) 모두 팝업 안 스크롤 없음, 가운데 정렬(위아래 여백 차 0). 진행 화면과 이달의 결과는 페이지 스크롤 없음. 1366×650에서 하순까지 쌓이면 서술 칸 안쪽이 스크롤되는 달이 28달 중 18달(최대 725/480px) — 허용된 안쪽 스크롤이다.

---

## 22. 인수인계 (새 세션이 먼저 읽을 것)

### 22.1 지금 상태
- **2026-11-25 ②a-2 사용성 수정 (4차 피드백)**(§21.3): 월초 팝업 자동 열림 끔(진행 화면 결정은 늘 자동), 팝업은 가운데 대화상자(640px 미만만 아래 시트), 전략 팝업 두 단계(①식량+큰 일 ②발전, 그림 100px 세로 카드), 진행 화면에 세 순이 쌓임(서술 칸 안쪽만 스크롤, 새 글 따라가기·"새 글 아래에 있음"), 이달의 결과 맨 위 최종 큰 칸, 인트로 4줄 약 8초. 앞의 넘침(11월 전략 팝업 31px, `aa95413`에서 고침)은 새 틀에서 다시 재서 넘치지 않음. 검증: typecheck, test(19개 파일, 146개), validate:content(오류 0, 경고 0), build 통과. **커밋 전**(승인 대기).
- **2026-11-24 전략 두 칸 ②a 화면 (3차 피드백 시안)**(§21.2): 지표 바 공통 컴포넌트, 결정 팝업 두 틀(전략: 구역 제목 한 줄 + 4열 카드 / 사건), 진행 화면(장부 없음, 월초 기준 지표, 사건 직전 문장 + "결정이 필요하다" 띠), 이달의 결과(평온한 달 요약을 대신), 월초 상황 화면 재배치(부족원 명단 제거, 땅 선 아이콘), 진행 화면 속도 한 단계씩 빠르게(`timing.ts`), 전략 25개 한 줄 설명(`brief`), 세이브 v5. **알려진 넘침**: 1366×650에서 11월 전략 팝업이 672px(보이는 641px) — 칩이 두 줄로 넘어가는 달에 큰 일 줄이 겹칠 때. 고치기 전 보고 상태.
- **2026-11-24 전략 두 칸 커밋 ① 엔진 완료**(§6.4): 칸(`slot`), `choosePlan`·`previewPlan`, 두 칸 무리 나누기(큰 일 → 발전 → 식량, 마을 남길 인원 합산), 전략마다 원정지·짐, 한 순에 사건 하나, 시설과 공사(§9.1), 덕분에 줄과 아낀 양, 세이브 v4. 25개 전략에 칸만 달았고 수치는 그대로다. 결정 팝업은 최소 동작(칸 제목, 칸마다 하나, 발전하지 않는다, 대가 kg). 검증: typecheck, test(18개 파일, 136개), validate:content(오류 0, 경고 0), build 통과. `npm run sim -- --strategy sure --months 12`(100판): 첫 겨울 사망 p50 0·p90 3, 배급 감축 이상 95%, 최저 며칠치 p50 0, 결말은 전부 분열(첫 겨울 결속 붕괴) — 커밋 ③에서 맞춘다.
- **알려진 문제 (③에서 먼저 볼 것)**: sure 전략 100판에서 첫 겨울 사망은 중앙값 0이지만 **모든 판이 결속 붕괴로 분열 결말**에 이른다. 사망 수와 별개로 결속 하락(배급 감축 순당 −2, 굶주림 순당 −5, 버티기 방침 −2 등)이 너무 빠른 것으로 보인다. ③에서 결속이 떨어지는 경로별 기여를 먼저 재서 보고하고 고친다.
- **다음**: ① 두 칸 ② 데이터와 화면 — 새 디자인 시안(진행 화면, 이달의 결과, 결정 팝업 두 칸, 월초 상황 화면)을 받은 뒤 새 세션에서. 장인 1명 전략(그물 엮기 등)을 `crew.atHome` 고정 일손으로 정리, 팝업의 kg 대가를 고른 식량 전략 기준으로 계산, 새 발전 전략 8개. ② ③ 시뮬레이터와 밸런스 — foodmax·greedy, 준비 정도별 첫 겨울 목표, "발전 안 하는 전략이 준비 노리는 전략보다 첫 겨울 사망 2명 이상 많음". §6.4.5.5.

#### (이전 기록) §22.5의 1~7번까지
- 2026-11-24: 3~7번 완료. 방침 25개, 사건 27개, 서술 43개. 봄 시작 프리셋이 기본이고 늦가을 프리셋(`grey_river_autumn`)은 숨은 테스트용이다.
- 검증: typecheck, test(16개 파일, 120개), validate:content(오류 0, 경고 0), build 통과.
- 시뮬레이터(임시 스크립트로 잰 값, 8번에서 `npm run sim`에 넣는다): "거의 확실하다" 전략 300판에서 3월 굶주림 0%, 3~10월 사망 중앙값 0(p90 1). 첫 겨울은 아직 너무 혹독하고(그 전략으로 판당 약 16명), random 전략은 봄 굶주림 악순환에 빠진다(3~10월 사망 중앙값 7). 8번에서 맞춘다.

#### (이전 기록) M2 화면 + 표기와 이름 기반, §22.5의 1~2번
- 검증: `npm run typecheck`, `npm test`(16개 파일, 110개), `npm run validate:content`(오류 0, 경고 0), `npm run build` 모두 통과.
- 1~2번 완료: 날짜 "1년차 · 봄 · 3월", 숫자 서식(화면은 아라비아 숫자, `{n:days}` = "18일치"), 조사 서식, 부족 이름 기반(입력 화면은 2026-11-24에 보류), 세이브 v3, 쉬운 표현 교체(§21.1), 검증기 표기 규칙, 숨은 프리셋 필드(`StartPreset.hidden`). **아직 시작 프리셋은 늦가을이다** — 봄 시작은 3번.
- 콘텐츠는 아직 M1 시험용 수준이다: 방침 5개(대사냥, 강가 어로, 겨울 준비, 버티기, 여울 고기 회수), 사건 4개(두 소식, 늑대 눈빛, 낯선 사람들, 얼음이 녹으면 다시), 서술 12개. M2 목표(방침 15+, 사건 20+)까지 채워야 한다.

### 22.2 코드 지도
| 하고 싶은 일 | 볼 곳 |
|---|---|
| 한 달 진행 순서, 결정 지점, 정산 | `src/engine/month/month.ts` (`startMonth`, `run`, `chooseOption`, `settle`) |
| 순마다 마을 일·먹기·장작·부패·건강 | `src/engine/month/upkeep.ts` |
| 월초 보고(머리글·소식·칩·장면) | `src/engine/month/briefing.ts` + 데이터 `src/data/chapters/ch1/briefing.ts` |
| 조언자 대사 고르기 | `src/engine/advice/advice.ts` + 데이터 `ch1/advisors.ts` |
| 방침 후보, 원정대 구성, 위험 단서 | `src/engine/policy/candidates.ts`, `src/engine/outcome/tier.ts` |
| 두 칸 전략 짜기(무리 나누기, 대가 kg, 칸 규칙) | `src/engine/policy/plan.ts` (`previewPlan`) |
| 지금 단계의 전략 맥락(무리, 원정지, 짐) | `src/engine/policy/current.ts` (`currentEntry`, `currentPlace`, `currentHaul`, `planCrew`) |
| 시설 정의 | `src/data/chapters/ch1/world.ts` (`ch1Facilities`) |
| 등급 판정과 대가 표 | `src/engine/outcome/activity.ts` |
| 효과 적용, 장부 행, 알림 | `src/engine/effects/apply.ts` (`ledger`, `alert`, `killPerson`) |
| 시대 목표 진행도 | `src/engine/goals/progress.ts` (`MEASURES`) + 데이터 `ch1/goals.ts` |
| 1장 수치 | `src/data/chapters/ch1/balance.ts`, 공통 `src/data/balance.ts` |
| 문자열 | 공통 `src/data/common/ko.ts`, 1장 `src/data/chapters/ch1/ko.ts` |
| 그림 추가 | `src/assets/scenes/layers.tsx`(그림) → `src/assets/sceneIds.ts`(id 목록) → `src/assets/manifest.ts`(연결). 셋을 같이 고친다 |
| 화면 흐름 | `src/ui/App.tsx` → `screens/GameView.tsx` → `SituationScreen` / `ProgressScreen`(상순·중순·하순) / `ResultScreen`(이달의 결과) / `EndingScreen` |
| 상단 지표 바 (세 화면 공통, 월초 기준 고정) | `src/ui/components/StatusBar.tsx` + 엔진 `work.start`(`monthStartOf`) |
| 진행 화면·이달의 결과의 글 (문단, 사건 직전 문장, 한 줄 회고, 장부 접기) | `src/ui/story.ts` |
| 화면 시간 (속도 배율, 글자당 ms, 쉬는 시간) | `src/ui/timing.ts` |
| 결정 팝업 내용 | `src/ui/components/Decision.tsx` (`decisionModel`, `DecisionPopup`의 단계 `step`) |
| 결정 팝업 틀·카드·전략 두 단계 화면 | `src/ui/components/DecisionSheet.tsx` (`DecisionSheet`, `PlanSteps`, `PlanBody`, `ChoiceCard tall`) |
| 인트로 시간 | `src/ui/timing.ts` (`INTRO_TIMING`) + `intro.module.css`(풍경·버튼 등장 시간) |

### 22.3 콘텐츠를 넣을 때의 규칙 (검증기가 대부분 잡는다)
- 방침마다 문자열 `policy.<id>.name`, `.summary`, `.cost`가 필요하다. 원정대 이름표를 바꾸려면 `.crewLabel`.
- 사건 선택지마다 `event.<id>.opt.<opt>`, 대가 문구 `.cost`(선택), 잠김 힌트 `.lock`(선택). 판정이 없는 선택지는 `hint`를 직접 정한다.
- 예약 사건을 "아직 남은 일"에 보이려면 `event.<id>.memo`를 둔다. 없으면 숨은 약속이다.
- 서술은 효과를 먼저 적용한 뒤 나온다. 그래서 `{caught}`, `{meat}`처럼 그 활동의 결과를 쓸 수 있다. 활동마다 `caught`, `meat`, `found`를 새로 센다.
- 문장 변수에는 받침에 따라 바뀌는 조사를 바로 붙이지 않는다. 우리말 수는 `{n:num}`, `{n:count}`, `{n:days}`.
- 줄의 무리(`group`)가 진행 화면의 문단과 이름표를 정한다: `crew`(원정대), `village`(마을), `event`(사건 제목이 이름표), `people`(알림 카드로만), `info`(이름표 없음).
- 잡을 수 있는 짐승을 추가하면 `row.catch.<id>` 문자열이 필요하다. 병·부상을 추가하면 `ailment.<id>`, `.effect`, `cause.<id>`가 필요하다.

### 22.4 알아 둘 함정
- **검증 도구(tsx)는 CSS를 불러올 수 없다.** 그래서 그림 id 목록을 `sceneIds.ts`로 따로 두었다. `tools/`에서 `src/ui`나 `manifest.ts`를 import하지 않는다.
- **i18n 변수 이름에 `:`를 쓰지 않는다.** `{이름:서식}`이 서식 문법이다. 사건 인물 변수는 `{actor_<슬롯>}`이다.
- **깃발 값은 마지막으로 세운 달이다.** "이번 달에 세웠는가"는 `{ type: 'flag', id, sinceMonths: { max: 0 } }`로 묻는다.
- **원정대는 기본적으로 족장을 빼고 뽑는다.** 바꾸려면 `crew.includeChief`.
- **엔진은 결정 지점까지 미리 계산한다.** 화면의 "계속"은 엔진 명령이 아니다. 방침 카드를 고르는 것도 화면 상태이고, "한 달을 시작한다"를 누를 때 `choosePolicy`가 나간다.
- **화면 표기는 검증기가 잡는다**(§12, §21.1): 화면용 키에 `:count`·`:num`을 쓰면 오류, `{x}` 바로 뒤에 은·는·이·가·을·를·와·과·으로·로를 글자로 붙이면 오류(`{x:이}`로), `{n:count}` 뒤를 띄우면 오류(서식이 띄어쓰기를 넣는다), 추천 부족 이름을 문자열에 직접 쓰면 오류(`{tribe}`로).
- **`{tribe}`는 전역 변수다.** 번역기(`createTranslator(tables, globals)`)가 모든 문자열에 넣는다. 화면은 `App`의 `I18nProvider globals`, 이름은 `ui/format.ts`의 `tribeDisplayName`.
- **화면 날짜**는 `engine/core/lookup.ts`의 `calendarDate`와 `ui/format.ts`의 `dateText`·`shortDateText`. 달 숫자는 `MonthDef.number`, 년차가 바뀌는 달은 `calendar.yearStartsAt`.
- **엔진 시험의 기본 프리셋은 숨은 늦가을이다.** `src/test/fixtures.ts`의 `newGame`은 `grey_river_autumn`(시험 플레이와 같은 상황), 봄 시작은 `springGame`. 결정이 남은 달을 끝까지 진행하려면 `finishMonth`.
- **1장 콘텐츠 문자열은 `ch1/ko.content.ts`**(방침·사건·서술·프리셋·월초 보고·조언). `ch1/ko.ts`는 이름, 세계, 결말, 목표 같은 바탕 문자열이다.
- **`'$place'`**: 조건(`cache`, `animal`의 `at`)과 효과(`cache`)에서 "이번 달 방침이 가는 곳". `bindCache` 방침은 묻은 곳마다 후보를 만들고 `BoundPolicy.place`로 그 곳을 들고 다닌다.
- **계절 수확은 스탯으로 켠다.** `yield.fish_run/eggs/greens/nuts/snare`는 기본 0이고 `world.ts`의 `ch1GlobalMods`(철)나 방침의 `monthMods`(올가미)가 켠다. 마을 수확은 수확 종류마다 더해진다(나눠 가지지 않는다).
- **장작은 쌓아 둘 수 있는 만큼만**(`firewood.cap`: 천막 700, 장작 덧집 +600, 바위굴 +900). 이것이 없으면 여름 장작이 끝없이 쌓여 겨울 장작 위기(C2)가 사라진다.
- **`preserve` 효과**: 날것을 말린 것으로 바꾼다(무게 yield 비율). 이번 달 말린 양은 `$preserved`에 더해진다.
- **오르면 나쁜 스탯**(`spoil.mul`, `cache.raid`, `firewood.burnMul`)을 올리는 모디파이어는 검증기가 비용으로 본다(`BAD_WHEN_UP`).
- **세이브는 버전 5다**(v3: `tribeName`, v4: 두 칸 전략, v5: `work.start`의 월초 지표). `GameState` 구조를 바꾸면 `SAVE_VERSION`을 올리고 `migrations`에 변환을 넣는다(`src/engine/save/`).
- **시험은 PowerShell에서 돌린다.** Git Bash에서 `cd /c/...`로 들어가 `npm test`를 하면 경로 표기가 달라 vitest가 두 번 실려 모든 파일이 `Cannot read properties of undefined (reading 'config')`로 실패한다(코드 문제 아님).
- **자동 진행**(2026-11-24): 흐름 판단은 `src/ui/flow.ts`(순수 함수, 시험 있음). `useClock`은 실제 흐른 시간 `run`과 화면 진행 `elapsed`(= run + 빨리 보기로 건너뛴 시간)를 따로 센다. 자동 진행은 `run`으로 재므로 빨리 보기·움직임 줄이기에서도 타이핑만큼 읽을 시간이 남는다. 결정을 기다리는 동안은 `stopAtEnd`로 시간이 쌓이지 않는다(결정 뒤 글이 같은 보고에 이어 붙기 때문).
- **평온한 달 요약은 없앴다**(2026-11-24 3차 피드백). 이달의 결과가 순별 한 줄 회고로 대신한다.
- **스크롤 없는 세 화면**(§21.2): 결정 팝업·진행 화면·이달의 결과는 1366×650과 1920×950에서 스크롤이 없어야 한다. 넘칠 수 있는 칸에는 `data-fit` 속성이 있고, 높이 측정은 헤드리스 Chrome + CDP 스크립트로 한다(의존성 없음, 스크립트는 저장소에 두지 않았다). 글이 길어지는 콘텐츠(두 칸 전략의 한 순 서술이 450자를 넘는 경우 등)를 넣으면 다시 잰다.
- **높이 재는 법 (4차 피드백부터)**: `vite preview`를 띄우고 헤드리스 Chrome을 `--remote-debugging-port`로 켠 뒤, Node 24 전역 `WebSocket`으로 CDP에 붙어 시작 화면부터 UI를 직접 누른다(설정 `reduceMotion`·`stepByStep`을 localStorage `sac.settings`에 넣어 빨리 진행). 팝업은 `[data-fit=sheet]`의 높이와 `scrollHeight > clientHeight`, 진행·결과는 `document.scrollingElement`의 페이지 스크롤과 `[data-fit=progress|result]`, 서술 칸은 `[data-fit=story]`. 스크립트는 저장소에 두지 않는다(같은 방식으로 다시 쓰면 된다). 팝업 측정의 "페이지 스크롤"은 뒤에 깔린 월초 상황 화면 것이라 무시한다.
- **진행 화면은 한 달에 한 컴포넌트**(4차 피드백): `ProgressScreen`은 순이 바뀌어도 다시 마운트되지 않는다. 순마다 새로 해야 하는 것(시계, 자동 넘김 표시)은 `key = 달-순번`으로 가른다.
- **(해결) 진행 화면 스크롤**: 3차 피드백 화면(§21.2)에서 진행 화면·이달의 결과는 한 화면에 들어간다(1366×650, 1920×950, 3시드 12달 측정).
- **두 칸 전략**(§6.4): `work.chosen`과 `work.place`는 없다. 지금 전략은 `currentEntry(state)`(진행 중이면 그 전략, 마을 살림 중이면 주 전략 `plan[0]`), '$place'는 `currentPlace`, 원정의 짐은 `currentHaul`. `work.haul`은 전략 밖의 짐(월초 사건)만. 칸은 방침 정의의 `slot`에서 읽고 `BoundPolicy`에는 넣지 않는다.
- **덕분에 줄**: 마을 수확에서 `facility.`·`knowledge.` 출처가 늘려 준 몫은 `bonus.<출처>` 장부 행으로 갈라 적는다(합은 그대로). 장작을 아낀 양·덜 상한 양은 장부가 아니라 `work.savings`(정산 보고의 `savings`)다. 장부 행의 합 = 식량 변화라는 시험이 깨지지 않게.
- **마을 일손**: 두 칸 무리(원정 + `crew.atHome`)는 모두 마을 일에서 빠진다. 무리 없이 이끄는 사람만 있는 전략(지금의 그물 엮기 등)은 이끄는 사람이 마을 일을 계속한다 — 커밋 ②에서 `atHome` 무리로 바꾼다.
- **npm 설치가 회사망에서 인증서 오류로 막힌다**(CLAUDE.md "미해결"). 새 의존성이 필요하면 먼저 사용자에게 알린다.

### 22.5 다음 작업 순서 (2026-11-20 봄 시작 전환 뒤, §15.3)
> 2026-11-24: 8번 앞에 전략 두 칸(§6.4)이 들어왔다. 순서는 §6.4.5.5: ① 엔진(완료) → ② 데이터와 화면(새 시안 뒤) → ③ 시뮬레이터와 밸런스(8번 포함) → 9 → 10.
커밋은 세 번: ① 1~2 / ② 3~7 / ③ 8~10. 커밋마다 멈추고 승인받는다.
1. 문서 갱신 (CLAUDE.md, 이 문서)
2. **표기와 이름 기반**: 날짜 표기(§3.1), 숫자 서식과 조사 서식(§12), 부족 이름 입력과 추천 이름, `GameState.tribeName`과 세이브 v3 마이그레이션, 쉬운 표현 교체(§21.1), 검증기 표기 규칙
3. 봄 시작 프리셋(§10.2), 인트로, 첫 달 소식. 늦가을 프리셋은 숨은 테스트용으로 남긴다
4. 계절 수치(봄 물고기 떼, 여름 부패, 가을 열매, 끌개 수정, §10.3)와 봄·여름 그림 레이어(§11.1)
5. 평온한 달 한 화면 요약 UI(§19). 엔진 판정(`MonthReport.quiet`)은 이미 있다
6. 콘텐츠 1차: 봄~가을 준비 방침과 사건, 연결 P1~P10(§18.1, §18.2)
7. 콘텐츠 2차: 겨울 C1~C7, 회수 장소 바인딩(S9), 짐꾼 부르기(S10)
8. 시뮬레이터: 준비를 노리는 greedy, 준비 정도별 첫 겨울 분포, 3월 굶주림 확인(§10.2), 늦가을 프리셋 재현 테스트, 밸런스(§10.8)
9. `MIN_VARIANTS`를 2로 올리고 서술 변형을 채운다
   - **서술이 빈 순**(2026-11-24 플레이 확인): 중순 사건이 있는 달은 결정 팝업이 뜨기 전 진행 화면의 서술 칸이 비어 있다. 사건 본문은 팝업에만 있고(사건 제목 줄은 글이 없어 문단에서 빠진다), 마을 서술은 결정 뒤 순이 끝날 때 붙기 때문이다. 결정을 기다리는 순에도 "사건 전 한두 문장"(전령이 달려온다 등)이 서술 칸에 나오게 사건 데이터에 앞 문장을 두거나, 방침의 중순에 늘 나오는 서술을 넣는다. 검증기는 마을 서술(`hooks.villageNarrative`)에 맞는 변형이 없는 계절을 경고한다(`uncoveredSeasons`). 방침마다 "늘 나오는 서술 없음"을 잡는 경고는 시험해 보니 25개 방침 전부에 걸려 넣지 않았다

10. 첫 해 끝(2년차 3월) 멈춤 화면과 "첫 해의 이야기" → ⚑ 플레이테스트 체크포인트

**M4로 미룬 것**: 계절별 깊은 콘텐츠, 지역 고갈·회복의 전체 체계(M2는 올가미와 강가만), 선택 해상도 해금, 둘째 겨울 비교 목표(D6), 산불·돌림병, 씨앗 심기·길들이기, 늑대 원한의 장기 효과. 떠돌이 무리와 혼인은 M5.
