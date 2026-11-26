// 1장 방침 (화면 표기: "전략"). 봄 시작 첫 해 (DESIGN.md §18.1): 계절마다 겨울을 위한 준비 거리가 있고,
// 겨울에는 시험 플레이의 상황들이 나온다. 준비 → 겨울 연결은 §18.2 P1~P10, 연결 지도는 §18 C1~C7.

import type { Condition, CostEntry, Effect, PolicyTemplate, PowerTerm } from '../../../engine';

/** 사냥의 힘: 원정대(숙련) + 창 + 날씨 + 단서·사건 보정 + 이끄는 사람 */
export function huntPower(crewWeight: number): PowerTerm[] {
  return [
    { src: 'crew', weight: crewWeight, skill: 'hunt', skillWeight: 0.3 },
    { src: 'goods', id: 'spear', perCrew: true, weight: 1 },
    { src: 'stat', id: 'hunt.weather', weight: 1 },
    { src: 'stat', id: 'hunt.bonus', weight: 1 },
    { src: 'leader', skill: 'hunt', weight: 0.2 },
  ];
}

export const huntCosts: CostEntry[] = [
  { weight: 3, effects: [{ type: 'injure', who: { crew: 'front' }, ailment: 'fracture', severity: 2 }] },
  { weight: 3, effects: [{ type: 'injure', who: { crew: 'random' }, ailment: 'claw', severity: 1 }] },
  { weight: 1, effects: [{ type: 'death', who: { crew: 'front' }, cause: 'hunt' }] },
  { weight: 2, effects: [{ type: 'goods', id: 'spear', delta: [-4, -2] }, { type: 'line', key: 'line.spears_broken' }] },
];

/** 겨울 사냥의 대가: 동상 (가죽옷이 있으면 덜하다) */
const winterHuntCosts: CostEntry[] = [
  ...huntCosts,
  { weight: 4, when: [{ type: 'knowledge', id: 'fur_clothes', has: false }], effects: [{ type: 'injure', who: { crew: 'weakest' }, ailment: 'frostbite', severity: 2 }] },
  { weight: 1, when: [{ type: 'knowledge', id: 'fur_clothes' }], effects: [{ type: 'injure', who: { crew: 'weakest' }, ailment: 'frostbite', severity: 1 }] },
];

const calledOff: Condition[] = [{ type: 'flag', id: 'hunt_called_off', sinceMonths: { max: 0 } }];
const notCalledOff: Condition[] = [{ type: 'not', of: { type: 'all', of: calledOff } }];
const artisanReady: Condition = { type: 'person', match: { seat: 'artisan', ailing: false } };
const healerReady: Condition = { type: 'person', match: { seat: 'healer', ailing: false } };
const warm: Condition = { type: 'season', in: ['spring', 'summer', 'autumn'] };

/** 말리기: 말리는 법을 알면 많이, 모르면 조금 (배우는 중) */
function drying(knownKg: number, learningKg: number): Effect[] {
  return [
    {
      type: 'if',
      when: [{ type: 'knowledge', id: 'meat_drying' }],
      then: [
        { type: 'preserve', from: ['fish'], to: 'dried_fish', maxKg: knownKg, yield: 0.8 },
        { type: 'preserve', from: ['raw_meat'], to: 'dried_meat', maxKg: knownKg, yield: 0.8 },
      ],
      else: [
        { type: 'preserve', from: ['fish'], to: 'dried_fish', maxKg: learningKg, yield: 0.6 },
        { type: 'preserve', from: ['raw_meat'], to: 'dried_meat', maxKg: learningKg, yield: 0.6 },
      ],
    },
  ];
}

/** 만들기 판정: 장인의 손재주 (이끄는 사람 = 장인) */
const craftPower: PowerTerm[] = [
  { src: 'leader', skill: 'craft', weight: 0.8 },
  { src: 'const', value: 1 },
];

