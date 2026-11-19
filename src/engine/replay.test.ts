// 재현성: 같은 시드 + 같은 커맨드 열 → 같은 결과. 헤드리스로 끝까지 진행할 수 있어야 한다.

import { describe, expect, it } from 'vitest';
import { ch1, newGame, run } from '../test/fixtures';
import type { Command, GameState } from './types';

/** 시드와 무관한 고정 커맨드 열: 계절마다 배분을 바꿔 가며 끝까지 */
function playScript(seed: string): GameState {
  let s = newGame(seed);
  const plans: Record<string, number>[] = [
    { gather: 5, hunt: 4, craft: 1, ritual: 1, guard: 1 },
    { gather: 4, hunt: 5, craft: 1, ritual: 2, guard: 0 },
  ];
  let i = 0;
  while (s.phase !== 'ended') {
    const plan = { ...plans[i++ % plans.length]! };
    // 인구가 변했으면 차이를 채집에 몰아준다
    const sum = Object.values(plan).reduce((a, b) => a + b, 0);
    plan['gather'] = Math.max(0, plan['gather']! + (s.tribe.population - sum));
    const fixed = Object.values(plan).reduce((a, b) => a + b, 0) === s.tribe.population;
    const cmds: Command[] = fixed ? [{ type: 'setRoles', roles: plan }] : [];
    cmds.push({ type: 'endActionPhase' });
    for (const c of cmds) s = run(ch1, s, c);
  }
  return s;
}

describe('replay determinism', () => {
  it('같은 시드와 같은 커맨드는 48턴 끝까지 완전히 같은 상태를 만든다', () => {
    const a = playScript('legend-1');
    const b = playScript('legend-1');
    expect(a.phase).toBe('ended');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('다른 시드는 다른 결과를 만든다 (사냥 변동)', () => {
    const a = playScript('legend-1');
    const b = playScript('legend-2');
    expect(a.tribe.resources).not.toEqual(b.tribe.resources);
  });

  it('제한 턴에 정확히 끝난다', () => {
    const s = playScript('limit');
    expect(s.ending?.turn).toBeLessThanOrEqual(ch1.balance.turnLimit);
    if (s.ending?.kind === 'survival') expect(s.turn).toBe(ch1.balance.turnLimit);
  });
});
