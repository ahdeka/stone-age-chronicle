// 화면 스모크 테스트: 주요 화면(인트로, 상황 화면, 결정 팝업, 진행 단계, 정산, 결말)을 서버 렌더링으로 그려
// 렌더 오류와 누락 문자열(⟨키⟩)을 잡는다. 타이핑 전 상태라도 화면 읽기용 전체 글이 들어 있다.

import { renderToString } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { chapters, commonStrings } from '../data/registry';
import { availableOptions, createGame, reduce, type GameState } from '../engine';
import { createTranslator } from '../i18n';
import { ch1, choose, finishMonth, newGame, pick, springGame } from '../test/fixtures';
import { decisionModel, DecisionPopup } from './components/Decision';
import { PlanBody } from './components/DecisionSheet';
import { I18nProvider } from './i18n';
import { MotionProvider } from './motion';
import { EndingScreen } from './screens/EndingScreen';
import { IntroScreen } from './screens/IntroScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { ResultScreen } from './screens/ResultScreen';
import { SituationScreen } from './screens/SituationScreen';
import { TitleScreen } from './screens/TitleScreen';
import { eventLead, orderRows } from './story';

const tables = [commonStrings.ko, chapters['ch1']!.strings.ko];
const tr = createTranslator(tables, { tribe: '잿빛강 사람들' });
const noop = () => {};

