// 1장 사건 (레인즈식 중간 사건, 월초 사건). 봄 시작 첫 해 (DESIGN.md §18.1).
// 연결 지도 C1~C7(시험 플레이)과 준비 → 겨울 연결 P1~P10을 사건의 조건과 효과로 잇는다.

import type { ActivityDef, Condition, Effect, EventDef } from '../../../engine';

const winter: Condition = { type: 'season', in: ['winter'] };
const notWinter: Condition = { type: 'season', in: ['spring', 'summer', 'autumn'] };
const elderAlive: Condition = { type: 'person', match: { seat: 'elder' } };

/** 갈대호수 사람들과의 약속: 가을에 다시 온다 (P6) */
const promiseAutumn: Effect = { type: 'schedule', event: 'reed_lake_autumn', after: 2, window: 6, when: [{ type: 'season', in: ['autumn'] }] };
/** 처음 만났다는 기록 (만난 뒤에는 겨울의 낯선 사람들(C4) 대신 아는 이웃으로 온다) */
const met: Effect[] = [
  { type: 'flag', id: 'reed_lake_met', set: true },
  { type: 'place', id: 'reed_lake', discovered: true },
  { type: 'counter', id: 'reed_lake_relation', delta: 1 },
];

/** 곰 사냥 판정 (굴의 잠든 곰, 돌아온 곰). 노을이 곰의 잠을 읽으면 숨은 변수가 풀린다 (기록 2달) */
function bearHunt(difficulty: number, extraWin: Effect[]): ActivityDef {
  const win: Effect[] = [
    { type: 'catch', animal: 'bear', count: 1 },
    { type: 'flag', id: 'bear_killed', set: true },
    { type: 'animal', id: 'bear', state: 'active', at: null, known: true },
    { type: 'clue', id: 'bear_sinew', months: 4 },
    ...extraWin,
  ];
  return {
    power: [
      { src: 'crew', weight: 0.35, skill: 'hunt', skillWeight: 0.3 },
      { src: 'goods', id: 'spear', perCrew: true, weight: 1 },
      { src: 'stat', id: 'hunt.bonus', weight: 1 },
      { src: 'const', value: 1 },
    ],
    difficulty,
    hidden: [
      {
        id: 'bear_depth',
        knownWhen: [{ type: 'any', of: [{ type: 'person', match: { seat: 'healer' } }, { type: 'clue', id: 'bear_den_lore' }] }],
      },
    ],
    outcomes: {
      triumph: { narrative: 'bear_down', effects: [...win, { type: 'chronicle', key: 'chron.bear_clean', importance: 55 }] },
      success: { narrative: 'bear_down', effects: [...win, { type: 'chronicle', key: 'chron.bear_clean', importance: 55 }] },
      costly: { narrative: 'bear_down_costly', effects: [...win, { type: 'chronicle', key: 'chron.bear_cost', importance: 70 }] },
      failure: { narrative: 'bear_escaped', effects: [{ type: 'animal', id: 'bear', state: 'active', at: 'north_forest' }] },
      disaster: { narrative: 'bear_escaped', effects: [{ type: 'animal', id: 'bear', state: 'active', at: 'north_forest' }] },
    },
    costs: [
      { weight: 3, effects: [{ type: 'death', who: { crew: 'front' }, cause: 'bear' }] },
      { weight: 3, effects: [{ type: 'injure', who: 'leader', ailment: 'claw', severity: 2 }] },
      { weight: 2, effects: [{ type: 'injure', who: { crew: 'random' }, ailment: 'fracture', severity: 2 }] },
    ],
  };
}

