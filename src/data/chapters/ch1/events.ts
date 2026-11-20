// 1장 사건 (M1 시험용 3개. M2에서 기록의 사건과 연결 지도 C1~C7로 확충한다)

import type { EventDef } from '../../../engine';

export const ch1Events: EventDef[] = [
  {
    // 기록 1달 중순: "두 소식이 한꺼번에"
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
    // 기록 3달 중순: "낯선 사람들" → 약속 "얼음이 녹으면, 다시" (연결 지도 C7)
    id: 'strangers_smoke',
    scope: 'village',
    slots: ['mid'],
    when: [{ type: 'season', in: ['winter'] }, { type: 'month', min: 2 }],
    weight: 6,
    cooldown: 0,
    once: true,
    scene: { bg: 'bg.camp_tents', subjects: ['sub.strangers'], overlay: 'ov.snow' },
    options: [
      {
        id: 'trade_hides',
        hint: 'sure',
        requires: [{ type: 'goods', id: 'hide', min: 10 }],
        effects: [
          { type: 'goods', id: 'hide', delta: -10 },
          { type: 'food', kind: 'dried_fish', kg: 150 },
          { type: 'schedule', event: 'reed_lake_return', after: 1, window: 6, when: [{ type: 'season', in: ['spring'] }] },
          { type: 'place', id: 'reed_lake', discovered: true },
          { type: 'chronicle', key: 'chron.strangers_trade', importance: 40 },
        ],
      },
      {
        id: 'decline',
        hint: 'unknown',
        effects: [{ type: 'flag', id: 'turned_away_reed_lake', set: true }, { type: 'cohesion', delta: -1 }],
      },
    ],
  },
  {
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
        effects: [{ type: 'goods', id: 'hide', delta: -5 }, { type: 'food', kind: 'dried_fish', kg: 100 }],
      },
      {
        id: 'learn',
        hint: 'sure',
        effects: [{ type: 'goods', id: 'hide', delta: -2 }, { type: 'knowledge', id: 'meat_drying', progress: 2 }],
      },
    ],
  },
];
