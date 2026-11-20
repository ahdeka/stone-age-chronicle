// 1장 정의 조립: 구석기 → 신석기 (잿빛강 사람들)

import type { ChapterDefinition } from '../../../engine';
import { ch1AgeBands, ch1Balance } from './balance';
import { ch1Months } from './calendar';
import { ch1Events } from './events';
import { ch1Narratives } from './narratives';
import { ch1Policies } from './policies';
import { ch1Preset } from './preset';
import { ch1Theme } from './theme';
import {
  ch1Ailments,
  ch1Animals,
  ch1Clues,
  ch1FoodKinds,
  ch1Goods,
  ch1Knowledge,
  ch1Places,
  ch1Shelters,
  ch1Traits,
  ch1Weather,
  ch1Yields,
} from './world';

export const ch1: ChapterDefinition = {
  id: 'ch1',
  calendar: { months: ch1Months },
  seasons: ['spring', 'summer', 'autumn', 'winter'],
  ageBands: ch1AgeBands,
  foodKinds: ch1FoodKinds,
  goods: ch1Goods,
  shelters: ch1Shelters,
  yields: ch1Yields,
  places: ch1Places,
  animals: ch1Animals,
  weather: ch1Weather,
  ailments: ch1Ailments,
  traits: ch1Traits,
  knowledge: ch1Knowledge,
  clues: ch1Clues,
  content: {
    policies: ch1Policies,
    events: ch1Events,
    narratives: ch1Narratives,
    endings: [
      { id: 'ruin_extinct', kind: 'defeat', priority: 100, check: [{ type: 'population', max: 0 }] },
      { id: 'ruin_split', kind: 'defeat', priority: 90, check: [{ type: 'counter', id: 'low_cohesion_months', min: 3 }] },
      { id: 'survive_time', kind: 'survival', priority: 10, check: [{ type: 'month', min: ch1Balance.monthLimit }] },
    ],
  },
  scenes: {
    briefing: { bg: 'bg.camp_tents', subjects: ['sub.fire_circle'] },
    settlement: { bg: 'bg.camp_tents', subjects: ['sub.fire_circle'] },
  },
  globalMods: [],
  balance: ch1Balance,
  presets: [ch1Preset],
  theme: ch1Theme,
};
