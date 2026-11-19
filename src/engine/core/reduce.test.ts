import { describe, expect, it } from 'vitest';
import { ch1, endTurns, newGame, tweakDef } from '../../test/fixtures';
import { reduce } from './reduce';

describe('reduce', () => {
  it('입력 상태를 바꾸지 않는다', () => {
    const s = newGame();
    const snapshot = JSON.stringify(s);
    reduce(ch1, s, { type: 'endActionPhase' });
    reduce(ch1, s, { type: 'setRoles', roles: { gather: 12, hunt: 0, craft: 0, ritual: 0, guard: 0 } });
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('역할 배분: 합계가 인구와 다르면 거부하고 상태는 그대로', () => {
    const s = newGame();
    const r = reduce(ch1, s, { type: 'setRoles', roles: { gather: 13, hunt: 0, craft: 0, ritual: 0, guard: 0 } });
    expect(r.error).toBe('error.roles.sum');
    expect(r.state).toBe(s);
  });

  it('역할 배분: 음수, 소수, 모르는 역할은 거부', () => {
    const s = newGame();
    expect(reduce(ch1, s, { type: 'setRoles', roles: { gather: 13, hunt: -1, craft: 0, ritual: 0, guard: 0 } }).error).toBe(
      'error.roles.invalid',
    );
    expect(reduce(ch1, s, { type: 'setRoles', roles: { gather: 11.5, hunt: 0.5 } }).error).toBe('error.roles.invalid');
    expect(reduce(ch1, s, { type: 'setRoles', roles: { gather: 11, dance: 1 } }).error).toBe('error.roles.unknown');
  });

  it('끝난 게임과 다른 장의 상태는 거부', () => {
    const def = tweakDef((d) => {
      d.content.endings = [{ id: 'x', kind: 'survival', priority: 0, check: [], powerSeeds: [] }];
    });
    const ended = endTurns(def, newGame('e', def), 1);
    expect(ended.phase).toBe('ended');
    expect(reduce(def, ended, { type: 'endActionPhase' }).error).toBe('error.gameEnded');

    const other = tweakDef((d) => {
      d.id = 'other';
    });
    expect(reduce(other, newGame(), { type: 'endActionPhase' }).error).toBe('error.chapterMismatch');
  });
});
