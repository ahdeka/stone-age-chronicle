// 재현성: 같은 시드 + 같은 커맨드 열 → 같은 결과. 헤드리스로 실제 1장(이벤트·카드 포함)을 끝까지 진행할 수 있어야 한다.

import { describe, expect, it } from 'vitest';
import { ch1Full as ch1, newGame, run } from '../test/fixtures';
import { cardStatus, optionStatuses } from './index';
import type { GameState } from './types';

/** 시드와 무관한 결정 규칙: 고를 수 있는 마지막 선택지, 쓸 수 있는 첫 카드 */
function playScript(seed: string): GameState {
  let s = newGame(seed, ch1);
  let guard = 0;
  while (s.phase !== 'ended') {
    if (++guard > 2000) throw new Error('no progress');
    if (s.phase === 'event') {
      const inst = s.events.pending[0]!;
      const opts = optionStatuses(ch1, s, inst).filter((o) => o.available);
      s = run(ch1, s, { type: 'chooseOption', eventUid: inst.uid, optionId: opts[opts.length - 1]!.option.id });
      continue;
    }
    const playable = s.deck.hand.find((c) => cardStatus(ch1, s, c).available);
    if (playable && s.actions.playsLeft > 0) {
      s = run(ch1, s, { type: 'playAction', cardUid: playable.uid });
      continue;
    }
    s = run(ch1, s, { type: 'endActionPhase' });
  }
  return s;
}

describe('replay determinism', () => {
  it('같은 시드와 같은 결정 규칙은 끝까지 완전히 같은 상태를 만든다', () => {
    const a = playScript('legend-1');
    const b = playScript('legend-1');
    expect(a.phase).toBe('ended');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('다른 시드는 다른 이야기를 만든다', () => {
    const a = playScript('legend-1');
    const b = playScript('legend-2');
    expect(a.chronicle.map((c) => c.key)).not.toEqual(b.chronicle.map((c) => c.key));
  });

  it('제한 턴 안에 끝나고, 턴마다 연대기 문장이 하나씩 남는다', () => {
    const s = playScript('limit');
    expect(s.ending?.turn).toBeLessThanOrEqual(ch1.balance.turnLimit);
    expect(s.chronicle).toHaveLength(s.history.length);
  });
});
