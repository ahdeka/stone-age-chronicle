import { describe, expect, it } from 'vitest';
import { createTranslator } from './index';
import { koCount, koDays, koNum } from './numerals';

describe('우리말 수 읽기', () => {
  it('셈과 단위 앞의 꼴', () => {
    expect([1, 2, 3, 4, 12, 18, 34].map(koNum)).toEqual(['하나', '둘', '셋', '넷', '열둘', '열여덟', '서른넷']);
    expect([1, 3, 4, 14, 20, 21, 34].map(koCount)).toEqual(['한', '세', '네', '열네', '스무', '스물한', '서른네']);
    expect(koCount(150)).toBe('150');
  });

  it('날수', () => {
    expect([1, 2, 3, 10, 11, 18, 20, 23].map(koDays)).toEqual(['하루', '이틀', '사흘', '열흘', '열하루', '열여드레', '스무날', '스무사흘']);
    expect(koDays(0)).toBe('0일');
    expect(koDays(45)).toBe('45일');
  });

  it('번역기에서 {n:count} {n:days}로 쓴다', () => {
    const tr = createTranslator({ a: '{pop:count} 명, {d:days}분, {n}kg' });
    expect(tr.t('a', { pop: 34, d: 18, n: 520 })).toBe('서른네 명, 열여드레분, 520kg');
  });
});
