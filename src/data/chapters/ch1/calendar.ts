// 1장 달력: 12달, 계절, 온도, 장작, 날씨 (DESIGN.md §10.3)
// 장작 소모 기준점(시험 플레이): 낙엽달 천막 한 달 약 110kg, 서리달 순당 130kg, 한겨울 한 달 약 600kg.

import type { MonthDef } from '../../../engine';

const base: MonthDef[] = [
  { id: 'thaw', number: 3, season: 'spring', temp: 'cold', firewoodPerDay: 8, woodPerWorkerDay: 4, weather: { clear: 4, rain: 2, fog: 2, cold_snap: 1 } },
  { id: 'sprout', number: 4, season: 'spring', temp: 'mild', firewoodPerDay: 5, woodPerWorkerDay: 5, weather: { clear: 5, rain: 3, fog: 1 } },
  { id: 'egg', number: 5, season: 'spring', temp: 'mild', firewoodPerDay: 3, woodPerWorkerDay: 5, weather: { clear: 5, rain: 3 } },
  { id: 'longday', number: 6, season: 'summer', temp: 'warm', firewoodPerDay: 1, woodPerWorkerDay: 6, weather: { clear: 6, rain: 2, drought: 1 } },
  { id: 'hot', number: 7, season: 'summer', temp: 'warm', firewoodPerDay: 1, woodPerWorkerDay: 6, weather: { clear: 5, drought: 2, rain: 1 } },
  { id: 'thunder', number: 8, season: 'summer', temp: 'warm', firewoodPerDay: 1, woodPerWorkerDay: 6, weather: { clear: 3, rain: 3, fog: 1 } },
  { id: 'fruit', number: 9, season: 'autumn', temp: 'mild', firewoodPerDay: 2, woodPerWorkerDay: 5, weather: { clear: 5, rain: 2, fog: 1 } },
  { id: 'reindeer', number: 10, season: 'autumn', temp: 'cold', firewoodPerDay: 3, woodPerWorkerDay: 4, weather: { clear: 4, rain: 2, frost: 2 } },
  { id: 'leaf', number: 11, season: 'autumn', temp: 'cold', firewoodPerDay: 4, woodPerWorkerDay: 3, weather: { clear: 3, frost: 3, rain: 1, fog: 1 } },
  { id: 'frost', number: 12, season: 'winter', temp: 'frozen', firewoodPerDay: 13, woodPerWorkerDay: 3, weather: { frost: 3, snow: 3, cold_snap: 2, blizzard: 1 } },
  { id: 'snow', number: 1, season: 'winter', temp: 'frozen', firewoodPerDay: 20, woodPerWorkerDay: 3, weather: { snow: 4, cold_snap: 3, blizzard: 2, clear: 1 } },
  { id: 'ice', number: 2, season: 'winter', temp: 'frozen', firewoodPerDay: 20, woodPerWorkerDay: 3, weather: { cold_snap: 3, snow: 3, blizzard: 2, clear: 2 } },
];

export const ch1Months: MonthDef[] = base.map((m) =>
  // 겨울에는 얼음 낚시 지식 없이는 물고기를 못 잡는다
  m.season === 'winter' ? { ...m, mods: [{ stat: 'yield.fish', op: 'add' as const, value: -1 }] } : m,
);

/** 기본 시작: 녹는달 (봄, 3월) */
export const CH1_START_MONTH_INDEX = 0;
/** 숨은 테스트 시작: 낙엽달 (늦가을, 11월) — 시험 플레이 재현 */
export const CH1_AUTUMN_MONTH_INDEX = 8;
