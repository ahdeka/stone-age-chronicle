// 진행 화면: 상순 → 중순 → 하순 (화면 시안 Progress, 2026-11-24 3차 · 2026-11-25 4차 · 5차 피드백)
// 왼쪽 그림, 오른쪽 서술 칸. 세 순은 한 칸에 차례로 이어 써진다: "상순 · 1~10일" 같은 소제목도 글처럼 타이핑되고,
// 지난 순의 글은 지우거나 다시 그리지 않는다 (순마다 같은 자리에 같은 열쇠로 남는다). 지금 순만 타이핑한다.
// 페이지 전체는 스크롤 없음. 서술 칸 안쪽만 스크롤하고, 새 글이 붙으면 따라 내려간다
// (위로 올려 읽고 있으면 따라가지 않고 "새 글 아래에 있음" 버튼을 띄운다).
// 왼쪽 그림은 순이 바뀌면 새 그림이 위에 겹쳐 서서히 나타난다 (깜빡임 없이).
// 수치는 순마다 갱신하지 않는다: 장부와 증감은 이달의 결과에서만. 지표 바는 월초 기준으로 고정.
// 중순 사건은 사건 직전 문장을 먼저 보여 주고 "결정이 필요하다" 띠를 띄운 뒤 결정 팝업을 늘 자동으로 연다.
// 아래 버튼은 일시정지와 "글 바로 보기" 둘뿐. 하순 글이 다 나오면 "글 바로 보기"가 "결과 보기"로 바뀐다.
// 속도는 설정에서만 고른다.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type WheelEvent } from 'react';
import type { ChapterDefinition, Command, GameState, PhaseReport, SceneSpec } from '../../engine';
import { Caret } from '../components/bits';
import { decisionModel, DecisionPopup } from '../components/Decision';
import { SceneView } from '../components/SceneView';
import { StatusBar } from '../components/StatusBar';
import { autoAdvanceDue, canPause, progressAction } from '../flow';
import { phaseHead } from '../format';
import { typedLines, typeSchedule, useClock } from '../hooks/useClock';
import { useInView } from '../hooks/useInView';
import { useT } from '../i18n';
import { useMotion } from '../motion';
import { paragraphs, planPolicies, type Para } from '../story';
import { AUTO_DELAY_MS, PROGRESS_TIMING } from '../timing';
import p from './progress.module.css';
import u from '../ui.module.css';

interface Props {
  def: ChapterDefinition;
  state: GameState;
  /** 지금 보고 있는 보고 번호 (그 앞의 순은 위에 쌓여 있다) */
  index: number;
  onNext: () => void;
  send: (c: Command) => void;
  /** 자동 진행 일시정지 (한 달 동안 유지된다) */
  paused?: boolean;
  setPaused?: (p: boolean) => void;
}

/** 바닥에서 이만큼 안쪽이면 "바닥에 있다"(새 글을 따라간다)고 본다 */
const FOLLOW_SLACK_PX = 40;

const isPhase = (r: PhaseReport) => r.slot === 'early' || r.slot === 'mid' || r.slot === 'late';

/**
 * 그림 겹쳐 바꾸기: 새 그림을 옛 그림 위에 얹어 서서히 나타나게 하고, 다 나타나면 옛 그림을 치운다.
 * 그림이 그대로면 아무것도 다시 그리지 않는다.
 */
function SceneFade({ scene }: { scene: SceneSpec }) {
  const sig = JSON.stringify(scene);
  const [layers, setLayers] = useState([{ id: 0, sig, scene }]);
  // 그리기 전에 바꿔 한 프레임도 비지 않게
  useLayoutEffect(() => {
    setLayers((ls) => {
      const top = ls[ls.length - 1]!;
      return top.sig === sig ? ls : [top, { id: top.id + 1, sig, scene }];
    });
  }, [sig]); // sig가 scene을 대신한다 (같은 그림이면 새 객체여도 그대로)
  return (
    <>
      {layers.map((l, i) => (
        <div
          key={l.id}
          className={`${p.sceneLayer} ${i > 0 ? p.sceneIn : ''}`}
          // 그림 속 움직임(눈, 불꽃)의 animationend도 올라오므로 이 칸 자신의 것만 본다
          onAnimationEnd={(e) => e.target === e.currentTarget && i === layers.length - 1 && layers.length > 1 && setLayers((ls) => ls.slice(-1))}
        >
          <SceneView scene={l.scene} />
        </div>
      ))}
    </>
  );
}

