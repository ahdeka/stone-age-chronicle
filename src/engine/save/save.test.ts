import { describe, expect, it } from 'vitest';
import { ch1, endTurns, newGame } from '../../test/fixtures';
import { deserialize, migrations, serialize } from './save';
import { SAVE_VERSION } from './version';

describe('save / load', () => {
  it('왕복하면 상태가 완전히 같다', () => {
    const s = endTurns(ch1, newGame('save'), 7);
    const r = deserialize(serialize(s, '2026-11-19T00:00:00Z'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state).toEqual(s);
    expect(r.savedAt).toBe('2026-11-19T00:00:00Z');
  });

  it('불러온 상태에서 이어 진행해도 원래 진행과 같다 (RNG 포함)', () => {
    const s = endTurns(ch1, newGame('continue'), 5);
    const r = deserialize(serialize(s));
    if (!r.ok) throw new Error(r.error);
    expect(endTurns(ch1, r.state, 10)).toEqual(endTurns(ch1, s, 10));
  });

  it('깨진 파일은 오류 키로 거부한다', () => {
    expect(deserialize('{nope')).toEqual({ ok: false, error: 'error.save.notJson' });
    expect(deserialize('{"format":"other"}')).toEqual({ ok: false, error: 'error.save.format' });
    const file = JSON.parse(serialize(newGame()));
    delete file.state.tribe;
    expect(deserialize(JSON.stringify(file))).toEqual({ ok: false, error: 'error.save.corrupt' });
  });

  it('더 새로운 버전 파일은 거부한다', () => {
    const file = JSON.parse(serialize(newGame()));
    file.saveVersion = SAVE_VERSION + 1;
    expect(deserialize(JSON.stringify(file))).toEqual({ ok: false, error: 'error.save.newer' });
  });

  it('옛 버전 파일은 마이그레이션을 순서대로 적용한다', () => {
    const file = JSON.parse(serialize(newGame()));
    file.saveVersion = 0;
    file.state.saveVersion = 0;
    migrations[0] = (st) => ({ ...st, migratedFrom0: true });
    try {
      const r = deserialize(JSON.stringify(file));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.state.saveVersion).toBe(SAVE_VERSION);
      expect((r.state as unknown as Record<string, unknown>)['migratedFrom0']).toBe(true);
    } finally {
      delete migrations[0];
    }
  });
});
