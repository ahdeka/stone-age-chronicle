// 발전 나무 시험용 데이터 (B 방향 R1-b). 갈래 셋(사냥·물가 / 씨앗 / 집)에 칸 다섯, 칸이 여는 시험용 전략.
// 본편(칸 12개, 여는 것과 수치)은 R4에서 이 파일을 채운다 (DESIGN.md §B3.1, §B3.2). 수치는 모두 시험값이다.
//
// 1년차 겨울 준비 둘(끌개 엮기 make_sled, 굴 다지기 cave_fortify → 저장 구덩이)은 1년차 작은 발전으로 남는다(2026-11-26 결정).
// 다 지으면(그 지식을 얻으면) 끌개 칸 / 굴 다지기 칸에 절반을 선물한다(world.ts의 지식 grantEffects). 2년차부터는 칸으로만 진행한다.

import type { Condition, EventOption, Narrative, PolicyStep, PolicyTemplate, TechTreeDef } from '../../../engine';
import { huntCosts, huntPower } from './policies';

const cellDone = (id: string) => ({ type: 'tech' as const, id, status: ['done' as const] });
const inSeasonTurn: Condition[] = [{ type: 'turnKind', in: ['season'] }];

export const ch1Tech: TechTreeDef = {
  branches: ['hunt_water', 'seed', 'home'],
  cells: [
    {
      id: 'stone_spear',
      branch: 'hunt_water',
      order: 1,
      requires: { all: [] },
      seasons: 1,
      crew: { adults: 3, person: { seat: 'hunt_leader', ailing: false }, fallback: { seat: 'artisan', ailing: false } },
      unlocks: [{ kind: 'policy', id: 'bison_drive' }],
      scene: { bg: '{camp}', subjects: ['sub.hunters', 'sub.fire_circle'], overlay: '{weather}' },
    },
    {
      // 갈래 끝: 같은 갈래 앞 칸 하나 이상이 켜져야 시작한다 (§B3.5 안 A)
      id: 'sled',
      branch: 'hunt_water',
      order: 4,
      requires: { branchDone: 'hunt_water', min: 1 },
      seasons: 1,
      crew: { adults: 3, person: { seat: 'artisan', ailing: false } },
      cost: { goods: { hide: 2 } },
      unlocks: [{ kind: 'policy', id: 'far_hunt' }],
      grants: { knowledge: ['sled'] },
      // 끌개로 짐꾼이 더 나른다 (계절 턴의 남은 고기 자동 처리 포함)
      mods: [{ stat: 'carry.porterMul', op: 'add', value: 0.5 }],
      scene: { bg: '{camp}', subjects: ['sub.gatherers', 'sub.firewood'], overlay: '{weather}' },
    },
    {
      id: 'grinding_stone',
      branch: 'seed',
      order: 1,
      requires: { all: [] },
      seasons: 1,
      crew: { adults: 2, person: { seat: 'healer', ailing: false } },
      unlocks: [{ kind: 'policy', id: 'acorn_grind' }],
      scene: { bg: '{camp}', subjects: ['sub.gatherers'], overlay: '{weather}' },
    },
    {
      id: 'tent_repair',
      branch: 'home',
      order: 1,
      requires: { all: [] },
      seasons: 1,
      crew: { adults: 3 },
      cost: { goods: { hide: 6 } },
      unlocks: [{ kind: 'policy', id: 'waterside_camp' }],
      // 물가 야영의 짐꾼: 고친 천막을 지고 가 강가에서 나른다
      mods: [{ stat: 'carry.porterMul', op: 'add', value: 0.25 }],
      scene: { bg: 'bg.camp_tents', subjects: ['sub.gatherers'], overlay: '{weather}' },
    },
    {
      // 천막 보수가 켜졌거나 바위굴에 살고 있으면 열린다 (1년차에 굴을 얻은 부족이 1년차에 켤 수 있게)
      id: 'cave_fortify',
      branch: 'home',
      order: 2,
      requires: { any: ['tent_repair'], or: [{ type: 'shelter', in: ['rock_cave'] }] },
      seasons: 1,
      crew: { adults: 4 },
      cost: { firewoodKg: 100 },
      unlocks: [{ kind: 'option', event: 'wolves_circle_camp', option: 'fence' }],
      grants: { knowledge: ['storage_pit'] },
      // 굴의 장작 1/3 절감 (울타리와 입구 막이)
      mods: [{ stat: 'firewood.burnMul', op: 'mul', value: 0.67, when: [{ type: 'shelter', in: ['rock_cave'] }] }],
      scene: { bg: 'bg.cave_mouth', subjects: ['sub.gatherers', 'sub.firewood'], overlay: '{weather}' },
    },
  ],
};

