// 1장 기본 행동 카드 10종 (DESIGN.md §7.5). 역할 배분이 기본 산출을 맡고, 카드는 비용·위험을 감수하고 한 번 크게 미는 수단이다.

import type { ActionCardDef } from '../../../engine';
import {
  WORKING_AGE,
  actorIs,
  anyOf,
  check,
  chron,
  cohesion,
  counter,
  food,
  lore,
  mod,
  pActor,
  pRes,
  pRole,
  pop,
  random,
  season,
  shareHier,
  someone,
  tools,
  tradNov,
  when,
} from '../../common/dsl';

export const ch1Actions: ActionCardDef[] = [
  {
    id: 'hunt_expedition',
    icon: 'hunt',
    tags: ['food', 'risk'],
    cost: [tools(-1)],
    assign: { required: false, match: WORKING_AGE },
    effects: [
      check(
        [pRole('hunt', 1), pRes('tools', 0.2), pActor('assignee', 2, { trait: 'brave' }), pActor('assignee', 2, { office: 'hunt_leader' })],
        6,
        [food(12), chron('chron.hunt.big', 1)],
        [food(3), random([7, []], [3, [pop(-1)], 'outcome.injury'])],
      ),
    ],
  },
  {
    id: 'gather_trip',
    icon: 'gather',
    tags: ['food'],
    effects: [
      when(
        [season('winter')],
        [food(3)],
        [random([8, [food(8)]], [2, [food(3), cohesion(-3)], 'outcome.badMushroom'])],
      ),
    ],
  },
  {
    id: 'explore_surroundings',
    icon: 'explore',
    tags: ['explore', 'risk'],
    cost: [food(-2)],
    assign: { required: false, match: WORKING_AGE },
    effects: [
      counter('explored'),
      random([4, [food(6)], 'outcome.berries'], [3, [lore(2)], 'outcome.oldCamp'], [2, []], [1, [pop(-1)], 'outcome.fall']),
      when([actorIs('assignee', { trait: 'pathfinder' })], [food(2)]),
    ],
  },
  {
    id: 'craft_tools',
    icon: 'craft',
    tags: ['tools'],
    cost: [food(-2)],
    assign: { required: false, match: WORKING_AGE },
    effects: [
      tools(4),
      when([actorIs('assignee', { trait: 'crafty' })], [tools(2)]),
      when([actorIs('assignee', { office: 'artisan' })], [tools(1)]),
    ],
  },
  {
    id: 'fire_ritual',
    icon: 'ritual',
    tags: ['ritual'],
    cost: [food(-3)],
    effects: [cohesion(6), lore(1), tradNov(-3)],
  },
  {
    id: 'pass_on_stories',
    icon: 'lore',
    tags: ['lore'],
    requires: [anyOf(someone({ trait: 'storyteller' }), someone({ stage: ['elder'] }))],
    lockHintKey: 'lock.need_storyteller_or_elder',
    cost: [food(-1)],
    assign: { required: false, match: WORKING_AGE },
    effects: [lore(3), counter('tales_told'), tradNov(-2), when([actorIs('assignee', { trait: 'storyteller' })], [lore(2)])],
  },
  {
    id: 'dry_meat',
    icon: 'food',
    tags: ['food', 'prepare'],
    cost: [food(-3), tools(-1)],
    effects: [mod('spoil.food', 'mul', 0.3, 3), mod('storage.food.perPop', 'add', 2, 3)],
  },
  {
    id: 'scout_herds',
    icon: 'hunt',
    tags: ['hunt', 'prepare'],
    cost: [food(-1)],
    assign: { required: false, match: WORKING_AGE },
    effects: [mod('yield.hunt', 'mul', 1.3, 2), when([actorIs('assignee', { trait: 'pathfinder' })], [mod('yield.hunt', 'mul', 1.1, 2)])],
  },
  {
    id: 'share_feast',
    icon: 'cohesion',
    tags: ['ritual', 'share'],
    cost: [food(-10)],
    effects: [cohesion(10), shareHier(-5)],
    chronicle: { importance: 1 },
  },
  {
    id: 'post_watch',
    icon: 'guard',
    tags: ['prepare', 'danger'],
    cost: [food(-2)],
    effects: [mod('watch', 'add', 3, 3)],
  },
];

/** 시작 덱 13장 */
export const ch1StartingDeck: string[] = [
  'hunt_expedition',
  'hunt_expedition',
  'gather_trip',
  'gather_trip',
  'craft_tools',
  'craft_tools',
  'explore_surroundings',
  'fire_ritual',
  'pass_on_stories',
  'dry_meat',
  'scout_herds',
  'share_feast',
  'post_watch',
];