export function ProgressScreen({ def, state, index, onNext, send, paused = false, setPaused }: Props) {
  const tr = useT();
  const { progressMul: pm, settings, reduced } = useMotion();
  const reports = state.work.reports;
  const report = reports[index] as PhaseReport | undefined;
  const isLast = index === reports.length - 1;
  const nextReport = reports[index + 1];

  // 이 달에 지금까지 나온 순 (지난 순은 전문 그대로, 지금 순은 타이핑)
  const phases = useMemo(
    () =>
      reports
        .slice(0, index + 1)
        .filter(isPhase)
        .map((r) => ({ report: r, head: phaseHead(tr, def, state, r.slot, r.month), paras: paragraphs(tr, def, state, r.lines) })),
    [reports, index, tr, def, state],
  );
  const current = report && isPhase(report) ? phases[phases.length - 1] : undefined;
  // 지금 순의 타이핑: 소제목 → 문단들 (소제목도 글처럼 이어서 나타난다)
  const texts = current ? [current.head, ...current.paras.map((x) => x.text)] : [];
  const perChar = PROGRESS_TIMING.perChar * pm;
  const sched = typeSchedule(texts, { startAt: PROGRESS_TIMING.startAt * pm, perChar, gap: PROGRESS_TIMING.paraGap * pm });
  const end = sched.end;

  // 결정 (중순 사건, 남은 고기): 이 순의 글이 다 나온 뒤에 띠 → 팝업
  const model = isLast && state.step === 'decision' ? decisionModel(tr, def, state) : undefined;

  // 자동 진행: 서술이 보일 때 타이핑을 시작하고, 끝나면 잠시 쉰 뒤 다음 순으로
  // (결정과 하순 끝 — 이달의 결과 앞 — 에서는 멈춘다)
  const key = `${state.turn}-${index}`;
  const storyRef = useRef<HTMLElement>(null);
  // 서술 칸은 한 달 내내 같은 칸이라 한 번 보이면 된다 (순마다 다시 재지 않는다)
  const inView = useInView(storyRef, state.turn);
  const auto = !settings.stepByStep;
  const hasNext = !!nextReport && isPhase(nextReport);
  const toResult = !model && (!nextReport || nextReport.slot === 'settlement');
  const pausable = canPause(auto, hasNext, !!model);
  const delay = AUTO_DELAY_MS[settings.autoDelay] * pm;
  const clock = useClock(end, key, {
    hold: !inView || (paused && pausable),
    // 결정을 기다리는 동안 시간이 쌓이면 결정 뒤 이어지는 글이 한꺼번에 나와 버린다
    stopAtEnd: !!model,
    tail: pausable ? delay : 0,
  });
  // 순이 바뀌어도 화면은 그대로 남으므로, 자동 넘김 표시는 순마다 새로
  const advanced = useRef<string | null>(null);
  useEffect(() => {
    if (advanced.current === key) return;
    if (autoAdvanceDue({ auto, paused, hasNext, deciding: !!model, run: clock.run, end, delay })) {
      advanced.current = key;
      onNext();
    }
  }, [auto, paused, hasNext, model, clock.run, end, delay, onNext, key]);
  const typed = typedLines(texts, sched, clock.elapsed, perChar);

  // 결정 띠가 뜬 뒤 잠시 있다가 팝업을 연다 (결정을 기다리는 곳이라 늘 자동으로 연다)
  const [open, setOpen] = useState(false);
  const deciding = !!model && clock.done;
  useEffect(() => {
    if (!model) {
      setOpen(false);
      return;
    }
    if (!deciding) return;
    const t = setTimeout(() => setOpen(true), PROGRESS_TIMING.decideOpen * pm);
    return () => clearTimeout(t);
  }, [model?.key, deciding, pm]);

  const action = progressAction({ done: clock.done, deciding: !!model, toResult, hasNext, auto });
  const act = useCallback(() => {
    if (action === 'skip') clock.skip();
    else if (action === 'decide') setOpen(true);
    else if (action === 'result' || action === 'nextPhase') onNext();
  }, [action, clock, onNext]);

  // 키보드: Space/Enter = 아래 버튼과 같다 (글 바로 보기 / 결정하기 / 결과 보기)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open || (e.key !== ' ' && e.key !== 'Enter')) return;
      if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement) return;
      e.preventDefault();
      act();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act, open]);

  // ── 서술 칸 따라가기 ──
  // 바닥 근처에 있으면 새 글을 따라 내려간다. 사용자가 위로 올려 읽고 있으면 따라가지 않고 버튼을 띄운다.
  const follow = useRef(true);
  const lastHeight = useRef(0);
  const programmatic = useRef(0);
  const [newBelow, setNewBelow] = useState(false);
  const toBottom = useCallback(
    (smooth: boolean) => {
      const el = storyRef.current;
      if (!el) return;
      programmatic.current = performance.now();
      el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduced ? 'smooth' : 'auto' });
      follow.current = true;
      setNewBelow(false);
    },
    [reduced],
  );
  // 그릴 때마다 서술 칸 높이를 보고, 늘었으면 따라가거나 버튼을 띄운다
  useLayoutEffect(() => {
    const el = storyRef.current;
    if (!el) return;
    const h = el.scrollHeight;
    if (h <= lastHeight.current) return;
    lastHeight.current = h;
    if (h <= el.clientHeight + 1) return;
    if (follow.current) toBottom(true);
    else setNewBelow(true);
  });
  const onScroll = () => {
    const el = storyRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_SLACK_PX;
    if (atBottom) {
      follow.current = true;
      setNewBelow(false);
      return;
    }
    // 따라 내려가는 부드러운 스크롤 도중의 위치는 사용자의 뜻이 아니다
    if (performance.now() - programmatic.current < 600) return;
    follow.current = false;
  };
  // 위로 굴리면 곧바로 따라가기를 멈춘다 (부드러운 스크롤 도중이라도)
  const onWheel = (e: WheelEvent) => {
    if (e.deltaY < 0) {
      programmatic.current = 0;
      follow.current = false;
    }
  };

  if (!report) return null;
  const plan = planPolicies(def, state);

  // 그림 아래 한 줄: 고른 전략 + 무리 (사냥대 14명 · 발전 4명)
  const crews = state.work.plan
    .map((e) => {
      const pol = plan.find((x) => x.id === e.bound.policyId);
      if (!pol || e.bound.crew.length === 0) return '';
      const label = e.slot === 'growth' ? tr.t('group.growth') : tr.has(`policy.${pol.id}.crewLabel`) ? tr.t(`policy.${pol.id}.crewLabel`) : tr.t('group.crew');
      return tr.t('ui.progress.crew', { label, n: e.bound.crew.length });
    })
    .filter(Boolean);
  const caption = [plan.map((x) => tr.t(`policy.${x.id}.name`)).join(tr.t('ui.phase.planJoin')), ...crews].join(' · ');

  const para = (x: Para, i: number, text: string, typing: boolean) => (
    // 이름표는 문단 앞에 붙여 쓴다
    <p key={i} className={`${p.paraText} ${u.serif}`}>
      {x.label && <span className={x.lead ? p.leadLabel : p.paraLabel}>{x.label}</span>}
      {text}
      {typing && <Caret />}
    </p>
  );
  const alertChips = (r: PhaseReport) =>
    r.alerts.length > 0 && (
      <div className={`${p.alerts} ${u.in}`}>
        {r.alerts.map((a, i) => {
          const person = state.people[a.personId];
          const name = person ? tr.label(person.name) : '';
          const what = a.kind === 'death' ? tr.t(`cause.${a.what}`) : tr.t(`ailment.${a.what}`);
          return (
            <span key={i} className={`${p.alert} ${a.kind === 'healed' ? p.alertGood : ''}`}>
              {tr.t(`alert.${a.kind}`, { name, what })}
            </span>
          );
        })}
      </div>
    );

  const button = (() => {
    switch (action) {
      case 'skip':
        return (
          <button type="button" className={`${u.btnGhost} ${p.btn}`} onClick={act}>
            {tr.t('ui.progress.skip')}
          </button>
        );
      case 'decide':
        return (
          <button type="button" className={`${u.btnPrimary} ${p.btn}`} onClick={act}>
            {tr.t('ui.next.decide')}
          </button>
        );
      case 'result':
        return (
          <button type="button" className={`${u.btnPrimary} ${p.btn}`} onClick={act} autoFocus>
            {tr.t('ui.progress.result')}
          </button>
        );
      case 'nextPhase':
        return (
          <button type="button" className={`${u.btnPrimary} ${p.btn}`} onClick={act}>
            {tr.t('ui.progress.nextPhase')}
          </button>
        );
      default:
        return (
          <button type="button" className={`${u.btnGhost} ${p.btn}`} disabled>
            {tr.t('ui.progress.skip')}
          </button>
        );
    }
  })();

  return (
    <div className={p.page}>
      <StatusBar def={def} state={state} mode="start" />

      <div className={p.body} data-fit="progress">
        <section className={`${p.sceneBox} ${u.in}`}>
          <div className={p.scene}>
            <SceneFade scene={report.scene} />
          </div>
          <div className={p.caption}>{caption}</div>
        </section>

        <div className={p.storyWrap}>
          <section ref={storyRef} className={p.story} aria-live="polite" onClick={clock.skip} onScroll={onScroll} onWheel={onWheel} data-fit="story">
            {phases.map((ph) => {
              // 지난 순과 지금 순은 같은 틀(같은 자리, 같은 열쇠)로 그린다: 지금 순이 지난 순이 되어도
              // 글과 칸이 새로 그려지지 않고, 소식 띠의 등장 움직임도 다시 돌지 않는다
              const live = ph === current;
              // 지금 순: 소제목이 나오기 시작할 때 칸이 생긴다 (빈 칸이 먼저 자리를 차지하지 않게)
              const [head, ...body] = live ? typed : [];
              if (live && !head) return null;
              const finished = !live || clock.done;
              const lines = live ? body.map((t, i) => ({ x: ph.paras[i] ?? { text: '' }, text: t.text, typing: t.typing })) : ph.paras.map((x) => ({ x, text: x.text, typing: false }));
              return (
                <article key={ph.report.slot} className={p.phase}>
                  <h2 className={p.phaseLabel}>
                    {live ? head!.text : ph.head}
                    {live && head!.typing && <Caret />}
                    {ph.report.tier && finished && <span className={p.tier}>{tr.t(`tier.${ph.report.tier}`)}</span>}
                  </h2>
                  {lines.map((l, i) => para(l.x, i, l.text, l.typing))}
                  {finished && alertChips(ph.report)}
                </article>
              );
            })}

            {/* 화면 읽기용 지금 순 전문: 타이핑 전에도 있다. 칸 밖으로 빠져 있어 자리를 차지하지 않는다 */}
            <div className="visually-hidden">{texts.join(' ')}</div>

            {deciding && (
              <button type="button" className={`${p.decide} ${u.in}`} onClick={() => setOpen(true)}>
                <span className={p.decideDot} aria-hidden="true" />
                {tr.t('ui.progress.decideAuto')}
              </button>
            )}
          </section>

          {newBelow && (
            <button type="button" className={p.newBelow} onClick={() => toBottom(true)}>
              {tr.t('ui.progress.newBelow')} ↓
            </button>
          )}
        </div>
      </div>

      <div className={p.foot}>
        {pausable && setPaused && (
          <button type="button" className={`${u.btnGhost} ${p.btn}`} aria-pressed={paused} onClick={() => setPaused(!paused)}>
            {tr.t(paused ? 'ui.resume' : 'ui.pause')}
          </button>
        )}
        {button}
      </div>

      {model && <DecisionPopup model={model} open={open} setOpen={setOpen} send={send} bar={false} />}
    </div>
  );
}
