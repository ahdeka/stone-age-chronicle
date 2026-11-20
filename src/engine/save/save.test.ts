import { describe, expect, it } from 'vitest';
import { ch1, newGame, pick } from '../../test/fixtures';
import { firstChoice, playMonths } from '../headless';
import { deserialize, serialize, SAVE_FORMAT } from './save';

describe('저장/불러오기', () => {
  it('결정 대기 중에 저장해도 그대로 돌아오고, 이어서 진행한 결과가 같다', () => {
    const a = pick(ch1, newGame('save'), 'reindeer_big_hunt');
    const r = deserialize(serialize(a, '2026-11-20T00:00:00Z'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.savedAt).toBe('2026-11-20T00:00:00Z');
    expect(r.state).toEqual(a);
    const b = r.state;
    playMonths(ch1, a, firstChoice, 4);
    playMonths(ch1, b, firstChoice, 4);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('이전 설계(카드 방식)의 저장 파일은 거부한다', () => {
    const old = JSON.stringify({ format: SAVE_FORMAT, saveVersion: 2, chapterId: 'ch1', savedAt: null, state: { turn: 3 } });
    expect(deserialize(old)).toEqual({ ok: false, error: 'error.save.oldDesign' });
  });

  it('JSON이 아니거나, 형식이 다르거나, 더 새 버전이거나, 깨진 파일은 거부한다', () => {
    expect(deserialize('{')).toEqual({ ok: false, error: 'error.save.notJson' });
    expect(deserialize('{"format":"x"}')).toEqual({ ok: false, error: 'error.save.format' });
    const good = JSON.parse(serialize(newGame())) as Record<string, unknown>;
    expect(deserialize(JSON.stringify({ ...good, saveVersion: 999 }))).toEqual({ ok: false, error: 'error.save.newer' });
    expect(deserialize(JSON.stringify({ ...good, state: { chapterId: 'ch1' } }))).toEqual({ ok: false, error: 'error.save.corrupt' });
  });
});