export const ch1Events: EventDef[] = [
  // ───────────── 봄 ─────────────
  {
    // 3월: 강 얼음이 깨진다. 높은 곳으로 옮겨 두면 8월 큰물에 덜 잃는다
    id: 'ice_breakup',
    scope: 'village',
    slots: ['mid'],
    when: [{ type: 'monthOfYear', in: ['thaw'] }],
    weight: 12,
    cooldown: 0,
    once: true,
    scene: { bg: 'bg.camp_tents', subjects: ['sub.flood'], overlay: '{weather}' },
    speakers: [{ who: { seat: 'elder' }, line: 'event.ice_breakup.say.elder' }],
    options: [
      {
        id: 'move_high',
        hint: 'sure',
        effects: [
          { type: 'flag', id: 'camp_high', set: true },
          { type: 'modifier', mod: { stat: 'yield.gather', op: 'mul', value: 0.7 }, months: 1 },
          { type: 'line', key: 'event.ice_breakup.res.move_high' },
        ],
      },
      {
        id: 'watch',
        hint: 'fair',
        effects: [
          {
            type: 'random',
            outcomes: [
              { weight: 2, effects: [{ type: 'line', key: 'event.ice_breakup.res.held' }] },
              { weight: 1, effects: [{ type: 'food', kind: 'roots', kg: [-40, -20] }, { type: 'line', key: 'event.ice_breakup.res.wet' }] },
            ],
          },
        ],
      },
      {
        id: 'ignore',
        hint: 'risky',
        effects: [
          {
            type: 'random',
            outcomes: [
              { weight: 1, effects: [{ type: 'line', key: 'event.ice_breakup.res.held' }] },
              {
                weight: 1,
                effects: [
                  { type: 'food', kind: 'roots', kg: [-60, -30] },
                  { type: 'firewood', kg: [-40, -20] },
                  { type: 'cohesion', delta: -2 },
                  { type: 'line', key: 'event.ice_breakup.res.flooded' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    // 봄: 굶주린 곰이 깨어났다 (곰을 여기서 잡으면 겨울 굴에는 곰이 없다)
    id: 'hungry_bear',
    scope: 'village',
    slots: ['mid'],
    when: [{ type: 'monthOfYear', in: ['thaw', 'sprout'] }, { type: 'animal', id: 'bear', state: ['active'] }],
    weight: 6,
    cooldown: 0,
    once: true,
    scene: { bg: 'bg.camp_tents', subjects: ['sub.bear'], overlay: 'ov.dusk' },
    speakers: [
      { who: { seat: 'hunt_leader' }, line: 'event.hungry_bear.say.bawi' },
      { who: { seat: 'healer' }, line: 'event.hungry_bear.say.noeul' },
    ],
    options: [
      {
        id: 'fires',
        hint: 'sure',
        effects: [{ type: 'firewood', kg: -40 }, { type: 'line', key: 'event.hungry_bear.res.fires' }],
      },
      {
        id: 'hang_food',
        hint: 'fair',
        effects: [
          { type: 'modifier', mod: { stat: 'yield.gather', op: 'mul', value: 0.85 }, months: 1 },
          {
            type: 'random',
            outcomes: [
              { weight: 3, effects: [{ type: 'line', key: 'event.hungry_bear.res.hung' }] },
              { weight: 1, effects: [{ type: 'food', kind: 'dried_meat', kg: [-30, -10] }, { type: 'line', key: 'event.hungry_bear.res.raided' }] },
            ],
          },
        ],
      },
      {
        id: 'hunt',
        requires: [{ type: 'person', match: { seat: 'hunt_leader', ailing: false } }],
        effects: [],
        activity: {
          power: [{ src: 'const', value: 2 }, { src: 'goods', id: 'spear', weight: 0.15, cap: 14 }],
          difficulty: 5,
          outcomes: {
            triumph: { narrative: 'spring_bear_down', effects: [{ type: 'catch', animal: 'bear', count: 1 }, { type: 'flag', id: 'bear_killed', set: true }] },
            success: { narrative: 'spring_bear_down', effects: [{ type: 'catch', animal: 'bear', count: 1 }, { type: 'flag', id: 'bear_killed', set: true }] },
            costly: {
              narrative: 'spring_bear_down',
              effects: [
                { type: 'catch', animal: 'bear', count: 1 },
                { type: 'flag', id: 'bear_killed', set: true },
                { type: 'injure', who: { anyone: { seat: 'hunt_leader' }, pick: 'random' }, ailment: 'claw', severity: 2 },
              ],
            },
            failure: {
              narrative: 'spring_bear_fled',
              effects: [{ type: 'injure', who: { anyone: { band: ['adult'], ailing: false }, pick: 'random' }, ailment: 'claw', severity: 2 }],
            },
            disaster: {
              narrative: 'spring_bear_fled',
              effects: [{ type: 'death', who: { anyone: { band: ['adult'], ailing: false, isChief: false }, pick: 'random' }, cause: 'bear' }],
            },
          },
        },
      },
    ],
  },
  {
    // 봄 물고기 떼: 너무 많이 잡혀 말릴 손이 모자란다 (P1: 말리기를 시도하는 계기)
    id: 'fish_glut',
    scope: 'policy',
    slots: ['mid'],
    when: [{ type: 'food', kinds: ['fish'], min: 80 }],
    weight: 10,
    cooldown: 1,
    scene: { bg: 'bg.river_ford', subjects: ['sub.fish_run', 'sub.meat_rack'] },
    speakers: [
      { who: { seat: 'artisan' }, line: 'event.fish_glut.say.ikki' },
      { who: { seat: 'healer' }, line: 'event.fish_glut.say.noeul' },
    ],
    options: [
      {
        id: 'smoke_racks',
        hint: 'sure',
        effects: [
          { type: 'firewood', kg: -50 },
          { type: 'preserve', from: ['fish'], to: 'dried_fish', maxKg: 150, yield: 0.6 },
          { type: 'knowledge', id: 'meat_drying', progress: 1 },
          { type: 'line', key: 'event.fish_glut.res.smoke', params: { kg: '$preserved' } },
        ],
      },
      {
        id: 'feast',
        hint: 'sure',
        effects: [{ type: 'food', kind: 'fish', kg: [-70, -50] }, { type: 'cohesion', delta: 5 }, { type: 'line', key: 'event.fish_glut.res.feast' }],
      },
      {
        id: 'more_weirs',
        hint: 'fair',
        effects: [
          { type: 'modifier', mod: { stat: 'yield.fish_run', op: 'mul', value: 1.3 }, months: 1 },
          { type: 'modifier', mod: { stat: 'spoil.mul', op: 'mul', value: 1.3 }, months: 1 },
          { type: 'line', key: 'event.fish_glut.res.more' },
        ],
      },
    ],
  },
  {
    // 늪지 너머의 첫 만남 (P6): 교역, 말리는 법, 가을의 약속
    id: 'reed_lake_first_meeting',
    scope: 'policy',
    slots: ['mid'],
    when: [{ type: 'flag', id: 'reed_lake_seen' }, { type: 'flag', id: 'reed_lake_met', present: false }],
    weight: 10,
    cooldown: 0,
    once: true,
    scene: { bg: 'bg.reed_lake', subjects: ['sub.strangers', 'sub.reeds'] },
    speakers: [{ who: 'leader', line: 'event.reed_lake_first_meeting.say.leader' }],
    options: [
      {
        id: 'trade_hides',
        hint: 'sure',
        requires: [{ type: 'goods', id: 'hide', min: 3 }],
        effects: [
          { type: 'goods', id: 'hide', delta: -3 },
          { type: 'food', kind: 'dried_fish', kg: 70, haul: true },
          ...met,
          promiseAutumn,
          { type: 'chronicle', key: 'chron.reed_lake_met', importance: 50 },
        ],
      },
      {
        id: 'learn',
        hint: 'sure',
        requires: [{ type: 'goods', id: 'hide', min: 2 }],
        effects: [
          { type: 'goods', id: 'hide', delta: -2 },
          { type: 'knowledge', id: 'meat_drying', progress: 2 },
          ...met,
          promiseAutumn,
          { type: 'chronicle', key: 'chron.reed_lake_learned', importance: 50 },
        ],
      },
      {
        id: 'gift',
        hint: 'fair',
        effects: [
          { type: 'food', kind: 'dried_meat', kg: -20 },
          ...met,
          { type: 'counter', id: 'reed_lake_relation', delta: 1 },
          promiseAutumn,
          { type: 'goods', id: 'willow_bark', delta: 1 },
          { type: 'chronicle', key: 'chron.reed_lake_met', importance: 50 },
        ],
      },
      {
        id: 'withdraw',
        hint: 'unknown',
        effects: [{ type: 'cohesion', delta: -1 }, { type: 'line', key: 'event.reed_lake_first_meeting.res.withdraw' }],
      },
    ],
  },
  {
    // 갈대호수 찾아가기 (P6): 직접 가서 바꾼다. 말린 물고기는 가벼워 많이 메고 온다
    id: 'reed_lake_trade',
    scope: 'policy',
    slots: ['mid'],
    when: [{ type: 'flag', id: 'reed_lake_met' }],
    weight: 10,
    cooldown: 0,
    scene: { bg: 'bg.reed_lake', subjects: ['sub.strangers', 'sub.meat_rack'] },
    speakers: [{ who: 'leader', line: 'event.reed_lake_trade.say.leader' }],
    options: [
      {
        id: 'hides_for_fish',
        hint: 'sure',
        requires: [{ type: 'goods', id: 'hide', min: 3 }],
        effects: [{ type: 'goods', id: 'hide', delta: -3 }, { type: 'food', kind: 'dried_fish', kg: 90, haul: true }, { type: 'counter', id: 'reed_lake_relation', delta: 1 }],
      },
      {
        id: 'learn_drying',
        hint: 'sure',
        requires: [{ type: 'knowledge', id: 'meat_drying', has: false }],
        effects: [{ type: 'goods', id: 'hide', delta: -1 }, { type: 'knowledge', id: 'meat_drying', progress: 2 }, { type: 'line', key: 'event.reed_lake_trade.res.learn' }],
      },
      {
        id: 'ask_bark',
        hint: 'sure',
        effects: [{ type: 'goods', id: 'hide', delta: -1 }, { type: 'goods', id: 'willow_bark', delta: 2 }],
      },
    ],
  },
  {
    // 알달: 철새 알
    id: 'bird_eggs',
    scope: 'village',
    slots: ['mid'],
    when: [{ type: 'monthOfYear', in: ['egg'] }],
    weight: 10,
    cooldown: 10,
    scene: { bg: 'bg.marsh', subjects: ['sub.birds', 'sub.gatherers'] },
    speakers: [{ who: { seat: 'healer' }, line: 'event.bird_eggs.say.noeul' }],
    options: [
      {
        id: 'children_go',
        hint: 'fair',
        effects: [
          { type: 'food', kind: 'roots', kg: [50, 80] },
          {
            type: 'random',
            outcomes: [
              { weight: 4, effects: [{ type: 'line', key: 'event.bird_eggs.res.fine' }] },
              { weight: 1, effects: [{ type: 'injure', who: { anyone: { band: ['child'] }, pick: 'random' }, ailment: 'fracture', severity: 1 }] },
            ],
          },
        ],
      },
      {
        id: 'adults_go',
        hint: 'sure',
        effects: [{ type: 'food', kind: 'roots', kg: [70, 100] }, { type: 'modifier', mod: { stat: 'yield.wood', op: 'mul', value: 0.6 }, months: 1 }],
      },
      {
        id: 'leave_nests',
        hint: 'sure',
        effects: [{ type: 'cohesion', delta: -1 }, { type: 'line', key: 'event.bird_eggs.res.leave' }],
      },
    ],
  },
  {
    // 녹는달 둘째 해: 겨울의 약속 (C7). 겨울에 처음 만났으면 봄에 돌아온다
    id: 'reed_lake_return',
    scope: 'scheduled',
    slots: ['briefing'],
    when: [],
    weight: 1,
    cooldown: 0,
    once: true,
    scene: { bg: 'bg.river_ford', subjects: ['sub.strangers'] },
    options: [
      {
        id: 'trade',
        hint: 'sure',
        requires: [{ type: 'goods', id: 'hide', min: 5 }],
        effects: [{ type: 'goods', id: 'hide', delta: -5 }, { type: 'food', kind: 'dried_fish', kg: 100 }, { type: 'flag', id: 'reed_lake_met', set: true }],
      },
      {
        id: 'learn',
        hint: 'sure',
        effects: [{ type: 'goods', id: 'hide', delta: -2 }, { type: 'knowledge', id: 'meat_drying', progress: 2 }, { type: 'flag', id: 'reed_lake_met', set: true }],
      },
    ],
  },

  // ───────────── 여름 ─────────────
  {
    // 여름의 빈 굴 (C3의 여름판, P3): 곰은 숲을 돌고 굴은 비었다
    id: 'empty_cave_claws',
    scope: 'policy',
    slots: ['mid'],
    when: [notWinter, { type: 'place', id: 'north_cave', fact: 'claw_marks' }, { type: 'not', of: { type: 'animal', id: 'bear', state: ['denning'], at: 'north_cave' } }],
    weight: 10,
    cooldown: 0,
    once: true,
    scene: { bg: 'bg.cave_mouth', subjects: ['sub.claw_marks', 'sub.hunters'] },
    speakers: [
      { who: { seat: 'artisan' }, line: 'event.empty_cave_claws.say.ikki' },
      { who: { seat: 'hunt_leader' }, line: 'event.empty_cave_claws.say.bawi' },
    ],
    options: [
      {
        id: 'claim_now',
        hint: 'fair',
        effects: [
          { type: 'shelter', kind: 'rock_cave', place: 'north_cave', units: 1 },
          {
            type: 'if',
            when: [{ type: 'flag', id: 'bear_killed', present: false }],
            then: [{ type: 'schedule', event: 'bear_returns', after: 1, window: 12, when: [{ type: 'monthOfYear', in: ['frost'] }] }],
          },
          { type: 'modifier', mod: { stat: 'yield.gather', op: 'mul', value: 0.7 }, months: 1 },
          { type: 'chronicle', key: 'chron.moved_cave', importance: 45 },
        ],
      },
      {
        id: 'mark_it',
        hint: 'sure',
        effects: [{ type: 'flag', id: 'cave_marked', set: true }, { type: 'cohesion', delta: -1 }, { type: 'line', key: 'event.empty_cave_claws.res.mark' }],
      },
      {
        id: 'block_den',
        hint: 'fair',
        effects: [
          { type: 'modifier', mod: { stat: 'yield.wood', op: 'mul', value: 0.7 }, months: 1 },
          { type: 'flag', id: 'den_blocked', set: true },
          { type: 'animal', id: 'bear', known: true },
          { type: 'line', key: 'event.empty_cave_claws.res.block' },
        ],
      },
    ],
  },
  {
    // 여름 늑대 굴 (P10)
    id: 'wolf_den_pups',
    scope: 'village',
    slots: ['mid'],
    when: [{ type: 'season', in: ['summer'] }],
    weight: 6,
    cooldown: 0,
    once: true,
    scene: { bg: 'bg.north_forest', subjects: ['sub.wolves'] },
    speakers: [
      { who: { seat: 'hunt_leader' }, line: 'event.wolf_den_pups.say.bawi' },
      { who: { seat: 'elder' }, line: 'event.wolf_den_pups.say.seori' },
    ],
    options: [
      {
        id: 'kill_pups',
        hint: 'fair',
        effects: [
          { type: 'flag', id: 'wolf_pups_killed', set: true },
          { type: 'animal', id: 'wolves', vars: { pack: -2 } },
          {
            type: 'random',
            outcomes: [
              { weight: 2, effects: [{ type: 'line', key: 'event.wolf_den_pups.res.killed' }] },
              { weight: 1, effects: [{ type: 'injure', who: { anyone: { band: ['adult'], ailing: false, isChief: false }, pick: 'random' }, ailment: 'claw', severity: 1 }] },
            ],
          },
        ],
      },
      {
        id: 'leave',
        hint: 'sure',
        effects: [{ type: 'flag', id: 'wolf_pups_spared', set: true }, { type: 'animal', id: 'wolves', vars: { pack: 1 } }, { type: 'cohesion', delta: 1 }, { type: 'line', key: 'event.wolf_den_pups.res.left' }, { type: 'modifier', mod: { stat: 'cache.raid', op: 'mul', value: 1.5 }, months: 9 }],
      },
    ],
  },
  {
    // 여름 더위: 날것이 상한다 (P1: 말리기의 가치)
    id: 'meat_spoiling',
    scope: 'village',
    slots: ['mid'],
    when: [{ type: 'season', in: ['summer'] }, { type: 'food', kinds: ['raw_meat', 'fish', 'roots'], min: 250 }],
    weight: 8,
    cooldown: 2,
    scene: { bg: 'bg.camp_tents', subjects: ['sub.meat_rack', 'sub.gatherers'] },
    speakers: [{ who: { seat: 'healer' }, line: 'event.meat_spoiling.say.noeul' }],
    options: [
      {
        id: 'dry_now',
        hint: 'sure',
        effects: [
          { type: 'modifier', mod: { stat: 'yield.gather', op: 'mul', value: 0.7 }, months: 1 },
          { type: 'preserve', from: ['fish', 'raw_meat'], to: 'dried_fish', maxKg: 140, yield: 0.6 },
          { type: 'knowledge', id: 'meat_drying', progress: 1 },
          { type: 'line', key: 'event.meat_spoiling.res.dry', params: { kg: '$preserved' } },
        ],
      },
      {
        id: 'feast',
        hint: 'sure',
        effects: [{ type: 'food', kind: 'roots', kg: [-90, -60] }, { type: 'cohesion', delta: 4 }, { type: 'line', key: 'event.meat_spoiling.res.feast' }],
      },
      {
        id: 'smoke',
        hint: 'sure',
        effects: [
          { type: 'firewood', kg: -60 },
          { type: 'preserve', from: ['raw_meat', 'fish'], to: 'dried_meat', maxKg: 100, yield: 0.7 },
          { type: 'line', key: 'event.meat_spoiling.res.smoke', params: { kg: '$preserved' } },
        ],
      },
    ],
  },
  {
    // 천둥달 큰물: 봄에 높은 곳으로 옮겨 두었으면 덜 잃는다 (대응 가능한 무작위)
    id: 'thunder_flood',
    scope: 'village',
    slots: ['mid'],
    when: [{ type: 'monthOfYear', in: ['thunder'] }, { type: 'shelter', in: ['tent'] }],
    weight: 10,
    cooldown: 0,
    once: true,
    scene: { bg: 'bg.camp_tents', subjects: ['sub.flood'], overlay: 'ov.rain' },
    speakers: [{ who: { seat: 'elder' }, line: 'event.thunder_flood.say.seori' }],
    options: [
      {
        id: 'carry_up',
        hint: 'sure',
        effects: [
          { type: 'modifier', mod: { stat: 'yield.gather', op: 'mul', value: 0.6 }, months: 1 },
          {
            type: 'if',
            when: [{ type: 'flag', id: 'camp_high' }],
            then: [{ type: 'line', key: 'event.thunder_flood.res.high' }],
            else: [{ type: 'food', kind: 'roots', kg: [-50, -30] }, { type: 'firewood', kg: [-80, -40] }, { type: 'line', key: 'event.thunder_flood.res.saved' }],
          },
        ],
      },
      {
        id: 'ride_it',
        hint: 'risky',
        effects: [
          {
            type: 'if',
            when: [{ type: 'flag', id: 'camp_high' }],
            then: [{ type: 'firewood', kg: [-40, -20] }, { type: 'line', key: 'event.thunder_flood.res.high' }],
            else: [
              { type: 'food', kind: 'roots', kg: [-150, -80] },
              { type: 'firewood', kg: [-250, -120] },
              { type: 'goods', id: 'hide', delta: -2 },
              { type: 'cohesion', delta: -3 },
              { type: 'line', key: 'event.thunder_flood.res.lost' },
            ],
          },
        ],
      },
    ],
  },
  {
    // 여름밤의 옛이야기 (P9, C6): 어떤 이야기를 듣느냐가 겨울의 단서가 된다
    id: 'seori_summer_story',
    scope: 'village',
    slots: ['mid'],
    when: [{ type: 'season', in: ['summer'] }, elderAlive],
    weight: 9,
    cooldown: 0,
    once: true,
    scene: { bg: 'bg.camp_tents', subjects: ['sub.elder_telling', 'sub.fire_circle'], overlay: 'ov.night' },
    speakers: [{ who: { seat: 'elder' }, line: 'event.seori_summer_story.say.seori' }],
    options: [
      {
        id: 'deer',
        hint: 'sure',
        effects: [{ type: 'firewood', kg: -10 }, { type: 'clue', id: 'deer_cross_river', months: 10 }, { type: 'line', key: 'event.seori_summer_story.res.deer' }],
      },
      {
        id: 'bear',
        hint: 'sure',
        effects: [{ type: 'firewood', kg: -10 }, { type: 'clue', id: 'bear_den_lore' }, { type: 'line', key: 'event.seori_summer_story.res.bear' }],
      },
      {
        id: 'old_winters',
        hint: 'sure',
        effects: [{ type: 'firewood', kg: -10 }, { type: 'cohesion', delta: 4 }, { type: 'knowledge', id: 'fur_clothes', progress: 1 }, { type: 'line', key: 'event.seori_summer_story.res.winters' }],
      },
    ],
  },
  {
    // 가뭄: 물이 줄어 물고기가 웅덩이에 모인다. 마른 풀에 불이 붙기 쉽다
    id: 'drought_pools',
    scope: 'village',
    slots: ['mid'],
    when: [{ type: 'weather', in: ['drought'], at: 'outlook' }],
    weight: 8,
    cooldown: 6,
    scene: { bg: 'bg.river_ford', subjects: ['sub.gatherers'] },
    speakers: [{ who: { seat: 'healer' }, line: 'event.drought_pools.say.noeul' }],
    options: [
      {
        id: 'catch_pools',
        hint: 'fair',
        effects: [
          { type: 'food', kind: 'fish', kg: [80, 140] },
          {
            type: 'random',
            outcomes: [
              { weight: 3, effects: [{ type: 'line', key: 'event.drought_pools.res.catch' }] },
              { weight: 1, effects: [{ type: 'firewood', kg: [-120, -60] }, { type: 'line', key: 'event.drought_pools.res.fire' }] },
            ],
          },
        ],
      },
      {
        id: 'fire_watch',
        hint: 'sure',
        effects: [{ type: 'modifier', mod: { stat: 'yield.gather', op: 'mul', value: 0.8 }, months: 1 }, { type: 'line', key: 'event.drought_pools.res.watch' }],
      },
    ],
  },

  // ───────────── 가을 ─────────────
  {
    // 기록 1달 중순: "두 소식이 한꺼번에" (C1, C2)
    id: 'herd_vs_wolves',
    scope: 'policy',
    slots: ['mid'],
    when: [{ type: 'animal', id: 'wolves', state: ['near_camp'] }],
    weight: 10,
    cooldown: 6,
    scene: { bg: 'bg.steppe', subjects: ['sub.messenger', 'sub.wolves'], overlay: 'ov.dusk' },
    speakers: [{ who: 'leader', line: 'event.herd_vs_wolves.say.leader' }],
    options: [
      {
        id: 'stay_all',
        hint: 'risky',
        effects: [
          { type: 'modifier', mod: { stat: 'hunt.bonus', op: 'add', value: 1 }, months: 1 },
          {
            type: 'random',
            outcomes: [
              { weight: 1, effects: [{ type: 'food', kind: 'raw_meat', kg: [-50, -20] }, { type: 'line', key: 'line.wolves_took' }] },
              { weight: 1, effects: [{ type: 'line', key: 'line.wolves_circled' }] },
            ],
          },
          { type: 'cohesion', delta: -3 },
        ],
      },
      {
        id: 'send_back',
        hint: 'fair',
        requires: [{ type: 'actor', slot: 'leader' }],
        effects: [
          { type: 'modifier', mod: { stat: 'hunt.bonus', op: 'add', value: -1 }, months: 1 },
          { type: 'animal', id: 'wolves', state: 'roaming', at: null },
          { type: 'line', key: 'event.herd_vs_wolves.res.send_back' },
        ],
      },
      {
        id: 'keep_fires',
        hint: 'fair',
        effects: [
          { type: 'firewood', kg: -80 },
          { type: 'modifier', mod: { stat: 'yield.gather', op: 'mul', value: 0.5 }, months: 1 },
          { type: 'animal', id: 'wolves', state: 'roaming', at: null },
          { type: 'line', key: 'event.herd_vs_wolves.res.keep_fires' },
        ],
      },
      {
        id: 'call_off',
        hint: 'sure',
        effects: [
          { type: 'flag', id: 'hunt_called_off', set: true },
          { type: 'animal', id: 'wolves', state: 'roaming', at: null },
        ],
      },
    ],
  },
  {
    id: 'wolves_circle_camp',
    scope: 'village',
    slots: ['mid'],
    when: [{ type: 'animal', id: 'wolves', state: ['near_camp'] }],
    weight: 10,
    cooldown: 3,
    scene: { bg: 'bg.camp_tents', subjects: ['sub.wolf_eyes'], overlay: 'ov.night' },
    options: [
      {
        id: 'fires',
        hint: 'sure',
        effects: [
          { type: 'firewood', kg: -60 },
          { type: 'animal', id: 'wolves', state: 'roaming', at: null },
          { type: 'line', key: 'event.wolves_circle_camp.res.fires' },
        ],
      },
      {
        id: 'watch',
        hint: 'sure',
        effects: [
          { type: 'modifier', mod: { stat: 'yield.gather', op: 'mul', value: 0.6 }, months: 1 },
          { type: 'line', key: 'event.wolves_circle_camp.res.watch' },
        ],
      },
      {
        id: 'ignore',
        hint: 'risky',
        effects: [
          {
            type: 'random',
            outcomes: [
              { weight: 1, effects: [{ type: 'food', kind: 'raw_meat', kg: [-60, -20] }, { type: 'line', key: 'line.wolves_took' }] },
              { weight: 1, effects: [{ type: 'cohesion', delta: -4 }, { type: 'line', key: 'line.wolves_circled' }] },
            ],
          },
        ],
      },
    ],
  },
  {
    // 가을: 이끼의 제안 (P7, P8). 끌개냐 뼈 작살이냐
    id: 'ikki_proposal',
    scope: 'village',
    slots: ['mid'],
    when: [{ type: 'monthOfYear', in: ['fruit', 'reindeer'] }, { type: 'person', match: { seat: 'artisan' } }],
    weight: 9,
    cooldown: 0,
    once: true,
    scene: { bg: 'bg.camp_tents', subjects: ['sub.firewood', 'sub.fire_circle'] },
    speakers: [
      { who: { seat: 'artisan' }, line: 'event.ikki_proposal.say.ikki' },
      { who: { seat: 'hunt_leader' }, line: 'event.ikki_proposal.say.bawi' },
    ],
    options: [
      {
        id: 'sled',
        hint: 'sure',
        effects: [{ type: 'goods', id: 'hide', delta: -1 }, { type: 'knowledge', id: 'sled', progress: 1 }, { type: 'flag', id: 'ikki_idea_sled', set: true }],
      },
      {
        id: 'harpoon',
        hint: 'sure',
        effects: [
          { type: 'modifier', mod: { stat: 'yield.gather', op: 'mul', value: 0.9 }, months: 1 },
          { type: 'knowledge', id: 'ice_fishing', progress: 1 },
          { type: 'flag', id: 'ikki_idea_harpoon', set: true },
        ],
      },
      {
        id: 'later',
        hint: 'sure',
        effects: [{ type: 'cohesion', delta: -1 }, { type: 'line', key: 'event.ikki_proposal.res.later' }],
      },
    ],
  },
  {
    // 갈대호수의 가을 사절 (P6): 약속을 지켰다. 겨울에 다시 오겠다고 한다
    id: 'reed_lake_autumn',
    scope: 'scheduled',
    slots: ['briefing'],
    when: [],
    weight: 1,
    cooldown: 0,
    once: true,
    scene: { bg: 'bg.camp_tents', subjects: ['sub.strangers'] },
    options: [
      {
        id: 'trade_big',
        hint: 'sure',
        requires: [{ type: 'goods', id: 'hide', min: 6 }],
        effects: [
          { type: 'goods', id: 'hide', delta: -6 },
          { type: 'food', kind: 'dried_fish', kg: 160 },
          { type: 'goods', id: 'willow_bark', delta: 1 },
          { type: 'counter', id: 'reed_lake_relation', delta: 1 },
          { type: 'schedule', event: 'reed_lake_winter_visit', after: 2, window: 3, when: [winter] },
          { type: 'chronicle', key: 'chron.reed_lake_autumn', importance: 40 },
        ],
      },
      {
        id: 'trade_small',
        hint: 'sure',
        requires: [{ type: 'goods', id: 'hide', min: 3 }],
        effects: [
          { type: 'goods', id: 'hide', delta: -3 },
          { type: 'food', kind: 'dried_fish', kg: 70 },
          { type: 'schedule', event: 'reed_lake_winter_visit', after: 2, window: 3, when: [winter] },
        ],
      },
      {
        id: 'meat_for_fish',
        hint: 'sure',
        requires: [{ type: 'food', kinds: ['raw_meat', 'dried_meat'], min: 100 }],
        effects: [{ type: 'food', kind: 'raw_meat', kg: -100 }, { type: 'food', kind: 'dried_fish', kg: 80 }, { type: 'counter', id: 'reed_lake_relation', delta: 1 }],
      },
      {
        id: 'decline',
        hint: 'sure',
        effects: [{ type: 'counter', id: 'reed_lake_relation', delta: -1 }, { type: 'cohesion', delta: -1 }],
      },
    ],
  },
  {
    // 서리달, 굴의 주인이 돌아왔다 (P3): 미리 굴로 옮긴 부족에게
    id: 'bear_returns',
    scope: 'scheduled',
    slots: ['briefing'],
    when: [{ type: 'shelter', in: ['rock_cave'] }, { type: 'flag', id: 'bear_killed', present: false }],
    weight: 1,
    cooldown: 0,
    once: true,
    scene: { bg: 'bg.cave_mouth', subjects: ['sub.bear', 'sub.fire_circle'], overlay: 'ov.snow' },
    speakers: [
      { who: { seat: 'hunt_leader' }, line: 'event.bear_returns.say.bawi' },
      { who: { seat: 'elder' }, line: 'event.bear_returns.say.seori' },
    ],
    options: [
      {
        id: 'fire_drive',
        hint: 'fair',
        effects: [
          { type: 'firewood', kg: -90 },
          {
            type: 'random',
            outcomes: [
              { weight: 3, effects: [{ type: 'animal', id: 'bear', state: 'denning', at: 'north_forest' }, { type: 'line', key: 'event.bear_returns.res.driven' }] },
              {
                weight: 1,
                effects: [
                  { type: 'animal', id: 'bear', state: 'denning', at: 'north_forest' },
                  { type: 'injure', who: { anyone: { band: ['adult'], ailing: false, isChief: false }, pick: 'random' }, ailment: 'claw', severity: 2 },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'spear_it',
        requires: [{ type: 'person', match: { seat: 'hunt_leader', ailing: false } }],
        effects: [],
        activity: {
          power: [{ src: 'const', value: 2.5 }, { src: 'goods', id: 'spear', weight: 0.15, cap: 14 }, { src: 'stat', id: 'hunt.bonus', weight: 1 }],
          difficulty: 5,
          outcomes: {
            triumph: { narrative: 'bear_down', effects: [{ type: 'catch', animal: 'bear', count: 1 }, { type: 'flag', id: 'bear_killed', set: true }, { type: 'clue', id: 'bear_sinew', months: 4 }] },
            success: { narrative: 'bear_down', effects: [{ type: 'catch', animal: 'bear', count: 1 }, { type: 'flag', id: 'bear_killed', set: true }, { type: 'clue', id: 'bear_sinew', months: 4 }] },
            costly: {
              narrative: 'bear_down_costly',
              effects: [
                { type: 'catch', animal: 'bear', count: 1 },
                { type: 'flag', id: 'bear_killed', set: true },
                { type: 'clue', id: 'bear_sinew', months: 4 },
                { type: 'death', who: { anyone: { band: ['adult'], ailing: false, isChief: false }, pick: 'random' }, cause: 'bear' },
              ],
            },
            failure: { narrative: 'bear_escaped', effects: [{ type: 'injure', who: { anyone: { seat: 'hunt_leader' }, pick: 'random' }, ailment: 'claw', severity: 2 }, { type: 'animal', id: 'bear', state: 'denning', at: 'north_forest' }] },
            disaster: {
              narrative: 'bear_escaped',
              effects: [
                { type: 'death', who: { anyone: { band: ['adult'], ailing: false, isChief: false }, pick: 'random' }, cause: 'bear' },
                { type: 'injure', who: { anyone: { seat: 'hunt_leader' }, pick: 'random' }, ailment: 'claw', severity: 2 },
                { type: 'animal', id: 'bear', state: 'denning', at: 'north_forest' },
              ],
            },
          },
        },
      },
      {
        id: 'give_up',
        hint: 'sure',
        effects: [{ type: 'shelter', kind: 'tent', place: 'river_bend', units: 5 }, { type: 'cohesion', delta: -3 }, { type: 'line', key: 'event.bear_returns.res.gave_up' }],
      },
    ],
  },

  // ───────────── 겨울 ─────────────
  {
    // 기록 2달: 마지막 고기 자루 (C3). 굴을 찾았는데 곰이 잠들어 있다
    id: 'cave_bear_last_sack',
    scope: 'policy',
    slots: ['mid'],
    when: [{ type: 'animal', id: 'bear', state: ['denning'], at: 'north_cave' }, { type: 'place', id: 'north_cave', fact: 'claw_marks' }],
    weight: 10,
    cooldown: 0,
    once: true,
    scene: { bg: 'bg.cave_mouth', subjects: ['sub.bear_sleeping', 'sub.claw_marks'], overlay: '{weather}' },
    speakers: [
      { who: { seat: 'elder' }, line: 'event.cave_bear_last_sack.say.seori' },
      { who: { seat: 'hunt_leader' }, line: 'event.cave_bear_last_sack.say.bawi' },
      { who: { seat: 'healer' }, line: 'event.cave_bear_last_sack.say.noeul' },
    ],
    options: [
      {
        id: 'hunt_bear',
        effects: [],
        activity: bearHunt(4.2, [
          { type: 'shelter', kind: 'rock_cave', place: 'north_cave', units: 1 },
          { type: 'line', key: 'event.cave_bear_last_sack.res.moved' },
        ]),
      },
      {
        id: 'use_mouth',
        hint: 'fair',
        effects: [
          { type: 'shelter', kind: 'rock_cave', place: 'north_cave', units: 1 },
          { type: 'modifier', mod: { stat: 'firewood.burnMul', op: 'mul', value: 1.3 }, months: 3 },
          { type: 'schedule', event: 'bear_wakes', after: 1, window: 6, when: [{ type: 'monthOfYear', in: ['thaw'] }] },
          { type: 'line', key: 'event.cave_bear_last_sack.res.mouth' },
        ],
      },
      {
        id: 'go_cache',
        requires: [{ type: 'cache' }],
        hint: 'unknown',
        effects: [
          {
            type: 'random',
            outcomes: [
              { weight: 1, effects: [{ type: 'cache', at: 'reindeer_ford', action: 'recover' }, { type: 'line', key: 'event.cave_bear_last_sack.res.cache' }] },
              { weight: 1, effects: [{ type: 'cache', at: 'reindeer_ford', action: 'check' }, { type: 'injure', who: { crew: 'random' }, ailment: 'frostbite', severity: 1 }] },
            ],
          },
        ],
      },
      {
        id: 'ration',
        hint: 'sure',
        effects: [{ type: 'modifier', mod: { stat: 'ration.cap', op: 'mul', value: 0.75 }, months: 1 }, { type: 'cohesion', delta: -2 }],
      },
    ],
  },
  {
    // 굴 입구만 썼다면: 녹는달에 곰이 깬다
    id: 'bear_wakes',
    scope: 'scheduled',
    slots: ['briefing'],
    when: [{ type: 'flag', id: 'bear_killed', present: false }],
    weight: 1,
    cooldown: 0,
    once: true,
    scene: { bg: 'bg.cave_inside', subjects: ['sub.bear'], overlay: 'ov.dusk' },
    speakers: [{ who: { seat: 'hunt_leader' }, line: 'event.bear_wakes.say.bawi' }],
    options: [
      {
        id: 'flee_cave',
        hint: 'sure',
        effects: [{ type: 'shelter', kind: 'tent', place: 'river_bend', units: 5 }, { type: 'goods', id: 'hide', delta: -2 }, { type: 'animal', id: 'bear', state: 'active', at: 'north_forest' }],
      },
      {
        id: 'spear_wake',
        effects: [],
        activity: {
          power: [{ src: 'const', value: 2 }, { src: 'goods', id: 'spear', weight: 0.15, cap: 14 }],
          difficulty: 5.5,
          outcomes: {
            triumph: { narrative: 'bear_down', effects: [{ type: 'catch', animal: 'bear', count: 1 }, { type: 'flag', id: 'bear_killed', set: true }] },
            success: { narrative: 'bear_down', effects: [{ type: 'catch', animal: 'bear', count: 1 }, { type: 'flag', id: 'bear_killed', set: true }] },
            costly: {
              narrative: 'bear_down_costly',
              effects: [
                { type: 'catch', animal: 'bear', count: 1 },
                { type: 'flag', id: 'bear_killed', set: true },
                { type: 'injure', who: { anyone: { band: ['adult'], ailing: false }, pick: 'random' }, ailment: 'claw', severity: 3 },
              ],
            },
            failure: { narrative: 'bear_escaped', effects: [{ type: 'injure', who: { anyone: { band: ['adult'], ailing: false }, pick: 'random' }, ailment: 'claw', severity: 2 }, { type: 'animal', id: 'bear', state: 'active', at: 'north_forest' }] },
            disaster: { narrative: 'bear_escaped', effects: [{ type: 'death', who: { anyone: { band: ['adult'], ailing: false, isChief: false }, pick: 'random' }, cause: 'bear' }, { type: 'animal', id: 'bear', state: 'active', at: 'north_forest' }] },
          },
        },
      },
    ],
  },
  {
    // 기록 3달 중순: "낯선 사람들" (C4, C7). 봄·여름에 만나지 못했을 때
    id: 'strangers_smoke',
    scope: 'village',
    slots: ['mid'],
    when: [winter, { type: 'flag', id: 'reed_lake_met', present: false }],
    weight: 6,
    cooldown: 0,
    once: true,
    scene: { bg: 'bg.camp_tents', subjects: ['sub.strangers'], overlay: 'ov.snow' },
    speakers: [
      { who: { seat: 'hunt_leader' }, line: 'event.strangers_smoke.say.bawi' },
      { who: { seat: 'artisan' }, line: 'event.strangers_smoke.say.ikki' },
    ],
    options: [
      {
        id: 'trade_hides',
        hint: 'sure',
        requires: [{ type: 'goods', id: 'hide', min: 10 }],
        effects: [
          { type: 'goods', id: 'hide', delta: -10 },
          { type: 'food', kind: 'dried_fish', kg: 150 },
          { type: 'if', when: [{ type: 'person', match: { ailing: true } }], then: [{ type: 'goods', id: 'willow_bark', delta: 1 }, { type: 'line', key: 'event.strangers_smoke.res.willow' }] },
          { type: 'schedule', event: 'reed_lake_return', after: 1, window: 6, when: [{ type: 'season', in: ['spring'] }] },
          ...met,
          { type: 'chronicle', key: 'chron.strangers_trade', importance: 40 },
        ],
      },
      {
        id: 'bear_hide',
        hint: 'fair',
        requires: [{ type: 'goods', id: 'bear_hide', min: 1 }],
        effects: [
          { type: 'goods', id: 'bear_hide', delta: -1 },
          { type: 'food', kind: 'dried_fish', kg: 220 },
          { type: 'goods', id: 'willow_bark', delta: 1 },
          { type: 'cohesion', delta: -3 },
          { type: 'counter', id: 'reed_lake_relation', delta: 1 },
          { type: 'schedule', event: 'reed_lake_return', after: 1, window: 6, when: [{ type: 'season', in: ['spring'] }] },
          ...met,
          { type: 'line', key: 'event.strangers_smoke.res.bear_hide' },
          { type: 'chronicle', key: 'chron.strangers_trade', importance: 40 },
        ],
      },
      {
        id: 'decline',
        hint: 'unknown',
        effects: [{ type: 'flag', id: 'turned_away_reed_lake', set: true }, { type: 'cohesion', delta: -1 }],
      },
      {
        id: 'rob',
        hint: 'risky',
        effects: [
          { type: 'food', kind: 'dried_fish', kg: 300 },
          { type: 'flag', id: 'reed_lake_grudge', set: true },
          { type: 'cohesion', delta: -4 },
          {
            type: 'random',
            outcomes: [
              { weight: 1, effects: [{ type: 'line', key: 'event.strangers_smoke.res.rob' }] },
              { weight: 1, effects: [{ type: 'injure', who: { anyone: { band: ['adult'], ailing: false, isChief: false }, pick: 'random' }, ailment: 'claw', severity: 2 }] },
            ],
          },
          { type: 'chronicle', key: 'chron.strangers_robbed', importance: 60 },
        ],
      },
    ],
  },
  {
    // 겨울에 찾아오는 아는 이웃 (P6이 겨울로 돌아온다)
    id: 'reed_lake_winter_visit',
    scope: 'scheduled',
    slots: ['briefing'],
    when: [],
    weight: 1,
    cooldown: 0,
    once: true,
    scene: { bg: 'bg.camp_tents', subjects: ['sub.strangers', 'sub.fire_circle'], overlay: 'ov.snow' },
    options: [
      {
        id: 'trade',
        hint: 'sure',
        requires: [{ type: 'goods', id: 'hide', min: 4 }],
        effects: [
          { type: 'goods', id: 'hide', delta: -4 },
          { type: 'food', kind: 'dried_fish', kg: 120 },
          { type: 'schedule', event: 'reed_lake_return', after: 1, window: 6, when: [{ type: 'season', in: ['spring'] }] },
        ],
      },
      {
        id: 'ask_bark',
        hint: 'sure',
        requires: [{ type: 'goods', id: 'hide', min: 1 }],
        effects: [
          { type: 'goods', id: 'hide', delta: -1 },
          { type: 'goods', id: 'willow_bark', delta: 2 },
          { type: 'schedule', event: 'reed_lake_return', after: 1, window: 6, when: [{ type: 'season', in: ['spring'] }] },
        ],
      },
      {
        id: 'share_fire',
        hint: 'sure',
        effects: [{ type: 'firewood', kg: -40 }, { type: 'food', kind: 'dried_fish', kg: 50 }, { type: 'counter', id: 'reed_lake_relation', delta: 1 }],
      },
    ],
  },
  {
    // 기록 3달: 노인의 기침 (C5). 버드나무 껍질이 있으면 낫는다
    id: 'elder_cough',
    scope: 'village',
    slots: ['mid'],
    when: [winter, { type: 'person', match: { band: ['elder'], ailing: true } }],
    weight: 9,
    cooldown: 2,
    scene: { bg: '{camp}', subjects: ['sub.elder_telling', 'sub.fire_circle'], overlay: 'ov.night' },
    speakers: [
      { who: { seat: 'healer' }, line: 'event.elder_cough.say.noeul' },
      { who: { seat: 'elder' }, line: 'event.elder_cough.say.seori' },
    ],
    options: [
      {
        id: 'willow_tea',
        hint: 'sure',
        requires: [{ type: 'goods', id: 'willow_bark', min: 1 }],
        effects: [{ type: 'goods', id: 'willow_bark', delta: -1 }, { type: 'heal', who: { anyone: { band: ['elder'], ailing: true }, pick: 'weakest' } }, { type: 'line', key: 'line.willow_healed' }],
      },
      {
        id: 'warm_corner',
        hint: 'fair',
        effects: [
          { type: 'firewood', kg: -40 },
          {
            type: 'random',
            outcomes: [
              { weight: 1, effects: [{ type: 'heal', who: { anyone: { band: ['elder'], ailing: true }, pick: 'weakest' } }] },
              { weight: 1, effects: [{ type: 'line', key: 'line.nurse_no_change' }] },
            ],
          },
        ],
      },
      {
        id: 'children_first',
        hint: 'risky',
        effects: [{ type: 'cohesion', delta: -2 }, { type: 'line', key: 'event.elder_cough.res.children' }, { type: 'modifier', mod: { stat: 'ration.cap', op: 'mul', value: 0.95 }, months: 1 }],
      },
    ],
  },
  {
    // 기록 4달 중순: 눈보라 (C6 뒤)
    id: 'blizzard_deer',
    scope: 'policy',
    slots: ['mid'],
    when: [winter],
    weight: 10,
    cooldown: 0,
    scene: { bg: 'bg.river_ford', subjects: ['sub.deer', 'sub.hunters'], overlay: 'ov.blizzard' },
    speakers: [{ who: 'leader', line: 'event.blizzard_deer.say.leader' }],
    options: [
      {
        id: 'snow_cave',
        hint: 'fair',
        effects: [
          { type: 'modifier', mod: { stat: 'hunt.bonus', op: 'add', value: 0.5 }, months: 1 },
          {
            type: 'random',
            outcomes: [
              { weight: 3, effects: [{ type: 'line', key: 'event.blizzard_deer.res.wait' }] },
              { weight: 1, effects: [{ type: 'injure', who: { crew: 'weakest' }, ailment: 'frostbite', severity: 1 }] },
            ],
          },
        ],
      },
      {
        id: 'hunt_storm',
        hint: 'risky',
        effects: [
          { type: 'modifier', mod: { stat: 'hunt.bonus', op: 'add', value: 1.5 }, months: 1 },
          {
            type: 'if',
            when: [{ type: 'knowledge', id: 'fur_clothes' }],
            then: [{ type: 'injure', who: { crew: 'weakest' }, ailment: 'frostbite', severity: 1 }],
            else: [
              { type: 'injure', who: { crew: 'weakest' }, ailment: 'frostbite', severity: 2 },
              { type: 'injure', who: { crew: 'random' }, ailment: 'frostbite', severity: 1 },
            ],
          },
          { type: 'line', key: 'event.blizzard_deer.res.storm' },
        ],
      },
      {
        id: 'go_home',
        hint: 'sure',
        effects: [{ type: 'flag', id: 'hunt_called_off', set: true }],
      },
    ],
  },
  {
    // 올가미 자리가 빈다 (고갈)
    id: 'snares_empty',
    scope: 'village',
    slots: ['mid'],
    when: [{ type: 'policy', id: 'snare_hunt' }, { type: 'placeStock', id: 'river_bend', yield: 'snare', max: 200 }],
    weight: 12,
    cooldown: 2,
    scene: { bg: 'bg.north_forest', subjects: ['sub.gatherers'], overlay: 'ov.snow' },
    speakers: [{ who: { seat: 'artisan' }, line: 'event.snares_empty.say.ikki' }],
    options: [
      {
        id: 'move_line',
        hint: 'sure',
        effects: [
          { type: 'place', id: 'river_bend', stock: { yield: 'snare', delta: 150 } },
          { type: 'modifier', mod: { stat: 'yield.wood', op: 'mul', value: 0.7 }, months: 1 },
          { type: 'line', key: 'event.snares_empty.res.moved' },
        ],
      },
      {
        id: 'keep',
        hint: 'sure',
        effects: [{ type: 'cohesion', delta: -1 }, { type: 'line', key: 'event.snares_empty.res.keep' }],
      },
    ],
  },
  {
    // 장작이 바닥난 밤 (C2)
    id: 'firewood_night',
    scope: 'village',
    slots: ['mid'],
    when: [winter, { type: 'firewoodDays', max: 3 }],
    weight: 14,
    cooldown: 1,
    scene: { bg: '{camp}', subjects: ['sub.fire_circle'], overlay: 'ov.night' },
    speakers: [
      { who: { seat: 'elder' }, line: 'event.firewood_night.say.seori' },
      { who: { seat: 'hunt_leader' }, line: 'event.firewood_night.say.bawi' },
    ],
    options: [
      {
        id: 'burn_hides',
        hint: 'sure',
        requires: [{ type: 'goods', id: 'hide', min: 3 }],
        effects: [{ type: 'goods', id: 'hide', delta: -3 }, { type: 'firewood', kg: 60 }, { type: 'line', key: 'event.firewood_night.res.hides' }],
      },
      {
        id: 'huddle',
        hint: 'fair',
        effects: [
          { type: 'cohesion', delta: -2 },
          {
            type: 'random',
            outcomes: [
              { weight: 2, effects: [{ type: 'line', key: 'event.firewood_night.res.huddle' }] },
              { weight: 1, effects: [{ type: 'injure', who: { anyone: { band: ['elder', 'child'], ailing: false }, pick: 'weakest' }, ailment: 'cough', severity: 2 }] },
            ],
          },
        ],
      },
      {
        id: 'dark_run',
        hint: 'risky',
        effects: [
          { type: 'firewood', kg: [70, 110] },
          {
            type: 'random',
            outcomes: [
              { weight: 2, effects: [{ type: 'line', key: 'event.firewood_night.res.run' }] },
              { weight: 1, effects: [{ type: 'injure', who: { anyone: { band: ['adult'], ailing: false, isChief: false }, pick: 'random' }, ailment: 'frostbite', severity: 2 }] },
            ],
          },
        ],
      },
    ],
  },
  {
    // 늑대가 묻은 고기 쪽으로 간다 (C1). 여름에 새끼를 죽였다면 원한이 더 깊다 (P10)
    id: 'wolves_at_cache',
    scope: 'village',
    slots: ['mid'],
    when: [{ type: 'cache' }, { type: 'season', in: ['autumn', 'winter'] }],
    weight: 7,
    cooldown: 3,
    scene: { bg: 'bg.river_ford', subjects: ['sub.wolves'], overlay: 'ov.dusk' },
    speakers: [{ who: { seat: 'hunt_leader' }, line: 'event.wolves_at_cache.say.bawi' }],
    options: [
      {
        id: 'guard',
        hint: 'fair',
        effects: [
          { type: 'modifier', mod: { stat: 'yield.gather', op: 'mul', value: 0.7 }, months: 1 },
          { type: 'modifier', mod: { stat: 'cache.raid', op: 'mul', value: 0.3 }, months: 2 },
          { type: 'line', key: 'event.wolves_at_cache.res.guard' },
        ],
      },
      {
        id: 'let_be',
        hint: 'unknown',
        effects: [
          { type: 'animal', id: 'wolves', at: 'reindeer_ford' },
          {
            type: 'if',
            when: [{ type: 'flag', id: 'wolf_pups_killed' }],
            then: [{ type: 'modifier', mod: { stat: 'cache.raid', op: 'mul', value: 2.5 }, months: 3 }, { type: 'line', key: 'event.wolves_at_cache.res.grudge' }],
            else: [{ type: 'modifier', mod: { stat: 'cache.raid', op: 'mul', value: 1.5 }, months: 3 }],
          },
        ],
      },
    ],
  },
];
