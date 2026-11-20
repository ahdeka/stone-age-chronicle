// 1장 시대 목표 (DESIGN.md §13). measure가 없는 길은 아직 잴 수 없어 화면에서 흐리게 보인다 (M5에서 채운다).

import type { EraGoalDef } from '../../../engine';

export const ch1Goals: EraGoalDef[] = [
  {
    id: 'food_stability',
    paths: [
      { id: 'winter_fed', measure: { id: 'winterFedMonths', target: 3 } },
      { id: 'stockpile', measure: { id: 'durableFoodDays', target: 90, params: { kinds: 'dried_meat,dried_fish' } } },
      { id: 'first_harvest' },
    ],
  },
  {
    id: 'permanent_home',
    paths: [
      { id: 'cave_base', measure: { id: 'shelterMonths', target: 12, params: { shelter: 'rock_cave' } } },
      { id: 'pit_village' },
      { id: 'river_camp' },
    ],
  },
  {
    id: 'expansion',
    paths: [{ id: 'marriage' }, { id: 'trade_vassal' }, { id: 'conquest' }, { id: 'refugees' }],
  },
];
