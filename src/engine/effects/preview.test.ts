import { describe, expect, it } from 'vitest';
import { ch1, newGame } from '../../test/fixtures';
import { previewEffects } from './preview';

describe('effect preview', () => {
  const s = newGame();

  it('확실한 효과는 수치로 합쳐 보여 주고 플래그와 연대기는 숨긴다', () => {
    const items = previewEffects(ch1, s, [
      { type: 'resource', key: 'food', delta: -3 },
      { type: 'resource', key: 'food', delta: -2 },
      { type: 'axis', axis: 'share_hierarchy', delta: -5 },
      { type: 'flag', id: 'secret', set: true },
      { type: 'chronicle', key: 'x', importance: 1 },
    ]);
    expect(items).toEqual([
      { kind: 'resource', key: 'food', delta: -5 },
      { kind: 'axis', axis: 'share_hierarchy', delta: -5 },
    ]);
  });

  it('check는 확률과 성공/실패 결과를, 예약은 "나중"으로만 보여 준다', () => {
    const items = previewEffects(ch1, s, [
      { type: 'check', power: [{ source: 'const', value: 0 }], difficulty: 0, success: [{ type: 'resource', key: 'food', delta: 5 }], failure: [] },
      { type: 'schedule', eventId: 'x', delay: 2 },
      { type: 'delayed', delay: 1, effects: [] },
    ]);
    expect(items[0]).toMatchObject({ kind: 'chance', p: 0.5, success: [{ kind: 'resource', key: 'food', delta: 5 }] });
    expect(items.filter((i) => i.kind === 'later')).toHaveLength(1);
  });

  it('if는 지금 상태로 가지를 골라 보여 준다', () => {
    const items = previewEffects(ch1, s, [
      { type: 'if', when: [{ type: 'season', in: ['winter'] }], then: [{ type: 'resource', key: 'food', delta: 1 }], else: [{ type: 'resource', key: 'food', delta: 9 }] },
    ]);
    expect(items).toEqual([{ kind: 'resource', key: 'food', delta: 9 }]);
  });

  it('미리보기는 상태와 난수를 바꾸지 않는다', () => {
    const before = JSON.stringify(s);
    previewEffects(ch1, s, [{ type: 'random', outcomes: [{ weight: 1, effects: [] }] }]);
    expect(JSON.stringify(s)).toBe(before);
  });
});
