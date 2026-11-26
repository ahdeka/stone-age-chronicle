// 테스트 공용 도구

import { ch1 as realCh1 } from '../data/chapters/ch1/chapter';
import { applyCommand, availableOptions, createGame, findPolicy, firstChoice, playTurn, type ChapterDefinition, type Command, type GameState, type PolicyTemplate } from '../engine';

export const ch1 = realCh1;

/** 장 정의를 복제해 고친다 (원본은 그대로) */
export function tweakDef(fn: (d: ChapterDefinition) => void, base: ChapterDefinition = ch1): ChapterDefinition {
  const d = structuredClone(base);
  fn(d);
  return d;
}

/** 엔진 시험의 기본: 숨은 늦가을 프리셋 (시험 플레이 기록과 같은 상황) */
export const AUTUMN = 'grey_river_autumn';

export function newGame(seed = 'test', def: ChapterDefinition = ch1): GameState {
  return createGame(def, { seed, presetId: def.presets.some((p) => p.id === AUTUMN) ? AUTUMN : def.presets[0]!.id });
}

/** 화면에 보이는 기본 시작: 봄 (1년차 3월) */
export function springGame(seed = 'spring', def: ChapterDefinition = ch1): GameState {
  return createGame(def, { seed });
}

/** 명령을 적용한다. 거부되면 테스트를 실패시킨다 */
export function run(def: ChapterDefinition, s: GameState, cmd: Command): GameState {
  const next = structuredClone(s);
  const err = applyCommand(def, next, cmd);
  if (err) throw new Error(`command rejected: ${err} (${JSON.stringify(cmd)})`);
  return next;
}

function candidate(s: GameState, policyId: string) {
  const c = s.work.candidates.find((x) => x.policyId === policyId);
  if (!c) throw new Error(`policy not in candidates: ${policyId} (have ${s.work.candidates.map((x) => x.policyId).join(', ')})`);
  return c;
}

/** 식량 칸 후보 하나: 버티기 방침이 있으면 그것 (식량이 10일치 미만일 때만 나온다), 없으면 첫 번째 식량 후보 */
export function foodCandidate(def: ChapterDefinition, s: GameState) {
  const food = s.work.candidates.filter((x) => findPolicy(def, x.policyId).slot === 'food');
  const c = food.find((x) => findPolicy(def, x.policyId).fallback) ?? food[0];
  if (!c) throw new Error('no food candidate');
  return c;
}

/** 아무 식량 전략이나 고른다 (버티기가 있으면 버티기). 달을 넘기기만 하면 되는 시험용 */
export function pickFood(def: ChapterDefinition, s: GameState): GameState {
  return run(def, s, { type: 'choosePlan', uids: [foodCandidate(def, s).uid] });
}

/** 후보 중 이 전략을 고른다. 발전 전략만 주면 식량 칸은 foodCandidate로 채운다. growthId로 발전을 붙인다 */
export function pick(def: ChapterDefinition, s: GameState, policyId: string, growthId?: string): GameState {
  const c = candidate(s, policyId);
  const uids = [c.uid];
  if (findPolicy(def, c.policyId).slot === 'growth') uids.unshift(foodCandidate(def, s).uid);
  if (growthId) uids.push(candidate(s, growthId).uid);
  return run(def, s, { type: 'choosePlan', uids });
}

/** 결정 대기 중이면 이 선택지를 고른다 */
export function choose(def: ChapterDefinition, s: GameState, optionId: string): GameState {
  const d = s.work.decision;
  if (!d) throw new Error('no decision pending');
  return run(def, s, { type: 'chooseOption', uid: d.uid, optionId });
}

/** 마을에 머무는 단순한 방침 (원정대 없음, 판정 없음) */
export const STAY: PolicyTemplate = {
  id: 'test_stay',
  slot: 'food',
  category: 'test',
  appearsWhen: [],
  priority: 1000,
  cooldown: 0,
  scene: { bg: '{camp}' },
  steps: {},
};

/** 방침과 사건을 시험용으로 바꾼 장 정의 */
export function defWith(policies: PolicyTemplate[], fn?: (d: ChapterDefinition) => void): ChapterDefinition {
  return tweakDef((d) => {
    d.content.policies = [...policies, ...d.content.policies.filter((p) => p.fallback)];
    fn?.(d);
  });
}

export const sumLedger = (s: GameState, res: string, source?: string) =>
  s.work.ledger.filter((l) => l.res === res && (source === undefined || l.source === source)).reduce((a, l) => a + l.delta, 0);

/** 결정이 남아 있으면 고를 수 있는 첫 선택지로 끝까지 진행한다 (정산까지) */
export function finishMonth(def: ChapterDefinition, s: GameState, prefer: string[] = []): GameState {
  let cur = s;
  for (let guard = 0; guard < 10 && cur.step === 'decision'; guard++) {
    const opts = availableOptions(def, cur, cur.work.decision!);
    const id = prefer.find((p) => opts.includes(p)) ?? opts[0]!;
    cur = choose(def, cur, id);
  }
  return cur;
}

/** 턴마다 식량·장작·결속을 넉넉히 채워 준다 (멸족·분열 없이 원하는 턴까지 가기 위한 시험용) */
export function keepAlive(def: ChapterDefinition, s: GameState): void {
  for (const debug of [
    { op: 'setFood', kind: 'dried_meat', kg: 4000 },
    { op: 'setFirewood', kg: 600 },
    { op: 'setCohesion', value: 55 },
  ] as const) {
    const err = applyCommand(def, s, { type: 'debug', debug });
    if (err) throw new Error(err);
  }
}

/** 첫 계절 턴(2년차 봄)의 전략 고르기까지 진행한다. 1년차는 첫 번째 후보만 고른다 */
export function toFirstSeason(def: ChapterDefinition = ch1, s: GameState = springGame('season', def)): GameState {
  const cur = structuredClone(s);
  for (let guard = 0; guard < 30 && cur.work.turn.kind !== 'season'; guard++) {
    keepAlive(def, cur);
    playTurn(def, cur, firstChoice);
    if (cur.step === 'ended') throw new Error(`ended before season: ${cur.ending?.id}`);
    applyCommand(def, cur, { type: 'nextMonth' });
  }
  if (cur.work.turn.kind !== 'season') throw new Error('no season turn');
  keepAlive(def, cur);
  return cur;
}
