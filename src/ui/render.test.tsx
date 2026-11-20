// 화면 스모크 테스트: 주요 화면(인트로, 상황 화면, 결정 팝업, 진행 단계, 정산, 결말)을 서버 렌더링으로 그려
// 렌더 오류와 누락 문자열(⟨키⟩)을 잡는다. 타이핑 전 상태라도 화면 읽기용 전체 글이 들어 있다.

import { renderToString } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { chapters, commonStrings } from '../data/registry';
import { reduce, type GameState } from '../engine';
import { createTranslator } from '../i18n';
import { ch1, choose, newGame, pick } from '../test/fixtures';
import { decisionModel, DecisionPopup } from './components/Decision';
import { I18nProvider } from './i18n';
import { MotionProvider } from './motion';
import { EndingScreen } from './screens/EndingScreen';
import { IntroScreen } from './screens/IntroScreen';
import { PhaseScreen } from './screens/PhaseScreen';
import { SituationScreen } from './screens/SituationScreen';
import { TitleScreen } from './screens/TitleScreen';

const tables = [commonStrings.ko, chapters['ch1']!.strings.ko];
const tr = createTranslator(...tables);
const noop = () => {};

function html(node: ReactNode): string {
  return renderToString(
    <MotionProvider>
      <I18nProvider tables={tables}>{node}</I18nProvider>
    </MotionProvider>,
  );
}

function sheet(s: GameState): string {
  const model = decisionModel(tr, ch1, s);
  if (!model) throw new Error('no decision');
  return html(<DecisionPopup model={model} open setOpen={noop} send={noop} />);
}

/** 대사냥 한 달을 사건과 남은 고기를 처리하며 끝까지 진행하고, 지나간 상태들을 모은다 */
function huntMonth(): GameState[] {
  const states: GameState[] = [];
  let s = pick(ch1, newGame('ui-hunt'), 'reindeer_big_hunt');
  states.push(s);
  for (let guard = 0; guard < 5 && s.step === 'decision'; guard++) {
    s = choose(ch1, s, s.work.decision!.kind === 'leftover' ? 'cache' : 'keep_fires');
    states.push(s);
  }
  return states;
}

describe('화면', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  it('시작 화면과 인트로', () => {
    const s = newGame('ui');
    const t = html(<TitleScreen scene={ch1.scenes.intro} canContinue onContinue={noop} onStart={noop} onLoad={noop} />);
    expect(t).not.toContain('⟨');
    const i = html(<IntroScreen def={ch1} state={s} onStart={noop} />);
    expect(i).toContain('서른네 명. 성인 열여덟, 노인 넷, 아이 열둘.');
    expect(i).toContain('남은 식량은 열여드레분.');
    expect(i).toContain('가죽 천막 다섯 채');
    expect(i).not.toContain('⟨');
  });

  it('월초 상황 화면: 머리글, 땅, 사람들, 시대 목표, 연대기 첫 문장', () => {
    const s = newGame('ui');
    const h = html(<SituationScreen def={ch1} state={s} send={noop} />);
    expect(h).toContain('순록 떼가 내려오고, 늑대가 가까이 있다');
    expect(h).toContain('잿빛강 땅');
    expect(h).toContain('바위');
    expect(h).toContain('식량 안정');
    expect(h).toContain('서른네 명이 첫 겨울을 앞두고 있었다');
    expect(h).toContain('방침 정하기');
    expect(h).not.toContain('⟨');
  });

  it('방침 팝업: 핵심 칩, 조언자 대사, 위험 배지, 대가, 투입 인원', () => {
    const h = sheet(newGame('ui'));
    expect(h).toContain('이번 달의 방침');
    expect(h).toContain('순록 떼 보름 안에 지나감');
    expect(h).toContain('순록 떼를 놓치면 겨울을 못 넘깁니다');
    expect(h).toMatch(/원정 14명 · 마을 \d+명 · 이끄는 사람 바위/);
    expect(h).toContain('그동안 마을이 비고');
    expect(h).not.toContain('⟨');
  });

  it('모든 사건을 팝업으로 띄워도 누락 문자열이 없다', () => {
    const base = newGame('ui');
    for (const ev of ch1.content.events) {
      const r = reduce(ch1, base, { type: 'debug', debug: { op: 'forceEvent', eventId: ev.id } });
      expect(r.error, ev.id).toBeUndefined();
      expect(sheet(r.state), ev.id).not.toContain('⟨');
      expect(html(<SituationScreen def={ch1} state={r.state} send={noop} />), ev.id).not.toContain('⟨');
    }
  });

  it('진행 화면: 대사냥 한 달의 모든 단계와 결정 팝업, 정산', () => {
    const states = huntMonth();
    const end = states[states.length - 1]!;
    expect(end.step).toBe('settlement');
    for (const s of states) {
      if (s.step === 'decision') expect(sheet(s)).not.toContain('⟨');
    }
    end.work.reports.forEach((_, i) => {
      if (i === 0) return;
      const h = html(<PhaseScreen def={ch1} state={end} index={i} onNext={noop} send={noop} />);
      expect(h, `report ${i}`).not.toContain('⟨');
    });
    const early = html(<PhaseScreen def={ch1} state={end} index={1} onNext={noop} send={noop} />);
    expect(early).toContain('상순 · 1~10일');
    expect(early).toContain('초원의 여울');
    const settle = html(<PhaseScreen def={ch1} state={end} index={end.work.reports.length - 1} onNext={noop} send={noop} />);
    expect(settle).toContain('월말 정산');
  });

  it('결말 화면', () => {
    let s = newGame('ui-end');
    s.cohesion = 1;
    s.counters['low_cohesion_months'] = 2;
    s = pick(ch1, s, 'hold_and_ration');
    expect(s.step).toBe('ended');
    const h = html(<EndingScreen def={ch1} state={s} onQuit={noop} />);
    expect(h).toContain('흩어진 사람들');
    expect(h).not.toContain('⟨');
  });

  it('렌더 중 누락 키 경고가 없다', () => {
    expect(warn).not.toHaveBeenCalled();
  });
});
