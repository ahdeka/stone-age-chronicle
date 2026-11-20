// 발견과 낯선 이들: 그림 동굴, 길 잃은 아이와 그 무리 (이웃 체계는 M5 — 여기서는 이름 없는 무리)

import type { EventDef } from '../../../../engine';
import {
  cohesion,
  counter,
  food,
  harmForce,
  lore,
  mod,
  nomadSettle,
  pop,
  random,
  shareHier,
  tools,
  tradNov,
} from '../../../common/dsl';

export const discoveryEvents: EventDef[] = [
  {
    id: 'painted_cave',
    tags: ['discovery', 'lore'],
    trigger: { conditions: [{ type: 'counter', id: 'explored', min: 1 }] },
    mode: 'pool',
    weight: 10,
    cooldown: 0,
    once: true,
    options: [
      {
        id: 'add_story',
        effects: [food(-3), lore(5), counter('great_tales'), tradNov(-4)],
        chronicle: { importance: 3 },
      },
      {
        id: 'stay_there',
        effects: [nomadSettle(8), cohesion(3), mod('yield.gather', 'mul', 0.9, 4)],
        setFlags: ['cave_home'],
        chronicle: { importance: 3 },
      },
      { id: 'leave_quiet', effects: [lore(1), tradNov(-2), cohesion(-2)] },
    ],
  },
  {
    id: 'lost_child',
    tags: ['people', 'stranger'],
    trigger: { minTurn: 6 },
    mode: 'pool',
    weight: 6,
    cooldown: 0,
    once: true,
    options: [
      {
        id: 'adopt',
        effects: [pop(1), food(-3), harmForce(-6)],
        setFlags: ['adopted_child'],
        followUps: [{ eventId: 'child_kin_claim', delay: 8, chance: 0.7 }],
        chronicle: { importance: 2 },
      },
      {
        id: 'return_home',
        effects: [food(-4), cohesion(-2), harmForce(-4), lore(2)],
        setFlags: ['returned_child'],
        followUps: [{ eventId: 'child_kin_thanks', delay: 6, chance: 0.8 }],
        chronicle: { importance: 2 },
      },
      { id: 'pass_by', effects: [cohesion(-4), shareHier(2)], setFlags: ['abandoned_child'] },
    ],
  },
  {
    id: 'child_kin_claim',
    tags: ['stranger'],
    trigger: {},
    mode: 'followUp',
    weight: 1,
    cooldown: 0,
    once: true,
    options: [
      {
        id: 'give_back',
        effects: [pop(-1), cohesion(-3), harmForce(-4), lore(2)],
        setFlags: ['kin_friends'],
        chronicle: { importance: 2 },
      },
      {
        id: 'let_choose',
        effects: [
          random(
            [1, [pop(-1), harmForce(-3)], 'outcome.childLeaves'],
            [1, [cohesion(3), harmForce(2)], 'outcome.childStays'],
          ),
        ],
        setFlags: ['kin_wary'],
        chronicle: { importance: 2 },
      },
      {
        id: 'refuse',
        effects: [harmForce(8), cohesion(2), tradNov(-2), random([2, []], [1, [pop(-1)], 'outcome.ambush'])],
        setFlags: ['kin_feud'],
        chronicle: { importance: 3 },
      },
    ],
  },
  {
    id: 'child_kin_thanks',
    tags: ['stranger'],
    trigger: {},
    mode: 'followUp',
    weight: 1,
    cooldown: 0,
    once: true,
    options: [
      {
        id: 'accept_gift',
        effects: [tools(4), food(4)],
        setFlags: ['kin_friends'],
        freeOk: '예전에 아이를 데려다준 비용의 보답',
        chronicle: { importance: 2 },
      },
      {
        id: 'ask_knowledge',
        effects: [lore(4), tradNov(3)],
        setFlags: ['kin_friends'],
        freeOk: '예전에 아이를 데려다준 비용의 보답',
      },
      { id: 'feast_together', effects: [food(-6), cohesion(5), harmForce(-5)], setFlags: ['kin_friends', 'kin_feasted'], chronicle: { importance: 3 } },
    ],
  },
];
