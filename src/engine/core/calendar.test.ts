import { describe, expect, it } from 'vitest';
import { ch1, newGame, tweakDef } from '../../test/fixtures';
import { calendarDate } from './lookup';

describe('화면 날짜 (1년차 · 봄 · 3월)', () => {
  it('녹는달은 3월, 서리달은 12월, 얼음달은 2월이고 년차는 3월에 바뀐다', () => {
    const s = newGame('cal');
    s.startMonthIndex = 0; // 녹는달 시작 (봄 시작 프리셋)
    const at = (m: number) => calendarDate(ch1, s, m);
    expect(at(1)).toMatchObject({ year: 1, season: 'spring', number: 3, monthId: 'thaw' });
    expect(at(10)).toMatchObject({ year: 1, season: 'winter', number: 12, monthId: 'frost' });
    expect(at(11)).toMatchObject({ year: 1, number: 1, monthId: 'snow' });
    expect(at(12)).toMatchObject({ year: 1, number: 2, monthId: 'ice' });
    expect(at(13)).toMatchObject({ year: 2, season: 'spring', number: 3 });
  });

  it('늦가을에 시작해도 시작 달이 1년차이고, 다음 3월에 2년차가 된다', () => {
    const s = newGame('cal2');
    s.startMonthIndex = 8; // 낙엽달 (숨은 테스트 프리셋)
    expect(calendarDate(ch1, s, 1)).toMatchObject({ year: 1, number: 11 });
    expect(calendarDate(ch1, s, 4)).toMatchObject({ year: 1, number: 2 });
    expect(calendarDate(ch1, s, 5)).toMatchObject({ year: 2, number: 3 });
  });

  it('숨은 프리셋은 기본으로 고르지 않는다', () => {
    const def = tweakDef((d) => {
      const hidden = { ...structuredClone(d.presets[0]!), id: 'hidden_one', hidden: true, startMonthIndex: 3 };
      d.presets.unshift(hidden);
    });
    expect(newGame('h', def).presetId).toBe(ch1.presets[0]!.id);
  });
});
