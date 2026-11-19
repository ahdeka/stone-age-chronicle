// 1장 결말 (DESIGN.md §7.8). M1은 멸족과 시간 종료만. 나머지 결말은 M6에서 추가한다.

import type { EndingDef } from '../../../engine';
import { ch1Numbers } from './balance';

export const ch1Endings: EndingDef[] = [
  {
    id: 'ruin_extinct',
    kind: 'defeat',
    priority: 100,
    check: [{ type: 'population', max: 0 }],
    powerSeeds: [],
  },
  {
    id: 'survive_basic',
    kind: 'survival',
    priority: 0,
    check: [{ type: 'turn', min: ch1Numbers.turnLimit }],
    powerSeeds: [],
  },
];
