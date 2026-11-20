import { describe, expect, it } from 'vitest';
import { ch1, newGame, pick } from '../../test/fixtures';
import { firstChoice, playMonths } from '../headless';
import { createGame } from '../core/createGame';
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

  it('v1(재설계 M1) 저장 파일은 최신 버전으로 옮겨진다', () => {
    const s = newGame('mig');
    const v1 = structuredClone(s) as unknown as Record<string, unknown>;
    v1['saveVersion'] = 1;
    delete (v1['shelter'] as Record<string, unknown>)['units'];
    const w = v1['work'] as Record<string, unknown>;
    delete w['advice'];
    delete w['maxHunger'];
    for (const r of w['reports'] as Record<string, unknown>[]) delete r['rows'];
    const file = JSON.stringify({ format: SAVE_FORMAT, generation: 'monthly', saveVersion: 1, chapterId: 'ch1', savedAt: null, state: v1 });
    const r = deserialize(file);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.saveVersion).toBe(3);
    expect(r.state.shelter.units).toBe(1);
    expect(r.state.work.advice).toEqual([]);
    expect(r.state.work.reports[0]!.rows).toEqual([]);
  });

  it('v2 저장 파일은 v3으로 옮겨지고 부족 이름은 빈 문자열(= 기본 이름)이 된다', () => {
    const v2 = structuredClone(newGame('mig3')) as unknown as Record<string, unknown>;
    v2['saveVersion'] = 2;
    delete v2['tribeName'];
    const file = JSON.stringify({ format: SAVE_FORMAT, generation: 'monthly', saveVersion: 2, chapterId: 'ch1', savedAt: null, state: v2 });
    const r = deserialize(file);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.saveVersion).toBe(3);
    expect(r.state.tribeName).toBe('');
  });

  it('부족 이름이 저장 왕복에서 그대로 남는다', () => {
    const s = createGame(ch1, { seed: 'name', tribeName: '  흰여울   사람들 ' });
    expect(s.tribeName).toBe('흰여울 사람들');
    const r = deserialize(serialize(s));
    expect(r.ok && r.state.tribeName).toBe('흰여울 사람들');
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