/** 사냥 한 단계 (그 달 첫 순): 사슴 몰이. 칸이 연 사냥은 조금 쉽다 */
function huntStage(difficulty: number): PolicyStep[] {
  return [
    {
      kind: 'activity' as const,
      activity: {
        power: huntPower(0.45),
        difficulty,
        outcomes: {
          triumph: { narrative: 'deer_good', effects: [{ type: 'catch' as const, animal: 'red_deer', count: [3, 5] as const }] },
          success: { narrative: 'deer_good', effects: [{ type: 'catch' as const, animal: 'red_deer', count: [2, 4] as const }] },
          costly: { narrative: 'deer_good', effects: [{ type: 'catch' as const, animal: 'red_deer', count: [1, 2] as const }] },
          failure: { narrative: 'deer_bad', effects: [{ type: 'catch' as const, animal: 'red_deer', count: [0, 1] as const }] },
          disaster: { narrative: 'deer_bad', effects: [] },
        },
        costs: huntCosts,
      },
    },
    { kind: 'carry' as const },
  ];
}

/** 칸이 여는 전략 (시험용, R4에서 본편으로) */
export const ch1TechPolicies: PolicyTemplate[] = [
  {
    // 돌창 손질 → 가까이서 큰 짐승 (겨울에도 나온다, 1년차 달 턴에도). 달 턴은 상순에 한 번 몰고 하순에 나르고,
    // 계절 턴은 단계(달)마다 몬다
    id: 'bison_drive',
    slot: 'food',
    turn: 'any',
    category: 'hunt',
    appearsWhen: [cellDone('stone_spear')],
    relevance: [{ when: [{ type: 'season', in: ['winter'] }], add: 10 }],
    priority: 45,
    cooldown: 0,
    crew: { min: 4, max: 6, keepHome: 8, prefer: 'hunt' },
    place: 'east_steppe',
    leader: { seat: 'hunt_leader', ailing: false },
    scene: { bg: '{place}', subjects: ['sub.deer', 'sub.hunters'], overlay: '{weather}' },
    steps: {
      early: [huntStage(5.4)[0]!, { kind: 'carry', when: inSeasonTurn }],
      mid: huntStage(5.4).map((s) => ({ ...s, when: inSeasonTurn })),
      late: [{ ...huntStage(5.4)[0]!, when: inSeasonTurn }, { kind: 'carry' }],
    },
  },
  {
    // 끌개 → 먼 사냥터 원정 (끌개로 실어 온다)
    id: 'far_hunt',
    slot: 'food',
    turn: 'season',
    category: 'hunt',
    appearsWhen: [cellDone('sled')],
    priority: 44,
    cooldown: 0,
    crew: { min: 5, max: 7, keepHome: 8, prefer: 'hunt' },
    place: 'reindeer_ford',
    leader: { seat: 'hunt_leader', ailing: false },
    scene: { bg: '{place}', subjects: ['sub.deer', 'sub.hunters'], overlay: '{weather}' },
    steps: { early: huntStage(5.8), mid: huntStage(5.8), late: huntStage(5.8) },
  },
  {
    // 갈돌 → 도토리 갈무리 (가을, 1년차에도)
    id: 'acorn_grind',
    slot: 'food',
    turn: 'any',
    category: 'gather',
    appearsWhen: [cellDone('grinding_stone'), { type: 'season', in: ['autumn'] }],
    priority: 52,
    cooldown: 0,
    monthMods: [{ stat: 'yield.nuts', op: 'mul', value: 1.4 }],
    scene: { bg: '{camp}', subjects: ['sub.gatherers'], overlay: '{weather}' },
    steps: { early: [{ kind: 'narrate', narrative: 'acorn_grind' }] },
  },
  {
    // 천막 보수 → 물가 야영 (여름, 1년차에도)
    id: 'waterside_camp',
    slot: 'food',
    turn: 'any',
    category: 'fish',
    appearsWhen: [cellDone('tent_repair'), { type: 'season', in: ['summer'] }],
    priority: 52,
    cooldown: 0,
    monthMods: [
      { stat: 'yield.fish', op: 'mul', value: 1.4 },
      { stat: 'yield.gather', op: 'mul', value: 1.1 },
    ],
    scene: { bg: 'bg.river_ford', subjects: ['sub.gatherers'], overlay: '{weather}' },
    steps: { early: [{ kind: 'narrate', narrative: 'waterside_camp' }] },
  },
  {
    // 겨울 "저장분으로 버틴다" (§B4.5): 저장분이 이 철 소비의 70% 이상일 때. 배급 90%로 먹고(감축 판정),
    // 마을 가까이 일만 하며 남는 손이 발전에 붙는다(그 철 발전 진척 +1철)
    id: 'winter_stores',
    slot: 'food',
    turn: 'season',
    category: 'hold',
    appearsWhen: [{ type: 'season', in: ['winter'] }, { type: 'foodDays', min: 63 }],
    priority: 50,
    cooldown: 0,
    techBonus: 1,
    monthMods: [
      { stat: 'ration.cap', op: 'mul', value: 0.9 },
      { stat: 'yield.gather', op: 'mul', value: 0.5 },
      { stat: 'yield.fish', op: 'mul', value: 0.5 },
      { stat: 'yield.winter_fish', op: 'mul', value: 0.5 },
    ],
    // 위험 단서 = 저장분 ÷ 이 철 소비(90% 배급, 90일 × 0.9 = 81일치)
    hintWhen: [
      { when: [{ type: 'foodDays', min: 81 }], hint: 'sure' },
      { when: [{ type: 'foodDays', min: 69 }], hint: 'fair' },
      { when: [], hint: 'risky' },
    ],
    scene: { bg: '{camp}', subjects: ['sub.fire_circle', 'sub.firewood'], overlay: '{weather}' },
    steps: { early: [{ kind: 'narrate', narrative: 'winter_stores' }] },
  },
];

