// 서술 결과. text는 ko 리소스의 키다 (DESIGN.md §12). 서술이 사실을 남기면 facts에 쓴다 (§18).

import type { Condition, Narrative } from '../../../engine';

const v = (id: string, n: number) => Array.from({ length: n }, (_, i) => ({ text: `nar.${id}.${i + 1}` }));
const inSeason = (s: string): Condition[] => [{ type: 'season', in: [s] }];
const seoriHere: Condition = { type: 'person', match: { seat: 'elder' } };
const noSeori: Condition = { type: 'not', of: seoriHere };
const oneDead: Condition = { type: 'deaths', max: 1 };
const manyDead: Condition = { type: 'deaths', min: 2 };

export const ch1Narratives: Narrative[] = [
  // ── 봄 ──
  { id: 'weir_month', variants: v('weir_month', 2) },
  {
    id: 'gather_month',
    variants: [
      { when: inSeason('spring'), text: 'nar.gather_month.spring.1' },
      { when: inSeason('spring'), text: 'nar.gather_month.spring.2' },
      { when: inSeason('summer'), text: 'nar.gather_month.summer.1' },
      { when: inSeason('summer'), text: 'nar.gather_month.summer.2' },
      { when: inSeason('autumn'), text: 'nar.gather_month.1' },
      { when: inSeason('autumn'), text: 'nar.gather_month.2' },
    ],
  },
  { id: 'spring_herd_good', variants: v('spring_herd_good', 2) },
  { id: 'spring_herd_bad', variants: v('spring_herd_bad', 1) },
  {
    id: 'marsh_found',
    variants: v('marsh_found', 2),
    facts: [
      { type: 'place', id: 'reed_lake', discovered: true },
      { type: 'flag', id: 'reed_lake_seen', set: true },
    ],
  },
  { id: 'marsh_lost', variants: v('marsh_lost', 1) },
  { id: 'net_month', variants: v('net_month', 1) },
  { id: 'spring_bear_down', variants: v('spring_bear_down', 1) },
  { id: 'spring_bear_fled', variants: v('spring_bear_fled', 1) },

  // ── 여름 ──
  { id: 'drying_month', variants: v('drying_month', 2) },
  {
    id: 'cave_found',
    variants: [
      { when: [{ type: 'animal', id: 'bear', state: ['denning'] }], text: 'nar.cave_found.winter' },
      { when: [{ type: 'animal', id: 'bear', state: ['active'] }], text: 'nar.cave_found.summer' },
    ],
    facts: [
      { type: 'place', id: 'north_cave', discovered: true, addFact: 'claw_marks' },
      { type: 'animal', id: 'bear', known: true },
    ],
  },
  { id: 'cave_not_found', variants: v('cave_not_found', 1) },
  { id: 'move_cave', variants: v('move_cave', 1) },
  { id: 'fortify_month', variants: v('fortify_month', 1) },
  { id: 'stockpile_month', variants: v('stockpile_month', 2) },
  { id: 'tan_month', variants: v('tan_month', 1) },
  { id: 'lake_walk', variants: v('lake_walk', 1) },
  { id: 'deer_good', variants: v('deer_good', 2) },
  { id: 'deer_bad', variants: v('deer_bad', 1) },

  // ── 가을 ──
  { id: 'nut_month', variants: v('nut_month', 2) },
  { id: 'ambush_good', variants: v('ambush_good', 2) },
  { id: 'ambush_bad', variants: v('ambush_bad', 1) },
  { id: 'herd_good', variants: v('herd_good', 2) },
  { id: 'herd_costly', variants: v('herd_costly', 1) },
  { id: 'herd_bad', variants: v('herd_bad', 1) },
  { id: 'hunt_called_off', variants: v('hunt_called_off', 1) },
  { id: 'stragglers', variants: v('stragglers', 1) },
  { id: 'sled_made', variants: v('sled_made', 1) },
  { id: 'ice_tools_made', variants: v('ice_tools_made', 1) },
  { id: 'craft_failed', variants: v('craft_failed', 1) },
  { id: 'prep_month', variants: v('prep_month', 2) },

  // ── 겨울 ──
  { id: 'cache_found', variants: v('cache_found', 1) },
  { id: 'cache_gone', variants: v('cache_gone', 1) },
  { id: 'ice_hole_month', variants: [{ when: [{ type: 'knowledge', id: 'ice_fishing' }], text: 'nar.ice_hole_month.known' }, { when: [{ type: 'knowledge', id: 'ice_fishing', has: false }], text: 'nar.ice_hole_month.1' }] },
  { id: 'snare_month', variants: v('snare_month', 2) },
  { id: 'deer_snow_good', variants: v('deer_snow_good', 1) },
  { id: 'deer_drive_good', variants: v('deer_drive_good', 1) },
  { id: 'nurse_month', variants: v('nurse_month', 1) },
  { id: 'hold_month', variants: v('hold_month', 1) },
  { id: 'bear_down', variants: v('bear_down', 1) },
  { id: 'bear_down_costly', variants: v('bear_down_costly', 1) },
  { id: 'bear_escaped', variants: v('bear_escaped', 1) },

  {
    // 마을 일 (엔진 고리 hooks.villageNarrative): $villagers, $wood, $gathered
    id: 'village_work',
    variants: [
      { when: inSeason('autumn'), text: 'nar.village_work.autumn.1' },
      { when: inSeason('autumn'), text: 'nar.village_work.autumn.2' },
      { when: [{ type: 'season', in: ['winter'] }, { type: 'weather', in: ['blizzard'] }], text: 'nar.village_work.blizzard' },
      { when: [{ type: 'season', in: ['winter'] }, { type: 'not', of: { type: 'weather', in: ['blizzard'] } }], text: 'nar.village_work.winter.1' },
      { when: [{ type: 'season', in: ['winter'] }, { type: 'not', of: { type: 'weather', in: ['blizzard'] } }], text: 'nar.village_work.winter.2' },
      { when: [{ type: 'season', in: ['spring', 'summer'] }], text: 'nar.village_work.warm.1' },
      { when: [{ type: 'season', in: ['spring', 'summer'] }], text: 'nar.village_work.warm.2' },
    ],
  },

  // ── 애도 (③a): $actor_dead = 지난달 떠난 사람. 서리가 살아 있으면 서리의 옛 노래 ──
  {
    id: 'mourning_rite',
    variants: [
      { when: [seoriHere, oneDead], text: 'nar.mourning_rite.seori.1' },
      { when: [seoriHere, oneDead], text: 'nar.mourning_rite.seori.2' },
      { when: [seoriHere, manyDead], text: 'nar.mourning_rite.seori.many' },
      { when: [noSeori, oneDead], text: 'nar.mourning_rite.plain.1' },
      { when: [noSeori, oneDead], text: 'nar.mourning_rite.plain.2' },
      { when: [noSeori, manyDead], text: 'nar.mourning_rite.plain.many' },
    ],
  },
  { id: 'mourning_postponed', variants: v('mourning_postponed', 2) },
];
