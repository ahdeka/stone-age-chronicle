// 엔진 공개 API. UI, 시뮬레이터, 검증기는 이 파일만 import한다.

export type * from './types';
export { createGame, type StartSource } from './core/createGame';
export { reduce } from './core/reduce';
export { evaluate, evaluateAll, findChief, matchPerson } from './conditions/evaluate';
export { getStat, stat, type StatValue, type StatPart } from './stats/stats';
export { serialize, deserialize, SAVE_FORMAT, type SaveFile, type LoadResult } from './save/save';
export { SAVE_VERSION } from './save/version';
export { seedToState, nextFloat, nextInt, chance, weightedIndex, shuffled, cloneRng } from './rng/rng';
