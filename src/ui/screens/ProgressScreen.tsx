// 진행 화면: 상순 → 중순 → 하순 (화면 시안 Progress, 2026-11-24 3차 피드백 · 2026-11-25 4차 피드백)
// 왼쪽 그림, 오른쪽 서술 칸. 세 순은 한 칸에 차례로 쌓인다: "상순", "중순", "하순" 소제목과 문단이 아래에 덧붙고,
// 지난 순의 글은 지우거나 줄이지 않는다. 지금 순만 타이핑한다 (다음 순 글은 앞 순 글이 다 나온 뒤에 시작).
// 페이지 전체는 스크롤 없음. 서술 칸 안쪽만 스크롤하고, 새 글이 붙으면 따라 내려간다
// (위로 올려 읽고 있으면 따라가지 않고 "새 글 아래에 있음" 버튼을 띄운다).
// 수치는 순마다 갱신하지 않는다: 장부와 증감은 이달의 결과에서만. 지표 바는 월초 기준으로 고정.
// 중순 사건은 사건 직전 문장을 먼저 보여 주고 "결정이 필요하다" 띠를 띄운 뒤 결정 팝업을 늘 자동으로 연다.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type WheelEvent } from 'react';
import type { ChapterDefinition, Command, GameState, PhaseReport } from '../../engine';
import { Caret } from '../components/bits';
import { decisionModel, DecisionPopup } from '../components/Decision';
import { SceneView } from '../components/SceneView';
import { StatusBar, StepTrail, type StepId } from '../components/StatusBar';
import { autoAdvanceDue, canPause } from '../flow';
import { typedLines, typeSchedule, useClock } from '../hooks/useClock';
import { useInView } from '../hooks/useInView';
import { useT } from '../i18n';
import { useMotion } from '../motion';
import { paragraphs, planPolicies, type Para } from '../story';
import { AUTO_DELAY_MS, PROGRESS_TIMING, type Speed } from '../timing';
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

const SPEEDS: Speed[] = ['slow', 'normal', 'fast'];
/** 바닥에서 이만큼 안쪽이면 "바닥에 있다"(새 글을 따라간다)고 본다 */
const FOLLOW_SLACK_PX = 40;

const isPhase = (r: PhaseReport) => r.slot === 'early' || r.slot === 'mid' || r.slot === 'late';

export function ProgressScreen({ def, state, index, onNext, send, paused = false, setPaused }: Props) {
  const tr = useT();
  const { progressMul: pm, settings, set, reduced } = useMotion();
  const reports = state.work.reports;
  const report = reports[index] as PhaseReport | undefined;
  const isLast = index === reports.length - 1;

  // 위에 쌓인 지난 순 (전문 그대로)
  const past = useMemo(
    () =>
      reports
        .slice(0, index)
        .filter(isPhase)
        .map((r) => ({ report: r, paras: paragraphs(tr, def, state, r.lines) })),
    [reports, index, tr, def, state],
  );
  const paras = useMemo(() => (report ? paragraphs(tr, def, state, report.lines) : []), [report, tr, def, state]);
  const texts = paras.map((x) => x.text);
  const perChar = PROGRESS_TIMING.perChar * pm;
  const sched = typeSchedule(texts, { startAt: PROGRESS_TIMING.startAt * pm, perChar, gap: PROGRESS_TIMING.paraGap * pm });
  const end = sched.end;

  // 결정 (중순 사건, 남은 고기): 이 순의 글이 다 나온 뒤에 띠 → 팝업
  const model = isLast && state.step === 'decision' ? decisionModel(tr, def, state) : undefined;

  // 자동 진행: 서술이 보일 때 타이핑을 시작하고, 끝나면 잠시 쉰 뒤 다음 순으로 (결정과 이달의 결과에서는 멈춘다)
  const key = `${state.month}-${index}`;
  const storyRef = useRef<HTMLElement>(null);
  const inView = useInView(storyRef, key);
  const auto = !settings.stepByStep;
  const hasNext = !isLast;
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

  // 키보드: Space/Enter = 글 바로 보기, 끝났으면 계속
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open || (e.key !== ' ' && e.key !== 'Enter')) return;
      if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement) return;
      e.preventDefault();
      if (!clock.done) clock.skip();
      else if (model) setOpen(true);
      else onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clock, model, onNext, open]);

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
  const slot = report.slot as StepId;
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

  const nextLabel = model ? tr.t('ui.next.decide') : tr.t('ui.progress.continue');

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
  const phaseHead = (r: PhaseReport, done: boolean) => (
    <h2 className={p.phaseLabel}>
      {tr.t(`ui.phase.${r.slot}.days`)}
      {r.tier && done && <span className={p.tier}>{tr.t(`tier.${r.tier}`)}</span>}
    </h2>
  );

  return (
    <div className={p.page}>
      <StatusBar def={def} state={state} mode="start">
        <StepTrail now={slot} />
      </StatusBar>

      <div className={p.body} data-fit="progress">
        <section className={`${p.sceneBox} ${u.in}`}>
          <div className={p.scene}>
            <SceneView scene={report.scene} />
          </div>
          <div className={p.caption}>{caption}</div>
        </section>

        <div className={p.storyWrap}>
          <section ref={storyRef} className={p.story} aria-live="polite" onClick={clock.skip} onScroll={onScroll} onWheel={onWheel} data-fit="story">
            {past.map(({ report: r, paras: ps }) => (
              <article key={r.slot} className={p.phase}>
                {phaseHead(r, true)}
                {ps.map((x, i) => para(x, i, x.text, false))}
                {alertChips(r)}
              </article>
            ))}

            {isPhase(report) && (
              <article className={p.phase}>
                {phaseHead(report, clock.done)}
                {typed.map((t, i) => para(paras[i] ?? { text: '' }, i, t.text, t.typing))}
                <div className="visually-hidden">{texts.join(' ')}</div>
                {clock.done && alertChips(report)}
              </article>
            )}

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
        <div className={p.speed}>
          <span className={p.speedLabel}>{tr.t('ui.settings.speed')}</span>
          <div role="group" aria-label={tr.t('ui.progress.speedGroup')} className={p.segment}>
            {SPEEDS.map((sp) => (
              <button key={sp} type="button" aria-pressed={settings.speed === sp} onClick={() => set({ speed: sp })}>
                {tr.t(`speed.${sp}`)}
              </button>
            ))}
          </div>
        </div>
        <div className={p.buttons}>
          {pausable && setPaused && (
            <button type="button" className={`${u.btnGhost} ${p.btn}`} aria-pressed={paused} onClick={() => setPaused(!paused)}>
              {tr.t(paused ? 'ui.resume' : 'ui.pause')}
            </button>
          )}
          <button type="button" className={`${u.btnGhost} ${p.btn}`} onClick={clock.skip} disabled={clock.done}>
            {tr.t('ui.progress.skip')}
          </button>
          {clock.done ? (
            <button type="button" className={`${u.btnPrimary} ${p.btn}`} onClick={() => (model ? setOpen(true) : onNext())}>
              {nextLabel}
            </button>
          ) : (
            <span className={`${u.btnDisabled} ${p.btn}`} aria-disabled="true">
              {tr.t('ui.progress.continue')}
            </span>
          )}
        </div>
      </div>

      {model && <DecisionPopup model={model} open={open} setOpen={setOpen} send={send} bar={false} />}
    </div>
  );
}
