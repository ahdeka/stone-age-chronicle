// 1장 월초 보고 규칙: 머리글, 소식, 상황 칩, 월초 장면 (화면 시안 TurnModal)
// 봄 시작: 첫 달은 얼음이 풀리는 강과 물고기 떼, 철새, 북쪽으로 가는 순록, 깨어난 곰.

import type { BriefingRules, Condition } from '../../../engine';

const wolvesNear: Condition = { type: 'animal', id: 'wolves', state: ['near_camp'] };
const herd: Condition = { type: 'animal', id: 'reindeer', state: ['migrating'] };
const autumn: Condition = { type: 'season', in: ['autumn'] };
const spring: Condition = { type: 'season', in: ['spring'] };
const fishRun: Condition = { type: 'animal', id: 'fish', state: ['running'] };

export const ch1Briefing: BriefingRules = {
  headlines: [
    { when: [{ type: 'hungerStage', min: 2 }], key: 'head.starving' },
    // 첫 달은 얼음이 풀리는 강이 머리글 (식량 부족은 첫 소식과 칩으로 보인다)
    { when: [{ type: 'month', max: 1 }, fishRun], key: 'head.thaw' },
    { when: [{ type: 'foodDays', max: 5 }], key: 'head.last_sack' },
    { when: [{ type: 'monthOfYear', in: ['thaw'] }, fishRun], key: 'head.thaw' },
    { when: [herd, wolvesNear, autumn], key: 'head.herd_and_wolves' },
    { when: [{ type: 'season', in: ['winter'] }, { type: 'firewoodDays', max: 5 }], key: 'head.fire_low' },
    { when: [{ type: 'weather', in: ['blizzard'], at: 'outlook' }], key: 'head.blizzard' },
    { when: [herd, autumn], key: 'head.herd' },
    { when: [herd, spring], key: 'head.herd_north' },
    { when: [{ type: 'animal', id: 'red_deer', state: ['river_crossing'] }], key: 'head.deer' },
    { when: [{ type: 'monthOfYear', in: ['reindeer', 'leaf'] }], key: 'head.winter_near' },
  ],
  news: [
    { when: [{ type: 'hungerStage', min: 2 }], key: 'news.hunger', priority: 100, chip: 'chip.hunger', tone: 'warn' },
    { when: [{ type: 'foodDays', max: 10 }], key: 'news.food_low', priority: 95, chip: 'chip.food_low', tone: 'warn' },
    { when: [fishRun], key: 'news.thaw', priority: 92, chip: 'chip.fish_run', tone: 'good' },
    { when: [herd, autumn], key: 'news.reindeer.migrating', priority: 90, chip: 'chip.reindeer.migrating' },
    { when: [herd, spring], key: 'news.reindeer.north', priority: 84, chip: 'chip.reindeer.north' },
    { when: [{ type: 'weather', in: ['blizzard'], at: 'outlook' }], key: 'news.blizzard', priority: 88, chip: 'chip.blizzard', tone: 'warn' },
    {
      when: [{ type: 'firewoodDays', max: 7 }, { type: 'season', in: ['autumn', 'winter'] }],
      key: 'news.firewood_low',
      priority: 86,
      chip: 'chip.firewood_low',
      tone: 'warn',
    },
    { when: [{ type: 'animal', id: 'red_deer', state: ['river_crossing'] }], key: 'news.deer.crossing', priority: 85, chip: 'chip.deer' },
    { when: [{ type: 'monthOfYear', in: ['thaw', 'sprout'] }, { type: 'animal', id: 'bear', state: ['active'] }, { type: 'flag', id: 'bear_killed', present: false }], key: 'news.bear.awake', priority: 82, chip: 'chip.bear.awake', tone: 'warn' },
    { when: [wolvesNear], key: 'news.wolves.near', priority: 80, chip: 'chip.wolves.near', tone: 'warn' },
    { when: [{ type: 'cache', known: false }], key: 'news.cache.unknown', priority: 75, chip: 'chip.cache' },
    { when: [{ type: 'month', max: 1 }, { type: 'person', match: { seat: 'elder' } }, spring], key: 'news.seori.thaw', priority: 72 },
    { when: [{ type: 'month', max: 1 }, { type: 'person', match: { seat: 'elder' } }, autumn], key: 'news.seori.early_frost', priority: 70 },
    { when: [{ type: 'monthOfYear', in: ['thaw', 'sprout', 'egg'] }], key: 'news.birds', priority: 66 },
    { when: [{ type: 'weather', in: ['cold_snap'], at: 'outlook' }], key: 'news.cold_snap', priority: 70, chip: 'chip.cold_snap', tone: 'warn' },
    { when: [{ type: 'season', in: ['summer'] }, { type: 'food', kinds: ['raw_meat', 'fish'], min: 100 }], key: 'news.summer_spoil', priority: 68, chip: 'chip.spoil', tone: 'warn' },
    { when: [{ type: 'monthOfYear', in: ['fruit', 'reindeer'] }], key: 'news.nuts', priority: 67 },
    { when: [{ type: 'monthOfYear', in: ['reindeer', 'leaf'] }], key: 'news.winter_coming', priority: 64, chip: 'chip.winter_coming', tone: 'warn' },
    { when: [{ type: 'person', match: { ailing: true } }], key: 'news.ailing', priority: 65 },
    { when: [{ type: 'monthOfYear', in: ['frost'] }], key: 'news.river_ice', priority: 60 },
    { when: [{ type: 'animal', id: 'bear', state: ['denning'], known: true }], key: 'news.bear.denning', priority: 50 },
    { when: [{ type: 'goods', id: 'hide', min: 20 }], key: 'news.hides', priority: 40 },
    { when: [{ type: 'flag', id: 'reed_lake_met' }, { type: 'month', max: 8 }], key: 'news.reed_lake.known', priority: 30 },
  ],
  chips: [],
  scenes: [
    { when: [fishRun], scene: { bg: 'bg.river_ford', subjects: ['sub.fish_run', 'sub.birds', 'sub.camp_far'] } },
    { when: [herd, autumn], scene: { bg: 'bg.steppe', subjects: ['sub.reindeer_herd', 'sub.camp_far', 'sub.reeds'], overlay: 'ov.dusk' } },
    { when: [herd], scene: { bg: 'bg.steppe', subjects: ['sub.reindeer_herd', 'sub.camp_far'] } },
    { when: [{ type: 'shelter', in: ['rock_cave'] }], scene: { bg: 'bg.cave_mouth', subjects: ['sub.fire_circle'], overlay: '{weather}' } },
    { when: [{ type: 'season', in: ['winter'] }], scene: { bg: 'bg.camp_tents', subjects: ['sub.fire_circle'], overlay: 'ov.snow' } },
    { when: [{ type: 'season', in: ['autumn'] }], scene: { bg: 'bg.camp_tents', subjects: ['sub.berries', 'sub.fire_circle'], overlay: 'ov.dusk' } },
    { when: [{ type: 'season', in: ['summer'] }], scene: { bg: 'bg.camp_tents', subjects: ['sub.gatherers', 'sub.fire_circle'] } },
  ],
};
