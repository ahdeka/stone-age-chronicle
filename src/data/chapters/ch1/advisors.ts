// 1장 조언자: 입장(무엇을 좋아하는가)과 대사 (시험 플레이: 바위 대담, 서리 신중, 노을 실용, 이끼 기술)

import type { AdvisorLine, StanceDef } from '../../../engine';

export const ch1Stances: StanceDef[] = [
  { id: 'bold', categories: { hunt: 3, food: 2, explore: 1, hold: -2 }, hints: { risky: 2, unknown: 1, fair: 0.5, sure: -1 } },
  { id: 'cautious', categories: { firewood: 3, hold: 1.5, gather: 1, hunt: -1 }, hints: { sure: 2, fair: 0.5, risky: -2, unknown: -1 } },
  { id: 'practical', categories: { gather: 3, food: 1.5, firewood: 1 }, hints: { sure: 1, fair: 0.5, risky: -1 } },
  { id: 'inventive', categories: { craft: 3, gather: 2, firewood: 1.5 }, hints: { fair: 1, unknown: 0.5 } },
];

/** text는 ko 리소스 키 (advice.*) */
export const ch1AdvisorLines: AdvisorLine[] = [
  { seat: 'hunt_leader', policy: 'reindeer_big_hunt', text: 'advice.bawi.big_hunt' },
  { seat: 'hunt_leader', policy: 'recover_cache', text: 'advice.bawi.cache' },
  { seat: 'hunt_leader', category: 'hold', text: 'advice.bawi.hold' },
  { seat: 'hunt_leader', text: 'advice.bawi.generic' },
  { seat: 'elder', policy: 'winter_prep', text: 'advice.seori.winter_prep' },
  { seat: 'elder', category: 'hold', text: 'advice.seori.hold' },
  { seat: 'elder', text: 'advice.seori.generic' },
  { seat: 'healer', policy: 'river_gather', text: 'advice.noeul.gather' },
  { seat: 'healer', category: 'hold', text: 'advice.noeul.hold' },
  { seat: 'healer', text: 'advice.noeul.generic' },
  { seat: 'artisan', policy: 'river_gather', text: 'advice.ikki.gather' },
  { seat: 'artisan', policy: 'winter_prep', text: 'advice.ikki.winter_prep' },
  { seat: 'artisan', text: 'advice.ikki.generic' },
];
