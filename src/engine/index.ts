// 엔진 공개 API. UI, 도구, 데이터는 여기서만 가져온다.

export * from './types';
export { createGame, cleanTribeName, TRIBE_NAME_MAX, type NewGameOptions } from './core/createGame';
export { reduce, applyCommand } from './core/reduce';
export { monthDef, monthIndex, season, findEvent, findPolicy, findPlace, phaseNo, calendarDate } from './core/lookup';
export type { CalendarDate } from './core/lookup';
export { evaluate, allTrue, failedConditions, foodDays, firewoodDays, workers, matchPerson } from './conditions/evaluate';
export { getStat, stat, firewoodPerDay, type StatValue } from './stats/stats';
export { ageYears, band, living, population, countBand, dailyFoodTotal } from './people/people';
export { totalKg } from './stores/food';
export { optionStatuses } from './events/events';
export { tierProbabilities, successChance, triCdf, tierOf } from './outcome/tier';
export { LEFTOVER_OPTIONS, leftoverAvailable } from './month/month';
export { serialize, deserialize, SAVE_FORMAT } from './save/save';
export { SAVE_VERSION } from './save/version';
export { seedToState, nextFloat, nextInt, chance, weightedIndex, shuffled, cloneRng } from './rng/rng';
export { playMonth, playMonths, availableOptions, firstChoice, type Strategy } from './headless';
export { coldestMonthFirewood, cohesionBand, crewSplit, ailingCount } from './display';
export { goalProgress, MEASURES, type GoalProgress, type PathProgress } from './goals/progress';
export { resolveSceneSpec } from './month/briefing';
export { sumLedger } from './month/month';
