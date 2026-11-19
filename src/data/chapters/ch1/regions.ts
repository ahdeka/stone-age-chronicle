// 1장 지역 (DESIGN.md §7.6). M1은 시작 지역만. 나머지는 M4에서 추가한다.

import type { RegionDef } from '../../../engine';

export const ch1Regions: RegionDef[] = [
  {
    id: 'grey_wolf_hill',
    depth: 0,
    revealedFrom: [],
    foodMul: { spring: 1, summer: 1, autumn: 1, winter: 1 },
    danger: 1,
    specials: ['cave'],
    settleable: true,
    tags: ['hill'],
  },
];
