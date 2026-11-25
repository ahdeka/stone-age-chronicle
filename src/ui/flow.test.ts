import { describe, expect, it } from 'vitest';
import { autoAdvanceDue, canPause, progressAction, screenKey, type AutoAdvanceInput } from './flow';

const base: AutoAdvanceInput = { auto: true, paused: false, hasNext: true, deciding: false, run: 0, end: 4000, delay: 1500 };

describe('자동 진행', () => {
  it('서술이 끝나고 쉬는 시간이 지나야 넘어간다', () => {
    expect(autoAdvanceDue({ ...base, run: 3999 })).toBe(false);
    expect(autoAdvanceDue({ ...base, run: 5499 })).toBe(false);
    expect(autoAdvanceDue({ ...base, run: 5500 })).toBe(true);
  });

  it('결정 팝업과 이달의 결과(다음 보고 없음)에서는 멈춘다', () => {
    expect(autoAdvanceDue({ ...base, run: 9999, deciding: true })).toBe(false);
    expect(autoAdvanceDue({ ...base, run: 9999, hasNext: false })).toBe(false);
  });

  it('한 순씩 넘기기를 켜거나 일시정지하면 넘어가지 않는다', () => {
    expect(autoAdvanceDue({ ...base, run: 9999, auto: false })).toBe(false);
    expect(autoAdvanceDue({ ...base, run: 9999, paused: true })).toBe(false);
  });

  it('일시정지 버튼은 저절로 넘어갈 수 있는 화면에만 있다', () => {
    expect(canPause(true, true, false)).toBe(true);
    expect(canPause(false, true, false)).toBe(false);
    expect(canPause(true, false, false)).toBe(false);
    expect(canPause(true, true, true)).toBe(false);
  });
});

describe('진행 화면 버튼 (계속 버튼 없음)', () => {
  const b = { done: true, deciding: false, toResult: false, hasNext: true, auto: true };
  it('글이 나오는 중에는 글 바로 보기', () => {
    expect(progressAction({ ...b, done: false })).toBe('skip');
    expect(progressAction({ ...b, done: false, toResult: true })).toBe('skip');
  });
  it('하순 글이 다 나오면 결과 보기로 바뀐다', () => {
    expect(progressAction({ ...b, hasNext: false, toResult: true })).toBe('result');
    expect(progressAction({ ...b, hasNext: false, toResult: true, auto: false })).toBe('result');
  });
  it('결정을 기다리면 결정하기', () => {
    expect(progressAction({ ...b, hasNext: false, deciding: true })).toBe('decide');
  });
  it('저절로 넘어가는 순 끝에서는 누를 버튼이 없고, 한 순씩 넘기기면 이어서 보기', () => {
    expect(progressAction(b)).toBe('skipDone');
    expect(progressAction({ ...b, auto: false })).toBe('nextPhase');
  });
});

describe('스크롤 열쇠', () => {
  it('새 달, 진행 화면 진입, 순 바뀜, 이달의 결과마다 달라진다', () => {
    const keys = [screenKey('situation', 3), screenKey('progress', 3, 1), screenKey('progress', 3, 2), screenKey('progress', 3, 4), screenKey('situation', 4)];
    expect(new Set(keys).size).toBe(keys.length);
    expect(screenKey('progress', 3, 2)).toBe(screenKey('progress', 3, 2));
  });
});