export const ch1Policies: PolicyTemplate[] = [
  // ───────────── 봄 ─────────────
  {
    // 봄 물고기 떼 (P1의 시작): 그물이 있어야 한다. 많이 잡지만 날것은 상한다
    id: 'fish_run_weirs',
    slot: 'food',
    category: 'fish',
    appearsWhen: [{ type: 'animal', id: 'fish', state: ['running'] }, { type: 'goods', id: 'net', min: 1 }],
    relevance: [{ when: [{ type: 'foodDays', max: 10 }], add: 25 }],
    priority: 55,
    cooldown: 0,
    firewoodShare: 0.1,
    monthMods: [
      { stat: 'yield.fish_run', op: 'mul', value: 2 },
      { stat: 'yield.fish', op: 'mul', value: 1.3 },
      { stat: 'yield.gather', op: 'mul', value: 0.6 },
    ],
    scene: { bg: 'bg.river_ford', subjects: ['sub.fish_run', 'sub.gatherers'], overlay: '{weather}' },
    knowledgeProgress: { meat_drying: 1 },
    steps: {
      early: [{ kind: 'narrate', narrative: 'weir_month' }],
      mid: [{ kind: 'eventWindow', pool: ['fish_glut'], chance: 0.6 }],
    },
  },
  {
    id: 'river_gather',
    slot: 'food',
    category: 'gather',
    appearsWhen: [warm],
    // 먹을 것이 모자라면 가장 먼저 떠오르는 안전한 길
    relevance: [
      { when: [{ type: 'foodDays', max: 20 }], add: 30 },
      { when: [{ type: 'season', in: ['summer'] }], add: 10 },
    ],
    priority: 30,
    cooldown: 0,
    firewoodShare: 0.1,
    monthMods: [
      { stat: 'yield.gather', op: 'mul', value: 1.6 },
      { stat: 'yield.fish', op: 'mul', value: 1.6 },
      { stat: 'yield.greens', op: 'mul', value: 1.5 },
      { stat: 'yield.eggs', op: 'mul', value: 1.5 },
    ],
    scene: { bg: '{camp}', subjects: ['sub.gatherers'], overlay: '{weather}' },
    steps: { early: [{ kind: 'narrate', narrative: 'gather_month' }] },
  },
  {
    // 봄의 순록: 북쪽으로 올라가는 무리의 낙오자를 노린다 (가죽을 모은다 → 가죽옷, 교역)
    id: 'spring_reindeer_hunt',
    slot: 'food',
    category: 'hunt',
    appearsWhen: [{ type: 'animal', id: 'reindeer', state: ['migrating'] }, { type: 'season', in: ['spring'] }],
    priority: 45,
    cooldown: 1,
    crew: { min: 4, max: 8, keepHome: 8, prefer: 'hunt' },
    place: 'east_steppe',
    leader: { seat: 'hunt_leader', ailing: false },
    scene: { bg: '{place}', subjects: ['sub.reindeer_run', 'sub.hunters'], overlay: '{weather}' },
    steps: {
      early: [
        {
          kind: 'activity',
          activity: {
            power: huntPower(0.4),
            difficulty: 6.6,
            outcomes: {
              triumph: { narrative: 'spring_herd_good', effects: [{ type: 'catch', animal: 'reindeer', count: [6, 8] }, { type: 'cohesion', delta: 5 }] },
              success: { narrative: 'spring_herd_good', effects: [{ type: 'catch', animal: 'reindeer', count: [3, 5] }, { type: 'cohesion', delta: 3 }] },
              costly: { narrative: 'spring_herd_good', effects: [{ type: 'catch', animal: 'reindeer', count: [3, 4] }] },
              failure: { narrative: 'spring_herd_bad', effects: [{ type: 'catch', animal: 'reindeer', count: [0, 1] }] },
              disaster: { narrative: 'spring_herd_bad', effects: [] },
            },
            costs: huntCosts,
          },
        },
      ],
      late: [{ kind: 'carry' }],
    },
  },
  {
    // 늪지 너머 (시안의 방침, P6의 시작): 갈대호수 사람들을 찾는다
    id: 'marsh_scouting',
    slot: 'growth',
    category: 'explore',
    appearsWhen: [warm, { type: 'flag', id: 'reed_lake_met', present: false }],
    relevance: [{ when: [{ type: 'season', in: ['spring', 'summer'] }], add: 10 }],
    priority: 35,
    cooldown: 2,
    crew: { min: 3, max: 4, keepHome: 8, prefer: 'gather' },
    place: 'south_marsh',
    scene: { bg: '{place}', subjects: ['sub.hunters', 'sub.reeds'], overlay: '{weather}' },
    steps: {
      early: [
        {
          kind: 'activity',
          activity: {
            power: [{ src: 'crew', weight: 0.6 }, { src: 'stat', id: 'hunt.weather', weight: 0.5 }],
            difficulty: 1.4,
            hidden: [{ id: 'beyond_marsh', knownWhen: [{ type: 'flag', id: 'reed_lake_seen' }] }],
            outcomes: {
              triumph: { narrative: 'marsh_found', effects: [] },
              success: { narrative: 'marsh_found', effects: [] },
              costly: { narrative: 'marsh_found', effects: [] },
              failure: { narrative: 'marsh_lost', effects: [] },
              disaster: { narrative: 'marsh_lost', effects: [] },
            },
            costs: [
              { weight: 2, effects: [{ type: 'injure', who: { crew: 'random' }, ailment: 'fever', severity: 1 }] },
              { weight: 1, effects: [{ type: 'injure', who: { crew: 'weakest' }, ailment: 'fracture', severity: 1 }] },
            ],
          },
        },
      ],
      mid: [{ kind: 'eventWindow', pool: ['reed_lake_first_meeting'], chance: 0.9 }],
      late: [{ kind: 'carry' }],
    },
  },
  {
    // 그물 짜기 (이끼): 그물이 늘면 물고기 떼를 더 잡는다
    id: 'net_making',
    prep: 'winter',
    slot: 'growth',
    category: 'craft',
    appearsWhen: [artisanReady, { type: 'goods', id: 'net', max: 2 }, warm],
    priority: 28,
    cooldown: 2,
    leader: { seat: 'artisan', ailing: false },
    monthMods: [{ stat: 'yield.gather', op: 'mul', value: 0.85 }],
    scene: { bg: '{camp}', subjects: ['sub.gatherers', 'sub.fire_circle'], overlay: '{weather}' },
    steps: { late: [{ kind: 'narrate', narrative: 'net_month', effects: [{ type: 'goods', id: 'net', delta: 1 }] }] },
  },

  // ───────────── 여름 ─────────────
  {
    // 말리기 (P1): 날것을 말린 고기·물고기로. 말리는 법이 자라고, 겨울 식량이 된다
    id: 'drying_racks',
    slot: 'food',
    category: 'store',
    appearsWhen: [warm, { type: 'food', kinds: ['fish', 'raw_meat'], min: 60 }],
    relevance: [
      { when: [{ type: 'season', in: ['summer'] }], add: 15 },
      { when: [{ type: 'food', kinds: ['fish', 'raw_meat'], min: 250 }], add: 20 },
    ],
    priority: 32,
    cooldown: 0,
    firewoodShare: 0.3,
    monthMods: [{ stat: 'yield.gather', op: 'mul', value: 0.8 }],
    scene: { bg: '{camp}', subjects: ['sub.meat_rack', 'sub.fire_circle'], overlay: '{weather}' },
    knowledgeProgress: { meat_drying: 2 },
    steps: {
      early: [{ kind: 'narrate', narrative: 'drying_month', effects: drying(160, 50) }],
      mid: [{ kind: 'narrate', effects: drying(160, 50) }],
      late: [{ kind: 'narrate', effects: [...drying(160, 50), { type: 'line', key: 'line.dried', params: { kg: '$preserved' } }] }],
    },
  },
  {
    // 바위굴 찾기 (C3, P3): 여름에 찾으면 곰이 비운 굴, 겨울에 찾으면 곰이 잠든 굴
    id: 'find_rock_cave',
    slot: 'growth',
    category: 'explore',
    appearsWhen: [{ type: 'shelter', in: ['tent'] }, { type: 'place', id: 'north_cave', discovered: false }, { type: 'month', min: 3 }],
    relevance: [
      { when: [{ type: 'season', in: ['winter'] }], add: 25 },
      { when: [{ type: 'firewoodDays', max: 5 }, { type: 'season', in: ['winter'] }], add: 20 },
    ],
    priority: 34,
    cooldown: 1,
    crew: { min: 3, max: 4, keepHome: 8, prefer: 'craft' },
    place: 'north_cave',
    scene: { bg: 'bg.north_forest', subjects: ['sub.hunters'], overlay: '{weather}' },
    steps: {
      early: [
        {
          kind: 'activity',
          activity: {
            power: [{ src: 'crew', weight: 0.5 }, { src: 'stat', id: 'hunt.weather', weight: 0.5 }],
            difficulty: 1,
            hidden: [{ id: 'cave_owner', knownWhen: [{ type: 'clue', id: 'bear_den_lore' }] }],
            outcomes: {
              triumph: { narrative: 'cave_found', effects: [] },
              success: { narrative: 'cave_found', effects: [] },
              costly: { narrative: 'cave_found', effects: [] },
              failure: { narrative: 'cave_not_found', effects: [] },
              disaster: { narrative: 'cave_not_found', effects: [] },
            },
            costs: [{ weight: 1, effects: [{ type: 'injure', who: { crew: 'random' }, ailment: 'fracture', severity: 1 }] }],
          },
        },
      ],
      mid: [{ kind: 'eventWindow', pool: ['empty_cave_claws', 'cave_bear_last_sack'], chance: 1 }],
      late: [{ kind: 'carry' }],
    },
  },
  {
    // 찾아 둔 굴로 옮긴다 (P3): 겨울 전에 옮기면 서리달에 곰이 돌아온다
    id: 'move_to_cave',
    slot: 'major',
    category: 'shelter',
    appearsWhen: [
      { type: 'place', id: 'north_cave', fact: 'claw_marks' },
      { type: 'shelter', in: ['tent'] },
      { type: 'not', of: { type: 'animal', id: 'bear', state: ['denning'], at: 'north_cave' } },
    ],
    relevance: [{ when: [{ type: 'season', in: ['autumn', 'winter'] }], add: 25 }],
    priority: 30,
    cooldown: 0,
    firewoodShare: 0.3,
    scene: { bg: 'bg.cave_mouth', subjects: ['sub.gatherers', 'sub.claw_marks'], overlay: '{weather}' },
    steps: {
      early: [
        {
          kind: 'narrate',
          narrative: 'move_cave',
          effects: [
            { type: 'shelter', kind: 'rock_cave', place: 'north_cave', units: 1 },
            {
              type: 'if',
              when: [{ type: 'flag', id: 'bear_killed', present: false }, { type: 'season', in: ['spring', 'summer', 'autumn'] }],
              then: [{ type: 'schedule', event: 'bear_returns', after: 1, window: 12, when: [{ type: 'monthOfYear', in: ['frost'] }] }],
            },
            { type: 'chronicle', key: 'chron.moved_cave', importance: 45 },
          ],
        },
      ],
    },
  },
  {
    // 굴 다지기 (P4): 가시 울타리와 저장 구덩이 → 저장 구덩이 지식, 영구 거처 목표
    id: 'cave_fortify',
    prep: 'winter',
    slot: 'growth',
    category: 'shelter',
    appearsWhen: [{ type: 'shelter', in: ['rock_cave'] }, { type: 'knowledge', id: 'storage_pit', has: false }],
    priority: 30,
    cooldown: 0,
    monthMods: [{ stat: 'yield.gather', op: 'mul', value: 0.8 }],
    scene: { bg: 'bg.cave_mouth', subjects: ['sub.gatherers', 'sub.firewood'], overlay: '{weather}' },
    knowledgeProgress: { storage_pit: 2 },
    steps: { early: [{ kind: 'narrate', narrative: 'fortify_month', effects: [{ type: 'counter', id: 'cave_fortify', delta: 1 }] }] },
  },
  {
    // 장작 비축 (P2): 덧집을 지어 장작을 더 쌓아 둔다
    id: 'firewood_stockpile',
    prep: 'winter',
    slot: 'growth',
    category: 'firewood',
    // 덧집을 다 짓고 장작이 거의 차 있으면 나오지 않는다 (③a: 여름 내내 일손을 장작에 묶는 함정)
    appearsWhen: [
      { type: 'season', in: ['spring', 'summer'] },
      { type: 'month', min: 2 },
      { type: 'not', of: { type: 'all', of: [{ type: 'facility', id: 'wood_shed' }, { type: 'firewoodFill', min: 0.85 }] } },
    ],
    relevance: [{ when: [{ type: 'season', in: ['summer'] }], add: 10 }],
    priority: 26,
    cooldown: 2,
    firewoodShare: 0.4,
    monthMods: [{ stat: 'yield.wood', op: 'mul', value: 1.2 }],
    scene: { bg: '{camp}', subjects: ['sub.firewood'], overlay: '{weather}' },
    steps: { early: [{ kind: 'narrate', narrative: 'stockpile_month', effects: [{ type: 'facility', id: 'wood_shed', level: 1 }] }] },
  },
  {
    // 가죽 손질과 겨울옷 (P5)
    id: 'tan_hides',
    prep: 'winter',
    slot: 'growth',
    category: 'craft',
    appearsWhen: [{ type: 'goods', id: 'hide', min: 6 }, { type: 'knowledge', id: 'fur_clothes', has: false }],
    relevance: [{ when: [{ type: 'season', in: ['autumn'] }], add: 15 }],
    priority: 27,
    cooldown: 0,
    monthMods: [{ stat: 'yield.gather', op: 'mul', value: 0.85 }],
    scene: { bg: '{camp}', subjects: ['sub.hides', 'sub.gatherers'], overlay: '{weather}' },
    knowledgeProgress: { fur_clothes: 2 },
    steps: { late: [{ kind: 'narrate', narrative: 'tan_month', effects: [{ type: 'goods', id: 'hide', delta: -4 }] }] },
  },
  {
    // 갈대호수 찾아가기 (P6): 만난 뒤에는 직접 찾아가 바꾼다
    id: 'reed_lake_visit',
    slot: 'growth',
    category: 'trade',
    appearsWhen: [{ type: 'flag', id: 'reed_lake_met' }, warm, { type: 'goods', id: 'hide', min: 3 }],
    priority: 33,
    cooldown: 3,
    crew: { min: 3, max: 4, keepHome: 8 },
    place: 'reed_lake',
    scene: { bg: '{place}', subjects: ['sub.strangers', 'sub.reeds'], overlay: '{weather}' },
    steps: {
      early: [{ kind: 'narrate', narrative: 'lake_walk' }],
      mid: [{ kind: 'eventWindow', pool: ['reed_lake_trade'], chance: 1 }],
      late: [{ kind: 'carry' }],
    },
  },
  {
    // 숲의 사슴: 여름·가을에 북쪽 숲 (가까워 여러 번 나른다)
    id: 'forest_hunt',
    slot: 'food',
    category: 'hunt',
    appearsWhen: [{ type: 'season', in: ['summer', 'autumn'] }, { type: 'animal', id: 'red_deer', state: ['scattered'] }],
    priority: 36,
    cooldown: 1,
    crew: { min: 4, max: 6, keepHome: 8, prefer: 'hunt' },
    place: 'north_forest',
    leader: { seat: 'hunt_leader', ailing: false },
    scene: { bg: '{place}', subjects: ['sub.deer', 'sub.hunters'], overlay: '{weather}' },
    knowledgeProgress: { meat_drying: 1 },
    steps: {
      early: [
        {
          kind: 'activity',
          activity: {
            power: huntPower(0.45),
            difficulty: 6.1,
            outcomes: {
              triumph: { narrative: 'deer_good', effects: [{ type: 'catch', animal: 'red_deer', count: [3, 4] }] },
              success: { narrative: 'deer_good', effects: [{ type: 'catch', animal: 'red_deer', count: [2, 3] }] },
              costly: { narrative: 'deer_good', effects: [{ type: 'catch', animal: 'red_deer', count: [1, 2] }] },
              failure: { narrative: 'deer_bad', effects: [{ type: 'catch', animal: 'red_deer', count: [0, 1] }] },
              disaster: { narrative: 'deer_bad', effects: [] },
            },
            costs: huntCosts,
          },
        },
      ],
      late: [{ kind: 'carry' }],
    },
  },

  // ───────────── 가을 ─────────────
  {
    // 열매와 견과 (오래 가는 겨울 식량)
    id: 'nut_gather',
    slot: 'food',
    category: 'gather',
    appearsWhen: [{ type: 'monthOfYear', in: ['fruit', 'reindeer'] }],
    // 9~10월에는 늘 후보에 든다 (③a)
    priority: 50,
    cooldown: 0,
    firewoodShare: 0.1,
    monthMods: [
      { stat: 'yield.nuts', op: 'mul', value: 1.8 },
      { stat: 'yield.gather', op: 'mul', value: 1.2 },
    ],
    scene: { bg: '{camp}', subjects: ['sub.berries', 'sub.gatherers'], overlay: '{weather}' },
    steps: { early: [{ kind: 'narrate', narrative: 'nut_month' }] },
  },
  {
    // 순록 떼 대사냥 (C1). 기록 1달
    id: 'reindeer_big_hunt',
    slot: 'major',
    category: 'hunt',
    appearsWhen: [{ type: 'animal', id: 'reindeer', state: ['migrating'] }, { type: 'season', in: ['autumn'] }],
    relevance: [{ when: [{ type: 'foodDays', max: 25 }], add: 20 }],
    priority: 60,
    cooldown: 1,
    crew: { min: 8, max: 14, keepHome: 4, prefer: 'hunt' },
    place: 'reindeer_ford',
    leader: { seat: 'hunt_leader' },
    scene: { bg: '{place}', subjects: ['sub.reindeer_run', 'sub.hunters', 'sub.reeds'], overlay: '{weather}' },
    knowledgeProgress: { meat_drying: 1, sled: 1 },
    steps: {
      early: [
        {
          kind: 'activity',
          activity: {
            power: huntPower(0.25),
            difficulty: 4,
            outcomes: {
              triumph: { narrative: 'ambush_good', effects: [{ type: 'catch', animal: 'reindeer', count: [4, 5] }] },
              success: { narrative: 'ambush_good', effects: [{ type: 'catch', animal: 'reindeer', count: [2, 3] }] },
              costly: { narrative: 'ambush_good', effects: [{ type: 'catch', animal: 'reindeer', count: [2, 3] }] },
              failure: { narrative: 'ambush_bad', effects: [{ type: 'catch', animal: 'reindeer', count: [0, 1] }] },
              disaster: { narrative: 'ambush_bad', effects: [] },
            },
            costs: huntCosts,
          },
        },
      ],
      mid: [{ kind: 'eventWindow', pool: ['herd_vs_wolves'], chance: 0.8 }],
      late: [
        {
          kind: 'activity',
          when: notCalledOff,
          activity: {
            power: huntPower(0.25),
            difficulty: 6.5,
            outcomes: {
              triumph: { narrative: 'herd_good', effects: [{ type: 'catch', animal: 'reindeer', count: [15, 18] }, { type: 'cohesion', delta: 5 }] },
              success: { narrative: 'herd_good', effects: [{ type: 'catch', animal: 'reindeer', count: [11, 14] }, { type: 'cohesion', delta: 3 }] },
              costly: { narrative: 'herd_costly', effects: [{ type: 'catch', animal: 'reindeer', count: [10, 13] }] },
              failure: { narrative: 'herd_bad', effects: [{ type: 'catch', animal: 'reindeer', count: [3, 6] }] },
              disaster: { narrative: 'herd_bad', effects: [{ type: 'catch', animal: 'reindeer', count: [0, 2] }] },
            },
            costs: huntCosts,
          },
        },
        { kind: 'narrate', narrative: 'hunt_called_off', when: calledOff },
        { kind: 'carry' },
      ],
    },
  },
  {
    // 소규모 사냥 + 겨울 준비 (시안의 방침): 사냥꾼 6명이 낙오자를 노리고 나머지는 장작
    id: 'small_hunt_prep',
    slot: 'food',
    category: 'hunt',
    appearsWhen: [{ type: 'animal', id: 'reindeer', state: ['migrating'] }, { type: 'season', in: ['autumn'] }],
    priority: 40,
    cooldown: 1,
    crew: { min: 4, max: 6, keepHome: 6, prefer: 'hunt' },
    place: 'east_steppe',
    firewoodShare: 0.6,
    scene: { bg: 'bg.steppe', subjects: ['sub.reindeer_herd', 'sub.hunters'], overlay: '{weather}' },
    steps: {
      early: [
        {
          kind: 'activity',
          activity: {
            power: huntPower(0.4),
            difficulty: 5.7,
            outcomes: {
              triumph: { narrative: 'stragglers', effects: [{ type: 'catch', animal: 'reindeer', count: [5, 6] }] },
              success: { narrative: 'stragglers', effects: [{ type: 'catch', animal: 'reindeer', count: [3, 4] }] },
              costly: { narrative: 'stragglers', effects: [{ type: 'catch', animal: 'reindeer', count: [2, 3] }] },
              failure: { narrative: 'spring_herd_bad', effects: [{ type: 'catch', animal: 'reindeer', count: [0, 1] }] },
              disaster: { narrative: 'spring_herd_bad', effects: [] },
            },
            costs: huntCosts,
          },
        },
      ],
      late: [{ kind: 'carry' }],
    },
  },
  {
    // 끌개 엮기 (P7): 장인이 끌개를 엮는다 → 운반 한계가 오른다
    id: 'make_sled',
    prep: 'winter',
    slot: 'growth',
    category: 'craft',
    appearsWhen: [artisanReady, { type: 'knowledge', id: 'sled', has: false }, { type: 'season', in: ['summer', 'autumn', 'winter'] }],
    relevance: [{ when: [{ type: 'flag', id: 'ikki_idea_sled' }], add: 20 }],
    priority: 26,
    cooldown: 1,
    leader: { seat: 'artisan', ailing: false },
    monthMods: [{ stat: 'yield.gather', op: 'mul', value: 0.9 }],
    scene: { bg: '{camp}', subjects: ['sub.gatherers', 'sub.firewood'], overlay: '{weather}' },
    steps: {
      late: [
        {
          kind: 'activity',
          activity: {
            power: craftPower,
            difficulty: 2.6,
            outcomes: {
              triumph: { narrative: 'sled_made', effects: [{ type: 'knowledge', id: 'sled', grant: true }] },
              success: { narrative: 'sled_made', effects: [{ type: 'knowledge', id: 'sled', grant: true }] },
              costly: { narrative: 'sled_made', effects: [{ type: 'knowledge', id: 'sled', grant: true }, { type: 'goods', id: 'hide', delta: -2 }] },
              failure: { narrative: 'craft_failed', effects: [{ type: 'knowledge', id: 'sled', progress: 1 }] },
              disaster: { narrative: 'craft_failed', effects: [{ type: 'goods', id: 'hide', delta: -2 }] },
            },
          },
        },
      ],
    },
  },
  {
    // 얼음 낚시 도구 (P8): 뼈 작살과 얼음 깨는 돌망치 → 겨울 식량원
    id: 'ice_tools',
    prep: 'winter',
    slot: 'growth',
    category: 'craft',
    appearsWhen: [artisanReady, { type: 'knowledge', id: 'ice_fishing', has: false }, { type: 'season', in: ['autumn', 'winter'] }],
    relevance: [
      { when: [{ type: 'flag', id: 'ikki_idea_harpoon' }], add: 20 },
      { when: [{ type: 'season', in: ['winter'] }], add: 10 },
    ],
    priority: 26,
    cooldown: 1,
    leader: { seat: 'artisan', ailing: false },
    monthMods: [{ stat: 'yield.gather', op: 'mul', value: 0.9 }],
    scene: { bg: 'bg.river_ford', subjects: ['sub.ice_hole', 'sub.gatherers'], overlay: '{weather}' },
    steps: {
      late: [
        {
          kind: 'activity',
          activity: {
            power: craftPower,
            difficulty: 2.8,
            outcomes: {
              triumph: { narrative: 'ice_tools_made', effects: [{ type: 'knowledge', id: 'ice_fishing', grant: true }] },
              success: { narrative: 'ice_tools_made', effects: [{ type: 'knowledge', id: 'ice_fishing', grant: true }] },
              costly: { narrative: 'ice_tools_made', effects: [{ type: 'knowledge', id: 'ice_fishing', grant: true }, { type: 'goods', id: 'knife', delta: -2 }] },
              failure: { narrative: 'craft_failed', effects: [{ type: 'knowledge', id: 'ice_fishing', progress: 1 }] },
              disaster: { narrative: 'craft_failed', effects: [{ type: 'goods', id: 'knife', delta: -2 }] },
            },
          },
        },
      ],
    },
  },
  {
    id: 'winter_prep',
    prep: 'winter',
    slot: 'growth',
    category: 'firewood',
    appearsWhen: [{ type: 'season', in: ['autumn', 'winter'] }],
    relevance: [{ when: [{ type: 'firewoodDays', max: 10 }], add: 40 }],
    priority: 25,
    cooldown: 0,
    firewoodShare: 0.75,
    monthMods: [{ stat: 'yield.wood', op: 'mul', value: 1.2 }],
    scene: { bg: '{camp}', subjects: ['sub.firewood'], overlay: '{weather}' },
    knowledgeProgress: { fur_clothes: 1 },
    steps: { early: [{ kind: 'narrate', narrative: 'prep_month' }] },
  },

  // ───────────── 겨울 ─────────────
  {
    // 묻어 둔 고기 회수 (C1, S9): 묻은 곳마다 후보가 하나씩
    id: 'recover_cache',
    slot: 'food',
    category: 'food',
    appearsWhen: [{ type: 'cache' }],
    relevance: [{ when: [{ type: 'foodDays', max: 10 }], add: 30 }],
    priority: 40,
    cooldown: 0,
    bindCache: true,
    crew: { min: 3, max: 5, keepHome: 4, prefer: 'hunt' },
    scene: { bg: '{place}', subjects: ['sub.hunters'], overlay: '{weather}' },
    steps: {
      early: [
        {
          kind: 'activity',
          activity: {
            power: [
              { src: 'crew', weight: 0.5 },
              { src: 'when', when: [{ type: 'animal', id: 'wolves', at: '$place' }], value: -2 },
            ],
            difficulty: 1,
            hidden: [{ id: 'cache_state', knownWhen: [{ type: 'cache', at: '$place', known: true }] }],
            outcomes: {
              triumph: { narrative: 'cache_found', effects: [{ type: 'cache', at: '$place', action: 'recover' }] },
              success: { narrative: 'cache_found', effects: [{ type: 'cache', at: '$place', action: 'recover' }] },
              costly: { narrative: 'cache_found', effects: [{ type: 'cache', at: '$place', action: 'recover' }] },
              failure: { narrative: 'cache_gone', effects: [{ type: 'cache', at: '$place', action: 'check' }] },
              disaster: { narrative: 'cache_gone', effects: [{ type: 'cache', at: '$place', action: 'check' }] },
            },
            costs: [{ weight: 1, effects: [{ type: 'injure', who: { crew: 'random' }, ailment: 'claw', severity: 2 }] }],
          },
        },
        { kind: 'carry' },
      ],
    },
  },
  {
    // 얼음 구멍 낚시와 장작: 얼음 낚시를 모르면 조금, 알면 겨울 식량원 (P8)
    id: 'ice_hole_fishing',
    slot: 'food',
    category: 'gather',
    appearsWhen: [{ type: 'season', in: ['winter'] }],
    relevance: [{ when: [{ type: 'knowledge', id: 'ice_fishing' }], add: 20 }],
    priority: 30,
    cooldown: 0,
    firewoodShare: 0.45,
    monthMods: [{ stat: 'yield.fish', op: 'add', value: 0.5 }],
    scene: { bg: 'bg.river_ford', subjects: ['sub.ice_hole', 'sub.gatherers'], overlay: '{weather}' },
    steps: { early: [{ kind: 'narrate', narrative: 'ice_hole_month' }] },
  },
  {
    // 올가미 (기록 3~4달): 같은 자리를 쓰면 토끼가 준다 (강가의 'snare' 재고)
    id: 'snare_hunt',
    slot: 'food',
    category: 'trap',
    appearsWhen: [{ type: 'season', in: ['autumn', 'winter'] }, { type: 'person', match: { skill: { id: 'craft', min: 1 }, ailing: false } }],
    relevance: [{ when: [{ type: 'season', in: ['winter'] }], add: 15 }],
    priority: 32,
    cooldown: 0,
    firewoodShare: 0.25,
    monthMods: [
      { stat: 'yield.snare', op: 'add', value: 1 },
      { stat: 'yield.gather', op: 'mul', value: 0.7 },
    ],
    scene: { bg: 'bg.north_forest', subjects: ['sub.gatherers'], overlay: '{weather}' },
    steps: { early: [{ kind: 'narrate', narrative: 'snare_month' }] },
  },
  {
    // 눈 위의 사슴 사냥 (C6): 서리의 옛이야기가 사슴이 어디로 내려오는지 알려 준다
    id: 'deer_hunt_snow',
    slot: 'food',
    category: 'hunt',
    appearsWhen: [{ type: 'season', in: ['winter'] }],
    relevance: [
      { when: [{ type: 'animal', id: 'red_deer', state: ['river_crossing'] }], add: 30 },
      { when: [{ type: 'clue', id: 'deer_cross_river' }], add: 15 },
    ],
    priority: 36,
    cooldown: 1,
    crew: { min: 4, max: 7, keepHome: 6, prefer: 'hunt' },
    place: 'north_forest',
    leader: { seat: 'hunt_leader' },
    scene: { bg: '{place}', subjects: ['sub.deer', 'sub.hunters'], overlay: '{weather}' },
    steps: {
      early: [
        {
          kind: 'activity',
          activity: {
            power: [
              ...huntPower(0.35),
              { src: 'when', when: [{ type: 'animal', id: 'red_deer', state: ['river_crossing'] }], value: 1.5 },
            ],
            difficulty: 4.6,
            hidden: [
              {
                id: 'deer_whereabouts',
                knownWhen: [{ type: 'any', of: [{ type: 'animal', id: 'red_deer', state: ['river_crossing'] }, { type: 'clue', id: 'deer_cross_river' }] }],
              },
            ],
            outcomes: {
              triumph: { narrative: 'deer_snow_good', effects: [{ type: 'catch', animal: 'red_deer', count: [3, 4] }] },
              success: { narrative: 'deer_snow_good', effects: [{ type: 'catch', animal: 'red_deer', count: [2, 3] }] },
              costly: { narrative: 'deer_snow_good', effects: [{ type: 'catch', animal: 'red_deer', count: [1, 2] }] },
              failure: { narrative: 'deer_bad', effects: [{ type: 'catch', animal: 'red_deer', count: [0, 1] }] },
              disaster: { narrative: 'deer_bad', effects: [] },
            },
            costs: winterHuntCosts,
          },
        },
      ],
      mid: [{ kind: 'eventWindow', pool: ['blizzard_deer'], chance: 0.7 }],
      late: [
        {
          kind: 'activity',
          when: notCalledOff,
          activity: {
            power: [
              ...huntPower(0.35),
              { src: 'when', when: [{ type: 'animal', id: 'red_deer', state: ['river_crossing'] }], value: 1.5 },
            ],
            difficulty: 5.4,
            outcomes: {
              triumph: { narrative: 'deer_drive_good', effects: [{ type: 'catch', animal: 'red_deer', count: [7, 9] }, { type: 'cohesion', delta: 5 }] },
              success: { narrative: 'deer_drive_good', effects: [{ type: 'catch', animal: 'red_deer', count: [4, 6] }, { type: 'cohesion', delta: 3 }] },
              costly: { narrative: 'deer_drive_good', effects: [{ type: 'catch', animal: 'red_deer', count: [4, 6] }] },
              failure: { narrative: 'deer_bad', effects: [{ type: 'catch', animal: 'red_deer', count: [0, 2] }] },
              disaster: { narrative: 'deer_bad', effects: [] },
            },
            costs: winterHuntCosts,
          },
        },
        { kind: 'narrate', narrative: 'hunt_called_off', when: calledOff },
        { kind: 'carry' },
      ],
    },
  },
  {
    // 아픈 사람 간호 (C5): 노을이 돌본다. 버드나무 껍질이 있으면 확실하다
    id: 'nurse_sick',
    prep: 'winter',
    slot: 'growth',
    category: 'care',
    appearsWhen: [healerReady, { type: 'person', match: { ailing: true } }],
    relevance: [{ when: [{ type: 'person', match: { seat: 'elder', ailing: true } }], add: 20 }],
    priority: 29,
    cooldown: 0,
    monthMods: [{ stat: 'yield.gather', op: 'mul', value: 0.8 }],
    scene: { bg: '{camp}', subjects: ['sub.fire_circle', 'sub.elder_telling'], overlay: '{weather}' },
    steps: {
      late: [
        {
          kind: 'narrate',
          narrative: 'nurse_month',
          effects: [
            {
              type: 'if',
              when: [{ type: 'goods', id: 'willow_bark', min: 1 }],
              then: [
                { type: 'goods', id: 'willow_bark', delta: -1 },
                { type: 'heal', who: { anyone: { ailing: true }, pick: 'weakest' } },
                { type: 'line', key: 'line.willow_healed' },
              ],
              else: [
                {
                  type: 'random',
                  outcomes: [
                    { weight: 2, effects: [{ type: 'heal', who: { anyone: { ailing: true }, pick: 'weakest' } }] },
                    { weight: 1, effects: [{ type: 'line', key: 'line.nurse_no_change' }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'hold_and_ration',
    slot: 'food',
    category: 'hold',
    // 식량이 10일치 미만일 때만 (③a). 식량 후보가 하나도 없으면 그래도 들어간다
    appearsWhen: [{ type: 'foodDays', max: 9.99 }],
    priority: 10,
    cooldown: 0,
    fallback: true,
    firewoodShare: 0.3,
    monthMods: [{ stat: 'ration.cap', op: 'mul', value: 0.75 }],
    scene: { bg: '{camp}', subjects: ['sub.fire_circle'], overlay: '{weather}' },
    steps: { early: [{ kind: 'narrate', narrative: 'hold_month', effects: [{ type: 'cohesion', delta: -2 }] }] },
  },
];
