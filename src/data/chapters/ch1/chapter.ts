// 1장 정의 조립: 구석기 → 신석기 (잿빛강 사람들)

import type { ChapterDefinition } from '../../../engine';
import { ch1AdvisorLines, ch1Stances } from './advisors';
import { ch1AgeBands, ch1Balance } from './balance';
import { ch1Briefing } from './briefing';
import { ch1Goals } from './goals';
import { ch1Months } from './calendar';
import { ch1Events } from './events';
import { ch1Narratives } from './narratives';
import { ch1Policies } from './policies';
import { ch1AutumnPreset, ch1SpringPreset } from './preset';
import { ch1Theme } from './theme';
import { ch1SeasonEvents, ch1SeasonNarratives, ch1SeasonPolicies } from './season';
import { ch1Tech, ch1TechNarratives, ch1TechPolicies } from './tech';
import { cellPolicies } from '../../../engine';
import {
  ch1Ailments,
  ch1Animals,
  ch1Clues,
  ch1Facilities,
  ch1FoodKinds,
  ch1GlobalMods,
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
  calendar: { months: ch1Months, yearStartsAt: 'thaw' },
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
  facilities: ch1Facilities,
  tech: ch1Tech,
  clues: ch1Clues,
  content: {
    policies: [...ch1Policies, ...ch1SeasonPolicies, ...ch1TechPolicies, ...cellPolicies({ tech: ch1Tech, balance: ch1Balance })],
    events: [...ch1Events, ...ch1SeasonEvents],
    narratives: [...ch1Narratives, ...ch1SeasonNarratives, ...ch1TechNarratives],
    endings: [
      { id: 'ruin_extinct', kind: 'defeat', priority: 100, check: [{ type: 'population', max: 0 }] },
      { id: 'ruin_split', kind: 'defeat', priority: 90, check: [{ type: 'counter', id: 'low_cohesion_months', min: 3 }] },
      // 신석기 (§B3.5): 갈래 둘의 끝. 전환 사건과 결말 문장은 R4
      { id: 'neolithic', kind: 'victory', priority: 80, check: [{ type: 'techBranchesDone', min: ch1Balance.tech.neolithicBranches }] },
      { id: 'survive_time', kind: 'survival', priority: 10, check: [{ type: 'month', min: ch1Balance.monthLimit }] },
    ],
  },
  scenes: {
    briefing: { bg: 'bg.camp_tents', subjects: ['sub.fire_circle', 'sub.reeds'], overlay: '{weather}' },
    settlement: { bg: 'bg.camp_tents', subjects: ['sub.fire_circle'], overlay: 'ov.night' },
    intro: { bg: 'bg.camp_tents', subjects: ['sub.fire_circle', 'sub.reeds'], overlay: 'ov.night' },
    groundBySeason: { spring: 'ground.spring', summer: 'ground.summer', autumn: 'ground.autumn', winter: 'ground.snow' },
  },
  briefing: ch1Briefing,
  advisors: { stances: ch1Stances, lines: ch1AdvisorLines },
  goals: ch1Goals,
  hooks: { villageNarrative: 'village_work' },
  globalMods: ch1GlobalMods,
  balance: ch1Balance,
  presets: [ch1SpringPreset, ch1AutumnPreset],
  theme: ch1Theme,
};