function html(node: ReactNode, tribe = '잿빛강 사람들'): string {
  return renderToString(
    <MotionProvider>
      <I18nProvider tables={tables} globals={{ tribe }}>
        {node}
      </I18nProvider>
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
    const opts = availableOptions(ch1, s, s.work.decision!);
    const want = s.work.decision!.kind === 'leftover' ? 'cache' : 'keep_fires';
    s = choose(ch1, s, opts.includes(want) ? want : opts[0]!);
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
    // 부족 이름 입력은 보류했다 (기본 이름으로 시작)
    expect(t).not.toContain('부족 이름');
    expect(s.tribeName).toBe('');
    const i = html(<IntroScreen def={ch1} state={s} onStart={noop} />);
    // 인트로 4줄 (4차 피드백)
    expect(i).toContain('가죽 천막 다섯 채, 34명.');
    expect(i).toContain('남은 식량은 18일치.');
    expect(i).toContain('당신은 잿빛강 사람들의 족장이다.');
    expect(i).not.toContain('⟨');
  });

  it('내부 기반: 다른 부족 이름도 인트로, 연대기, 결말에 조사와 함께 들어간다', () => {
    const s = createGame(ch1, { seed: 'ui-name', tribeName: '새벽불 부족' });
    const i = html(<IntroScreen def={ch1} state={s} onStart={noop} />, s.tribeName);
    expect(i).toContain('당신은 새벽불 부족의 족장이다.');
    expect(i).not.toContain('잿빛강 사람들');
    const h = html(<SituationScreen def={ch1} state={s} send={noop} />, s.tribeName);
    expect(h).toContain('새벽불 부족 34명이');
    expect(h).toContain('잿빛강 땅');
    let e = structuredClone(s);
    e.cohesion = 1;
    e.counters['low_cohesion_months'] = 2;
    e = pick(ch1, e, 'hold_and_ration');
    expect(html(<EndingScreen def={ch1} state={e} onQuit={noop} />, s.tribeName)).toContain('새벽불 부족은 서로를 믿지 못해');
  });

  it('월초 상황 화면: 머리글, 땅, 사람들, 시대 목표, 연대기 첫 문장', () => {
    const s = newGame('ui');
    const h = html(<SituationScreen def={ch1} state={s} send={noop} />);
    expect(h).toContain('순록 떼가 내려오고, 늑대가 가까이 있다');
    expect(h).toContain('잿빛강 땅');
    expect(h).toContain('바위');
    expect(h).toContain('식량 안정');
    expect(h).toContain('잿빛강 사람들 34명이 첫 겨울을 앞두고 있었다');
    expect(h).toContain('1년차 11월');
    expect(h).toContain('전략 정하기');
    // 사람들: 주요 인물 4명과 비율·일손. 부족원 개인 명단은 화면에 없다 (3차 피드백)
    expect(h).toContain('그중 일손');
    expect(h).toContain('다친 사람');
    expect(h).not.toContain('부족원 명단');
    expect(h).not.toContain('⟨');
  });

  it('방침 팝업: 핵심 칩, 조언자 대사, 위험 배지, 대가, 투입 인원', () => {
    const h = sheet(newGame('ui'));
    expect(h).toContain('이번 달 전략');
    expect(h).toContain('순록 떼 15일 안에 지나감');
    expect(h).toContain('1년차 · 가을 · 11월');
    expect(h).toContain('18일치');
    expect(h).toContain('순록 떼를 놓치면 겨울을 못 넘깁니다');
    expect(h).toMatch(/나가는 사람 14명 · 남는 사람 \d+명 · 이끄는 사람 바위/);
    expect(h).toContain('그동안 마을이 비고');
    // ①단계 (4차 피드백): 단계 표시, 식량 카드, 큰 일 줄, "다음: 발전 고르기". 발전 카드는 ②단계에
    expect(h).toContain('식량 전략');
    expect(h).toContain('전략 고르기 단계');
    expect(h).toContain('다음: 발전 고르기');
    expect(h).not.toContain('발전하지 않는다');
    expect(h).toContain(tr.t('policy.reindeer_big_hunt.brief'));
    expect(h).not.toContain('⟨');
  });

  it('전략 팝업 ②단계: 고른 식량 한 줄, 일손 막대, 발전 카드와 "발전하지 않는다"', () => {
    const s = springGame('ui-step2');
    const model = decisionModel(tr, ch1, s)!;
    const food = model.choices.find((c) => c.group === 'food')!;
    const picked = [food.id];
    const growthInfo = new Map(model.choices.filter((c) => c.group === 'growth').map((c) => [c.id, model.plan!.growthMeta(food.id, c.id)]));
    const h = html(<PlanBody model={model} step={2} picked={picked} labor={model.plan!.labor(picked)} growthInfo={growthInfo} majorPicked={false} onPick={noop} onStep={noop} />);
    expect(h).toContain(`식량: ${food.title}`);
    expect(h).toContain('바꾸기');
    expect(h).toContain('발전 전략');
    expect(h).toContain('발전하지 않는다');
    expect(h).toMatch(/발전 \d+명/);
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
    const last = end.work.reports.length - 1;
    end.work.reports.forEach((_, i) => {
      if (i === 0 || i === last) return;
      const h = html(<ProgressScreen def={ch1} state={end} index={i} onNext={noop} send={noop} />);
      expect(h, `report ${i}`).not.toContain('⟨');
      // 진행 중에는 장부가 없고 지표는 월초 기준이다
      expect(h, `report ${i}`).not.toContain('식량 장부');
      expect(h, `report ${i}`).toContain('월초 기준');
    });
    const early = html(<ProgressScreen def={ch1} state={end} index={1} onNext={noop} send={noop} />);
    expect(early).toContain('상순 · 1~10일');
    expect(early).toContain('순록 떼 대사냥');
    expect(early).toContain('글 바로 보기');
    // 세 순은 한 칸에 쌓인다: 하순 화면에도 상순·중순 소제목이 그대로 있다 (4차 피드백)
    const late = html(<ProgressScreen def={ch1} state={end} index={last - 1} onNext={noop} send={noop} />);
    expect(late).toContain('상순 · 1~10일');
    expect(late).toContain('중순 · 11~20일');
    expect(late).toContain('하순 · 21~30일');
    const result = html(<ResultScreen def={ch1} state={end} onNext={noop} />);
    expect(result).toContain('이달의 결과');
    expect(result).toContain('식량 장부');
    expect(result).toContain('최종');
    expect(result).toMatch(/식량 [\d,]+kg · \d+일치/);
    expect(result).toMatch(/장작 [\d,]+kg/);
    expect(result).toContain('다음 달로');
    expect(result).not.toContain('⟨');
    // 자동 진행(기본): 다음 순이 있는 화면에만 일시정지가 있다
    expect(html(<ProgressScreen def={ch1} state={end} index={1} onNext={noop} send={noop} setPaused={noop} />)).toContain('일시정지');
    expect(html(<ProgressScreen def={ch1} state={end} index={1} onNext={noop} send={noop} paused setPaused={noop} />)).toContain('다시 진행');
  });

  it('중순 사건: 진행 화면에 사건 직전 문장이 먼저 나오고, 이달의 결과에 고른 것이 남는다', () => {
    const states = huntMonth();
    const waiting = states.find((s) => s.step === 'decision' && s.work.decision?.kind === 'event');
    expect(waiting).toBeDefined();
    const w = waiting!;
    const h = html(<ProgressScreen def={ch1} state={w} index={w.work.reports.length - 1} onNext={noop} send={noop} />);
    const d = w.work.decision!;
    expect(d.kind === 'event' && h.includes(eventLead(tr, d.eventId))).toBe(true);
    const end = states[states.length - 1]!;
    expect(html(<ResultScreen def={ch1} state={end} onNext={noop} />)).toContain('고른 것:');
  });

  it('봄 시작: 인트로, 1년차 · 봄 · 3월, 첫 달 소식, 전략 팝업', () => {
    const s = springGame('ui-spring');
    const i = html(<IntroScreen def={ch1} state={s} onStart={noop} />);
    expect(i).toContain('긴 겨울이 끝났다');
    expect(i).toContain('낡은 천막 다섯 채, 34명이 살아남았다.');
    expect(i).toContain('남은 식량은 4일치.');
    expect(i).toContain('겨울은 다시 온다. 당신은 잿빛강 사람들의 족장이다.');
    expect(i).not.toContain('⟨');
    const h = html(<SituationScreen def={ch1} state={s} send={noop} />);
    expect(h).toContain('얼음이 갈라진다, 물고기가 돌아온다');
    expect(h).toContain('긴 겨울을 넘겼다');
    expect(h).not.toContain('⟨');
    const p = sheet(s);
    expect(p).toContain('봄 물고기 떼 잡기');
    expect(p).toContain('거의 확실하다');
    expect(p).toContain('1년차 · 봄 · 3월');
    expect(p).not.toContain('⟨');
  });

  it('이달의 결과: 순마다 한 줄 회고와 장부 (평온한 달 요약을 대신한다)', () => {
    const s0 = springGame('ui-result');
    const s = finishMonth(ch1, pick(ch1, s0, s0.work.candidates.find((c) => c.policyId === 'river_gather' || c.policyId === 'fish_run_weirs')!.policyId));
    const q = html(<ResultScreen def={ch1} state={s} onNext={noop} />);
    expect(q).toContain('상순');
    expect(q).toContain('하순');
    expect(q).toContain('시작');
    expect(q).toContain('최종');
    expect(q).toContain('장작 장부');
    expect(q).toContain('덕분에');
    expect(q).not.toContain('⟨');
  });

  it('장부 순서: 얻은 것(큰 것부터) → 쓴 것(큰 것부터), 0.5kg 미만은 뺀다', () => {
    const rows = [
      { res: 'food', source: 'upkeep.food', delta: -285 },
      { res: 'food', source: 'village.gather', delta: 28 },
      { res: 'food', source: 'spoil', delta: -3 },
      { res: 'food', source: 'catch.reindeer', delta: 150 },
      { res: 'food', source: 'spoil', delta: 0.2 },
    ];
    expect(orderRows(rows).map((r) => r.delta)).toEqual([150, 28, -285, -3]);
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
