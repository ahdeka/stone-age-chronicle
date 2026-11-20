// 1장 월초 보고 규칙: 머리글, 소식, 상황 칩, 월초 장면 (화면 시안 TurnModal)

import type { BriefingRules, Condition } from '../../../engine';

const wolvesNear: Condition = { type: 'animal', id: 'wolves', state: ['near_camp'] };
const herd: Condition = { type: 'animal', id: 'reindeer', state: ['migrating'] };

export const ch1Briefing: BriefingRules = {
  headlines: [
    { when: [{ type: 'hungerStage', min: 2 }], key: 'head.starving' },
    { when: [{ type: 'foodDays', max: 5 }], key: 'head.last_sack' },
    { when: [herd, wolvesNear], key: 'head.herd_and_wolves' },
    { when: [{ type: 'season', in: ['winter'] }, { type: 'firewoodDays', max: 5 }], key: 'head.fire_low' },
    { when: [{ type: 'weather', in: ['blizzard'], at: 'outlook' }], key: 'head.blizzard' },
    { when: [herd], key: 'head.herd' },
    { when: [{ type: 'animal', id: 'red_deer', state: ['river_crossing'] }], key: 'head.deer' },
  ],
  news: [
    { when: [{ type: 'hungerStage', min: 2 }], key: 'news.hunger', priority: 100, chip: 'chip.hunger', tone: 'warn' },
    { when: [{ type: 'foodDays', max: 10 }], key: 'news.food_low', priority: 95, chip: 'chip.food_low', tone: 'warn' },
    { when: [herd], key: 'news.reindeer.migrating', priority: 90, chip: 'chip.reindeer.migrating' },
    { when: [{ type: 'weather', in: ['blizzard'], at: 'outlook' }], key: 'news.blizzard', priority: 88, chip: 'chip.blizzard', tone: 'warn' },
    {
      when: [{ type: 'firewoodDays', max: 7 }, { type: 'season', in: ['autumn', 'winter'] }],
      key: 'news.firewood_low',
      priority: 86,
      chip: 'chip.firewood_low',
      tone: 'warn',
    },
    { when: [{ type: 'animal', id: 'red_deer', state: ['river_crossing'] }], key: 'news.deer.crossing', priority: 85, chip: 'chip.deer' },
    { when: [wolvesNear], key: 'news.wolves.near', priority: 80, chip: 'chip.wolves.near', tone: 'warn' },
    { when: [{ type: 'cache', known: false }], key: 'news.cache.unknown', priority: 75, chip: 'chip.cache' },
    { when: [{ type: 'month', max: 1 }, { type: 'person', match: { seat: 'elder' } }], key: 'news.seori.early_frost', priority: 70 },
    { when: [{ type: 'weather', in: ['cold_snap'], at: 'outlook' }], key: 'news.cold_snap', priority: 70, chip: 'chip.cold_snap', tone: 'warn' },
    { when: [{ type: 'person', match: { ailing: true } }], key: 'news.ailing', priority: 65 },
    { when: [{ type: 'monthOfYear', in: ['frost'] }], key: 'news.river_ice', priority: 60 },
    { when: [{ type: 'animal', id: 'bear', state: ['denning'], known: true }], key: 'news.bear.denning', priority: 50 },
    { when: [{ type: 'goods', id: 'hide', min: 20 }], key: 'news.hides', priority: 40 },
  ],
  chips: [],
  scenes: [
    { when: [herd], scene: { bg: 'bg.steppe', subjects: ['sub.reindeer_herd', 'sub.camp_far', 'sub.reeds'], overlay: 'ov.dusk' } },
    { when: [{ type: 'season', in: ['winter'] }], scene: { bg: 'bg.camp_tents', subjects: ['sub.fire_circle'], overlay: 'ov.snow' } },
  ],
};
