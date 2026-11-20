// 1장 방침 (M1: 엔진 경로를 모두 지나는 시험용 5개. M2에서 기록의 방침 20개로 확충한다)

import type { CostEntry, PolicyTemplate, PowerTerm } from '../../../engine';

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

const calledOff = [{ type: 'flag' as const, id: 'hunt_called_off', sinceMonths: { max: 0 } }];

export const ch1Policies: PolicyTemplate[] = [
  {
    id: 'reindeer_big_hunt',
    category: 'hunt',
    appearsWhen: [{ type: 'animal', id: 'reindeer', state: ['migrating'] }],
    relevance: [{ when: [{ type: 'foodDays', max: 25 }], add: 20 }],
    priority: 60,
    cooldown: 1,
    crew: { min: 8, max: 14, keepHome: 4, prefer: 'hunt' },
    place: 'reindeer_ford',
    leader: { seat: 'hunt_leader' },
    scene: { bg: '{place}', subjects: ['sub.reindeer_run', 'sub.hunters', 'sub.reeds'], overlay: '{weather}' },
    knowledgeProgress: { meat_drying: 1 },
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
          when: [{ type: 'not', of: { type: 'all', of: calledOff } }],
          activity: {
            power: huntPower(0.25),
            difficulty: 6.5,
            outcomes: {
              triumph: { narrative: 'herd_good', effects: [{ type: 'catch', animal: 'reindeer', count: [15, 18] }] },
              success: { narrative: 'herd_good', effects: [{ type: 'catch', animal: 'reindeer', count: [11, 14] }] },
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
    id: 'river_gather',
    category: 'gather',
    appearsWhen: [{ type: 'season', in: ['spring', 'summer', 'autumn'] }],
    priority: 30,
    cooldown: 0,
    firewoodShare: 0.1,
    monthMods: [
      { stat: 'yield.gather', op: 'mul', value: 1.6 },
      { stat: 'yield.fish', op: 'mul', value: 1.6 },
    ],
    scene: { bg: '{camp}', subjects: ['sub.gatherers'], overlay: '{weather}' },
    steps: { early: [{ kind: 'narrate', narrative: 'gather_month' }] },
  },
  {
    id: 'winter_prep',
    category: 'firewood',
    appearsWhen: [],
    relevance: [{ when: [{ type: 'firewoodDays', max: 10 }], add: 40 }],
    priority: 25,
    cooldown: 0,
    firewoodShare: 0.75,
    monthMods: [{ stat: 'yield.wood', op: 'mul', value: 1.2 }],
    scene: { bg: '{camp}', subjects: ['sub.firewood'], overlay: '{weather}' },
    knowledgeProgress: { fur_clothes: 1 },
    steps: { early: [{ kind: 'narrate', narrative: 'prep_month' }] },
  },
  {
    id: 'hold_and_ration',
    category: 'hold',
    appearsWhen: [],
    priority: 10,
    cooldown: 0,
    fallback: true,
    firewoodShare: 0.3,
    monthMods: [{ stat: 'ration.cap', op: 'mul', value: 0.75 }],
    scene: { bg: '{camp}', subjects: ['sub.fire_circle'], overlay: '{weather}' },
    steps: { early: [{ kind: 'narrate', narrative: 'hold_month', effects: [{ type: 'cohesion', delta: -2 }] }] },
  },
  {
    id: 'recover_cache',
    category: 'food',
    appearsWhen: [{ type: 'cache', at: 'reindeer_ford' }],
    relevance: [{ when: [{ type: 'foodDays', max: 10 }], add: 30 }],
    priority: 40,
    cooldown: 0,
    crew: { min: 3, max: 5, keepHome: 4, prefer: 'hunt' },
    place: 'reindeer_ford',
    scene: { bg: '{place}', subjects: ['sub.hunters'], overlay: '{weather}' },
    steps: {
      early: [
        {
          kind: 'activity',
          activity: {
            power: [
              { src: 'crew', weight: 0.5 },
              { src: 'when', when: [{ type: 'animal', id: 'wolves', at: 'reindeer_ford' }], value: -2 },
            ],
            difficulty: 1,
            hidden: [{ id: 'cache_state', knownWhen: [{ type: 'cache', at: 'reindeer_ford', known: true }] }],
            outcomes: {
              triumph: { narrative: 'cache_found', effects: [{ type: 'cache', at: 'reindeer_ford', action: 'recover' }] },
              success: { narrative: 'cache_found', effects: [{ type: 'cache', at: 'reindeer_ford', action: 'recover' }] },
              costly: { narrative: 'cache_found', effects: [{ type: 'cache', at: 'reindeer_ford', action: 'recover' }] },
              failure: { narrative: 'cache_gone', effects: [{ type: 'cache', at: 'reindeer_ford', action: 'check' }] },
              disaster: { narrative: 'cache_gone', effects: [{ type: 'cache', at: 'reindeer_ford', action: 'check' }] },
            },
            costs: [{ weight: 1, effects: [{ type: 'injure', who: { crew: 'random' }, ailment: 'claw', severity: 2 }] }],
          },
        },
        { kind: 'carry' },
      ],
    },
  },
];
