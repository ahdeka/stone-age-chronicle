// 서술 결과. text는 ko 리소스의 키다 (DESIGN.md §12). M1은 경로 확인용이라 변형이 적다.

import type { Narrative } from '../../../engine';

const v = (id: string, n: number) => Array.from({ length: n }, (_, i) => ({ text: `nar.${id}.${i + 1}` }));

export const ch1Narratives: Narrative[] = [
  { id: 'ambush_good', variants: v('ambush_good', 2) },
  { id: 'ambush_bad', variants: v('ambush_bad', 1) },
  { id: 'herd_good', variants: v('herd_good', 2) },
  { id: 'herd_costly', variants: v('herd_costly', 1) },
  { id: 'herd_bad', variants: v('herd_bad', 1) },
  { id: 'hunt_called_off', variants: v('hunt_called_off', 1) },
  { id: 'gather_month', variants: v('gather_month', 2) },
  { id: 'prep_month', variants: v('prep_month', 2) },
  { id: 'hold_month', variants: v('hold_month', 1) },
  { id: 'cache_found', variants: v('cache_found', 1) },
  { id: 'cache_gone', variants: v('cache_gone', 1) },
  {
    // 마을 일 (엔진 고리 hooks.villageNarrative): $villagers, $wood, $gathered
    id: 'village_work',
    variants: [
      { when: [{ type: 'season', in: ['autumn'] }], text: 'nar.village_work.autumn.1' },
      { when: [{ type: 'season', in: ['autumn'] }], text: 'nar.village_work.autumn.2' },
      { when: [{ type: 'season', in: ['winter'] }, { type: 'weather', in: ['blizzard'] }], text: 'nar.village_work.blizzard' },
      { when: [{ type: 'season', in: ['winter'] }, { type: 'not', of: { type: 'weather', in: ['blizzard'] } }], text: 'nar.village_work.winter.1' },
      { when: [{ type: 'season', in: ['winter'] }, { type: 'not', of: { type: 'weather', in: ['blizzard'] } }], text: 'nar.village_work.winter.2' },
      { when: [{ type: 'season', in: ['spring', 'summer'] }], text: 'nar.village_work.warm.1' },
      { when: [{ type: 'season', in: ['spring', 'summer'] }], text: 'nar.village_work.warm.2' },
    ],
  },
];
