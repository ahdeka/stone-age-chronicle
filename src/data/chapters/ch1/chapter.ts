// 1장 정의: 구석기 → 신석기 전환. 엔진은 이 객체만 읽는다.

import type { ChapterDefinition } from '../../../engine';
import { offices } from '../../common/offices';
import { personTraits } from '../../common/personTraits';
import { ch1Balance, ch1Numbers } from './balance';
import { ch1Endings } from './endings';
import { ch1Presets } from './presets';
import { ch1Regions } from './regions';
import { ch1Theme } from './theme';

const n = ch1Numbers;

export const ch1: ChapterDefinition = {
  id: 'ch1',
  eras: [{ id: 'paleolithic' }, { id: 'neolithic' }],
  resources: [
    { id: 'food', min: 0, max: null, icon: 'food' },
    { id: 'tools', min: 0, max: 40, icon: 'tools' },
    { id: 'lore', min: 0, max: null, icon: 'lore' },
    { id: 'cohesion', min: 0, max: 100, icon: 'cohesion' },
  ],
  axes: [
    { id: 'share_hierarchy', min: -100, max: 100 },
    { id: 'tradition_novelty', min: -100, max: 100 },
    { id: 'harmony_force', min: -100, max: 100 },
    { id: 'nomad_settle', min: -100, max: 100 },
  ],
  roles: [
    { id: 'gather', icon: 'gather', outputs: [{ resource: 'food', stat: 'yield.gather', depletes: true }] },
    {
      id: 'hunt',
      icon: 'hunt',
      outputs: [
        {
          resource: 'food',
          stat: 'yield.hunt',
          depletes: true,
          variance: n.hunt.variance,
          bonusFrom: { resource: 'tools', perCapitaCap: n.hunt.toolBonusCap, weight: n.hunt.toolBonusWeight },
        },
      ],
    },
    { id: 'craft', icon: 'craft', outputs: [{ resource: 'tools', stat: 'yield.craft' }] },
    {
      id: 'ritual',
      icon: 'ritual',
      outputs: [
        { resource: 'lore', stat: 'yield.ritual.lore' },
        { resource: 'cohesion', stat: 'yield.ritual.cohesion' },
      ],
    },
    { id: 'guard', icon: 'guard', outputs: [] },
  ],
  seasons: [
    {
      id: 'spring',
      modifiers: [
        { stat: 'yield.gather', op: 'mul', value: n.season.spring.gather },
        { stat: 'yield.hunt', op: 'mul', value: n.season.spring.hunt },
      ],
    },
    {
      id: 'summer',
      modifiers: [
        { stat: 'yield.gather', op: 'mul', value: n.season.summer.gather },
        { stat: 'yield.hunt', op: 'mul', value: n.season.summer.hunt },
      ],
    },
    {
      id: 'autumn',
      modifiers: [
        { stat: 'yield.gather', op: 'mul', value: n.season.autumn.gather },
        { stat: 'yield.hunt', op: 'mul', value: n.season.autumn.hunt },
      ],
    },
    {
      id: 'winter',
      modifiers: [
        { stat: 'yield.gather', op: 'mul', value: n.season.winter.gather },
        { stat: 'yield.hunt', op: 'mul', value: n.season.winter.hunt },
        { stat: 'consume.food', op: 'mul', value: n.season.winter.consume },
      ],
    },
  ],
  lifestyles: [
    { id: 'nomadic', modifiers: [] },
    { id: 'settled', modifiers: [{ stat: 'storage.food.perPop', op: 'mul', value: n.settledStorageMul }] },
  ],
  lifeStages: [
    { id: 'child', next: 'youth', turnsToNext: n.lifeStages.child, canHoldOffice: false, canBeChief: false },
    { id: 'youth', next: 'adult', turnsToNext: n.lifeStages.youth, canHoldOffice: true, canBeChief: true },
    { id: 'adult', next: 'elder', turnsToNext: n.lifeStages.adult, canHoldOffice: true, canBeChief: true },
    { id: 'elder', next: null, turnsToNext: 0, canHoldOffice: true, canBeChief: true },
  ],
  offices,
  scale: { labelKey: 'scale.band' },
  timeDisplay: { mode: 'reign' },
  balance: ch1Balance,
  startPresets: ch1Presets,
  content: {
    personTraits,
    tribeTraits: [],
    regions: ch1Regions,
    endings: ch1Endings,
  },
  theme: ch1Theme,
};
