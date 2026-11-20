// 화면 스모크 테스트: 주요 단계(방침, 사건, 남은 고기, 정산, 결말)를 서버 렌더링으로 그려
// 렌더 오류와 누락 문자열(⟨키⟩)을 잡는다.

import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { chapters, commonStrings } from '../data/registry';
import { reduce, type GameState } from '../engine';
import { ch1, choose, newGame, pick, run } from '../test/fixtures';
import { I18nProvider } from './i18n';
import { StatusScreen } from './screens/StatusScreen';

const tables = [commonStrings.ko, chapters['ch1']!.strings.ko];

function render(state: GameState): string {
  return renderToString(
    <I18nProvider tables={tables}>
      <StatusScreen def={ch1} state={state} onChange={() => {}} onQuit={() => {}} />
    </I18nProvider>,
  );
}

describe('상태 화면', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  it('방침 선택 단계: 월초 보고와 후보가 그려진다', () => {
    const html = render(newGame('ui'));
    expect(html).toContain('순록 떼 대사냥');
    expect(html).toContain('낙엽달');
    expect(html).not.toContain('⟨');
  });

  it('모든 사건을 하나씩 띄워도 누락 문자열 없이 그려진다', () => {
    const base = newGame('ui');
    for (const ev of ch1.content.events) {
      const r = reduce(ch1, base, { type: 'debug', debug: { op: 'forceEvent', eventId: ev.id } });
      expect(r.error, ev.id).toBeUndefined();
      expect(render(r.state), ev.id).not.toContain('⟨');
    }
  });

  it('대사냥 한 달을 끝까지: 사건, 남은 고기, 정산, 다음 달', () => {
    let s = pick(ch1, newGame('ui-hunt'), 'reindeer_big_hunt');
    for (let guard = 0; guard < 5 && s.step === 'decision'; guard++) {
      expect(render(s)).not.toContain('⟨');
      const d = s.work.decision!;
      s = choose(ch1, s, d.kind === 'leftover' ? 'cache' : 'keep_fires');
    }
    expect(s.step).toBe('settlement');
    const html = render(s);
    expect(html).toContain('월말 정산');
    expect(html).not.toContain('⟨');
    expect(render(run(ch1, s, { type: 'nextMonth' }))).not.toContain('⟨');
  });

  it('결말 화면이 그려진다', () => {
    let s = newGame('ui-end');
    s.cohesion = 1;
    s.counters['low_cohesion_months'] = 2;
    s = pick(ch1, s, 'hold_and_ration');
    expect(s.step).toBe('ended');
    const html = render(s);
    expect(html).toContain('흩어진 사람들');
    expect(html).not.toContain('⟨');
  });

  it('렌더 중 누락 키 경고가 없다', () => {
    expect(warn).not.toHaveBeenCalled();
  });
});
