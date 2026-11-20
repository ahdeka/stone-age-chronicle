// 화면 스모크 테스트: 주요 상태(이벤트, 행동, 결말)를 서버 렌더링으로 그려 렌더 오류와 누락 문자열(⟨키⟩)을 잡는다.

import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { commonStrings, chapters } from '../data/registry';
import { reduce, type GameState } from '../engine';
import { ch1Full, newGame, resolveEvents, tweakDef } from '../test/fixtures';
import { I18nProvider } from './i18n';
import { GameScreen } from './screens/GameScreen';

const tables = [commonStrings.ko, chapters['ch1']!.strings.ko];

function render(state: GameState, def = ch1Full): string {
  return renderToString(
    <I18nProvider tables={tables}>
      <GameScreen def={def} state={state} onChange={() => {}} onQuit={() => {}} />
    </I18nProvider>,
  );
}

describe('GameScreen render', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  it('모든 이벤트를 하나씩 띄워도 누락 문자열 없이 그려진다', () => {
    const base = resolveEvents(ch1Full, newGame('render', ch1Full));
    for (const ev of ch1Full.content.events) {
      const r = reduce(ch1Full, base, { type: 'debug', debug: { op: 'forceEvent', eventId: ev.id } });
      if (r.error) continue; // 필요한 인물이 없는 이벤트 (예: 떠도는 마음의 젊은이)
      const html = render(r.state);
      expect(html, ev.id).not.toContain('⟨');
      expect(html).toContain('1~4');
    }
  });

  it('행동 단계: 손패와 연대기, 지난 계절 요약이 그려진다', () => {
    let s = resolveEvents(ch1Full, newGame('render2', ch1Full));
    s = reduce(ch1Full, s, { type: 'endActionPhase' }).state;
    s = resolveEvents(ch1Full, s);
    const html = render(s);
    expect(html).not.toContain('⟨');
    expect(html).toContain('제1대 족장 시절');
    expect(html).toContain('연대기');
  });

  it('결말 화면이 그려진다', () => {
    const def = tweakDef((d) => {
      d.content.endings = [{ id: 'survive_basic', kind: 'survival', priority: 0, check: [], powerSeeds: [] }];
    });
    const s = reduce(def, newGame('render3', def), { type: 'endActionPhase' }).state;
    expect(s.phase).toBe('ended');
    const html = render(s, def);
    expect(html).toContain('살아남은 무리');
    expect(html).not.toContain('⟨');
  });

  it('렌더 중 누락 키 경고가 없다', () => {
    expect(warn).not.toHaveBeenCalled();
  });
});
