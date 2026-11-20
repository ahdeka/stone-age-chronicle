import { describe, expect, it } from 'vitest';
import { createTranslator } from './index';
import { finalSound, josa, withJosa } from './josa';
import { koCount, koDays, koNum } from './numerals';

describe('수 표기 (화면은 아라비아 숫자, 이야기의 작은 수만 우리말)', () => {
  it('10 이하만 우리말, 넘으면 아라비아 숫자', () => {
    expect([1, 2, 3, 10, 11, 18].map(koNum)).toEqual(['하나', '둘', '셋', '열', '11', '18']);
    expect([1, 3, 4, 10, 14, 150].map(koCount)).toEqual(['한 ', '세 ', '네 ', '열 ', '14', '150']);
    expect(koCount(0)).toBe('0');
  });

  it('며칠치는 늘 아라비아 숫자', () => {
    expect([0, 4, 18, 45].map(koDays)).toEqual(['0일치', '4일치', '18일치', '45일치']);
  });

  it('번역기: {n:count}마리는 우리말일 때만 띄어 쓴다', () => {
    const tr = createTranslator([{ a: '순록 {n:count}마리, {d:days}, {k}kg' }]);
    expect(tr.t('a', { n: 3, d: 18, k: 520 })).toBe('순록 세 마리, 18일치, 520kg');
    expect(tr.t('a', { n: 14, d: 4, k: 120 })).toBe('순록 14마리, 4일치, 120kg');
  });
});

describe('조사 서식', () => {
  it('받침을 본다: 없음, ㄹ, 그 밖', () => {
    expect(['바위', '사람들', '부족', '이끼', '솔', '7', '3', 'abc'].map(finalSound)).toEqual([
      'none',
      'rieul',
      'other',
      'none',
      'rieul',
      'rieul',
      'other',
      undefined,
    ]);
  });

  it('은/는, 이/가, 을/를, 와/과, 으로/로, 아/야 — 어느 꼴로 써도 같다', () => {
    expect(['은', '는'].map((f) => josa('바위', f))).toEqual(['는', '는']);
    expect(['이', '가', '을', '와', '으로', '아'].map((f) => josa('부족', f))).toEqual(['이', '이', '을', '과', '으로', '아']);
    expect(['이', '을', '와', '아'].map((f) => josa('이끼', f))).toEqual(['가', '를', '와', '야']);
  });

  it('ㄹ 받침 뒤의 으로는 로', () => {
    expect(withJosa('잿빛강 사람들', '으로')).toBe('잿빛강 사람들로');
    expect(withJosa('새벽불 부족', '으로')).toBe('새벽불 부족으로');
    expect(withJosa('솔', '으로')).toBe('솔로');
    expect(withJosa('노을', '은')).toBe('노을은');
  });

  it('받침을 모르면 둘 다 쓴다', () => {
    expect(withJosa('Ash', '은')).toBe('Ash은(는)');
  });

  it('번역기: {tribe:은}은 전역 변수와 함께 쓴다', () => {
    const tr = createTranslator([{ a: '{tribe:은} 강을 건넜다.', b: '{name:이} 왔다.', c: '{tribe}' }], { tribe: '흰여울 사람들' });
    expect(tr.t('a')).toBe('흰여울 사람들은 강을 건넜다.');
    expect(tr.t('b', { name: '바위' })).toBe('바위가 왔다.');
    expect(tr.t('c', { tribe: '새벽불 부족' })).toBe('새벽불 부족');
  });
});