/** 굴 다지기가 연 선택지: 늑대가 마을을 돌 때 울타리 안에서 지킨다 */
export const fenceOption: EventOption = {
  id: 'fence',
  hint: 'sure',
  requires: [cellDone('cave_fortify')],
  effects: [
    { type: 'firewood', kg: -20 },
    { type: 'modifier', mod: { stat: 'yield.gather', op: 'mul', value: 0.85 }, months: 1 },
    { type: 'animal', id: 'wolves', state: 'roaming', at: null },
    { type: 'line', key: 'event.wolves_circle_camp.res.fence' },
  ],
};

export const ch1TechNarratives: Narrative[] = [
  { id: 'acorn_grind', variants: [{ text: 'nar.acorn_grind.1' }] },
  { id: 'waterside_camp', variants: [{ text: 'nar.waterside_camp.1' }] },
  { id: 'winter_stores', variants: [{ text: 'nar.winter_stores.1' }] },
];

export const ch1TechKo: Record<string, string> = {
  // 칸 이름 (장부·덕분에 줄의 출처 이름이기도 하다)
  'tech.stone_spear': '돌창 손질',
  'tech.sled': '끌개',
  'tech.grinding_stone': '갈돌',
  'tech.tent_repair': '천막 보수',
  'tech.cave_fortify': '굴 다지기',
  'tech.none': '발전 대신 식량에 붙은 사람들',
  // 칸 일 서술 (턴 첫 단계에 한 줄)
  'tech.stone_spear.work': '{leader:이} 사냥꾼들과 강돌에 창끝을 다시 갈았다.',
  'tech.sled.work': '{leader:이} 장대 두 개에 가죽끈을 엮어 짐을 끄는 틀을 짰다.',
  'tech.grinding_stone.work': '{leader:이} 넓적한 돌을 골라 가운데를 오목하게 갈아 냈다.',
  'tech.tent_repair.work': '사람들이 해진 가죽을 걷어 내고 새 가죽을 덧대 꿰맸다.',
  'tech.cave_fortify.work': '굴 입구에 가시나무 울타리를 두르고 안쪽에 구덩이를 팠다.',
  // 칸 전략 카드
  'policy.cell_stone_spear.name': '돌창 손질',
  'policy.cell_stone_spear.summary': '사냥꾼들이 창끝을 다시 갈고 자루를 바꾼다.',
  'policy.cell_stone_spear.brief': '창끝을 다시 간다.',
  'policy.cell_stone_spear.cost': '3명이 마을 일에서 빠진다.',
  'policy.cell_sled.name': '끌개',
  'policy.cell_sled.summary': '장대와 가죽끈으로 짐을 끄는 끌개를 엮는다.',
  'policy.cell_sled.brief': '짐 끄는 끌개를 엮는다.',
  'policy.cell_sled.cost': '가죽 2장 · 3명이 마을 일에서 빠진다.',
  'policy.cell_grinding_stone.name': '갈돌',
  'policy.cell_grinding_stone.summary': '열매와 풀씨를 가는 넓적한 돌을 다듬는다.',
  'policy.cell_grinding_stone.brief': '씨를 가는 돌을 다듬는다.',
  'policy.cell_grinding_stone.cost': '2명이 마을 일에서 빠진다.',
  'policy.cell_tent_repair.name': '천막 보수',
  'policy.cell_tent_repair.summary': '해진 천막에 새 가죽을 덧대 비를 막는다.',
  'policy.cell_tent_repair.brief': '천막에 가죽을 덧댄다.',
  'policy.cell_tent_repair.cost': '가죽 6장 · 3명이 마을 일에서 빠진다.',
  'policy.cell_cave_fortify.name': '굴 다지기',
  'policy.cell_cave_fortify.summary': '입구에 가시 울타리를 두르고 굴 안쪽에 저장 구덩이를 판다.',
  'policy.cell_cave_fortify.brief': '울타리와 저장 구덩이.',
  'policy.cell_cave_fortify.cost': '장작 100kg · 4명이 마을 일에서 빠진다.',
  // 칸이 여는 전략
  'policy.bison_drive.name': '들소 몰이',
  'policy.bison_drive.summary': '손질한 창을 들고 동쪽 초원에서 큰 짐승을 몬다.',
  'policy.bison_drive.brief': '가까이서 큰 짐승을 몬다.',
  'policy.bison_drive.cost': '사냥꾼이 한 철 내내 빠진다. 다칠 수 있다.',
  'policy.far_hunt.name': '먼 사냥터 원정',
  'policy.far_hunt.summary': '끌개를 끌고 순록 여울까지 가서 잡은 것을 실어 온다.',
  'policy.far_hunt.brief': '끌개로 먼 사냥터까지.',
  'policy.far_hunt.cost': '사냥꾼 여럿이 한 철 내내 빠진다. 다칠 수 있다.',
  'policy.acorn_grind.name': '도토리 갈무리',
  'policy.acorn_grind.summary': '도토리를 주워 갈돌에 갈고 물에 우려 오래 두고 먹는다.',
  'policy.acorn_grind.brief': '도토리를 갈아 둔다.',
  'policy.acorn_grind.cost': '다른 채집이 그만큼 줄어든다.',
  'policy.waterside_camp.name': '물가 야영',
  'policy.waterside_camp.summary': '고친 천막을 강가에 치고 한동안 머물며 물고기를 건진다.',
  'policy.waterside_camp.brief': '강가에 머물며 건진다.',
  'policy.waterside_camp.cost': '물고기는 빨리 상한다.',
  'policy.winter_stores.name': '저장분으로 버틴다',
  'policy.winter_stores.summary': '쌓아 둔 것을 아껴 먹으며 굴 가까이에서 손일을 한다.',
  'policy.winter_stores.brief': '아껴 먹고 손일을 한다.',
  'policy.winter_stores.cost': '배급 90% · 결속이 조금 흔들린다. 발전이 한 철 빨라진다.',
  'nar.acorn_grind.1': '아이들이 떡갈나무 아래에서 도토리를 주워 왔다. 어른들은 갈돌에 갈아 개울물에 우렸다.',
  'nar.waterside_camp.1': '고친 천막을 강가 자갈밭에 쳤다. 사람들은 해가 뜨면 물에 들어가고 해가 지면 불가에 모였다.',
  'nar.winter_stores.1': '사람들은 쌓아 둔 것을 조금씩 덜어 먹었다. 남는 손은 불가에서 돌을 갈고 가죽을 꿰맸다.',
  // 굴 다지기가 연 선택지
  'event.wolves_circle_camp.opt.fence': '울타리 안에서 지킨다',
  'event.wolves_circle_camp.opt.fence.cost': '장작 20kg · 이번 달 채집이 조금 준다',
  'event.wolves_circle_camp.opt.fence.lock': '굴 다지기를 마쳐야 한다',
  'event.wolves_circle_camp.res.fence': '사람들은 가시 울타리 안쪽에 모여 불을 지켰다. 늑대들은 울타리 밖을 돌다 새벽에 물러갔다.',
  // 진척과 켜짐 (정산 줄)
  'line.tech.work': '{cell} 진척 {pct}%',
  'line.tech.drift': '손이 남는 사람들이 틈틈이 {cell:을} 이어 갔다 (진척 {pct}%)',
  'line.tech.done': '{cell:이} 켜졌다. 부족이 할 수 있는 일이 하나 늘었다.',
  'line.tech.neolithic': '두 갈래의 끝에 닿았다. 새 시대가 가까이 왔다.',
  'chron.tech.done': '{tribe:은} {cell:을} 익혔다.',
};
