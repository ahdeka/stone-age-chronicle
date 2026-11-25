// 조건 언어 (DESIGN.md §5.1). 조건 평가에는 난수를 쓰지 않는다.

import type { AgeBand, Id, NumRange, Sex } from './common';

export interface PersonQuery {
  band?: AgeBand[];
  sex?: Sex;
  trait?: Id;
  skill?: { id: Id; min: number };
  /** 조언자 자리 (예: 'hunt_leader') */
  seat?: Id;
  isChief?: boolean;
  /** true: 부상·병이 있다 / false: 없다 */
  ailing?: boolean;
  /** 기본값 true */
  alive?: boolean;
  /** 몇 달 전에 죽었는가 (1 = 지난달). alive: false와 함께 쓴다 */
  diedMonthsAgo?: number;
}

export type Condition =
  // 물자 (마을에 있는 것만 센다)
  | ({ type: 'food'; kinds?: Id[] } & NumRange)
  | ({ type: 'foodDays' } & NumRange)
  | ({ type: 'firewood' } & NumRange)
  | ({ type: 'firewoodDays' } & NumRange)
  /** 장작이 쌓아 둘 수 있는 양(firewood.cap)의 몇 할인가 (0~1) */
  | ({ type: 'firewoodFill' } & NumRange)
  | ({ type: 'goods'; id: Id } & NumRange)
  | ({ type: 'cohesion' } & NumRange)
  | ({ type: 'hungerStage' } & NumRange)
  // 사람
  | ({ type: 'population'; band?: AgeBand } & NumRange)
  | ({ type: 'workers' } & NumRange)
  | { type: 'person'; match: PersonQuery; count?: NumRange }
  /** 몇 달 전(기본 1 = 지난달)에 죽은 사람 수 */
  | ({ type: 'deaths'; monthsAgo?: number } & NumRange)
  /** 사건에 바인딩된 인물, 또는 'leader'(방침을 이끄는 인물) */
  | { type: 'actor'; slot: string; match?: PersonQuery }
  // 시간과 날씨
  | { type: 'season'; in: Id[] }
  | { type: 'monthOfYear'; in: Id[] }
  | ({ type: 'month' } & NumRange)
  /** now: 지금 순의 날씨 / outlook: 이번 달 어느 순이든 */
  | { type: 'weather'; in: Id[]; at?: 'now' | 'outlook' }
  // 세계
  | { type: 'animal'; id: Id; state?: Id[]; at?: Id; known?: boolean }
  | ({ type: 'animalVar'; id: Id; var: string } & NumRange)
  | { type: 'place'; id: Id; discovered?: boolean; fact?: Id }
  | ({ type: 'placeStock'; id: Id; yield: Id } & NumRange)
  | { type: 'shelter'; in: Id[] }
  // 진행과 기억
  | { type: 'flag'; id: Id; present?: boolean; sinceMonths?: NumRange }
  | ({ type: 'counter'; id: Id } & NumRange)
  | { type: 'knowledge'; id: Id; has?: boolean }
  /** 시설 단계 (없으면 1 이상인가) */
  | ({ type: 'facility'; id: Id } & NumRange)
  | { type: 'clue'; id: Id; has?: boolean }
  /** 은닉물. known: 상태를 최근에 확인했는가 */
  | { type: 'cache'; at?: Id; known?: boolean; has?: boolean }
  | { type: 'policy'; id?: Id; category?: Id }
  // 논리
  | { type: 'all'; of: Condition[] }
  | { type: 'any'; of: Condition[] }
  | { type: 'not'; of: Condition };
// 'neighbor'는 이웃 집단을 넣는 M3에서 추가한다.

export type ConditionType = Condition['type'];
