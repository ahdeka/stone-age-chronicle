// 테스트 공용 도구

import { ch1 as realCh1 } from '../data/chapters/ch1/chapter';
import { applyCommand, createGame, type ChapterDefinition, type Command, type GameState, type PolicyTemplate } from '../engine';

export const ch1 = realCh1;

/** 장 정의를 복제해 고친다 (원본은 그대로) */
export function tweakDef(fn: (d: ChapterDefinition) => void, base: ChapterDefinition = ch1): ChapterDefinition {
  const d = structuredClone(base);
  fn(d);
  return d;
}

export function newGame(seed = 'test', def: ChapterDefinition = ch1): GameState {
  return createGame(def, { seed });
}

/** 명령을 적용한다. 거부되면 테스트를 실패시킨다 */
export function run(def: ChapterDefinition, s: GameState, cmd: Command): GameState {
  const next = structuredClone(s);
  const err = applyCommand(def, next, cmd);
  if (err) throw new Error(`command rejected: ${err} (${JSON.stringify(cmd)})`);
  return next;
}

/** 후보 중 이 방침을 고른다 */
export function pick(def: ChapterDefinition, s: GameState, policyId: string): GameState {
  const c = s.work.candidates.find((x) => x.policyId === policyId);
  if (!c) throw new Error(`policy not in candidates: ${policyId} (have ${s.work.candidates.map((x) => x.policyId).join(', ')})`);
  return run(def, s, { type: 'choosePolicy', uid: c.uid });
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
