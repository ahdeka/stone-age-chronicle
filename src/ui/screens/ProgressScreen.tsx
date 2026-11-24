// 진행 화면: 상순 → 중순 → 하순 (화면 시안 Progress, 2026-11-24 3차 피드백)
// 왼쪽 그림, 오른쪽 서술. 지난 순은 한 줄로 흐리게, 지금 순은 전문을 타이핑한다.
// 수치는 순마다 갱신하지 않는다: 장부와 증감은 이달의 결과에서만. 지표 바는 월초 기준으로 고정.
// 중순 사건은 사건 직전 문장을 먼저 보여 주고 "결정이 필요하다" 띠를 띄운 뒤 결정 팝업을 연다.

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { paragraphs, planPolicies, recapOf } from '../story';
import { AUTO_DELAY_MS, PROGRESS_TIMING, type Speed } from '../timing';
import p from './progress.module.css';
import u from '../ui.module.css';

interface Props {
  def: ChapterDefinition;
  state: GameState;
  index: number;
  onNext: () => void;
  send: (c: Command) => void;
  /** 자동 진행 일시정지 (한 달 동안 유지된다) */
  paused?: boolean;
  setPaused?: (p: boolean) => void;
}

const SPEEDS: Speed[] = ['slow', 'normal', 'fast'];

export function ProgressScreen({ def, state, index, onNext, send, paused = false, setPaused }: Props) {
  const tr = useT();
  const { progressMul: pm, settings, set } = useMotion();
  const reports = state.work.reports;
  const report = reports[index] as PhaseReport | undefined;
  const isLast = index === reports.length - 1;

  const paras = useMemo(() => (report ? paragraphs(tr, def, state, report.lines) : []), [report, tr, def, state]);
  const recaps = useMemo(
    () =>
      reports
        .slice(0, index)
        .map((r) => recapOf(tr, def, state, r))
        .filter((r): r is NonNullable<typeof r> => !!r),
    [reports, index, tr, def, state],
  );
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
  const advanced = useRef(false);
  useEffect(() => {
    if (advanced.current) return;
    if (autoAdvanceDue({ auto, paused, hasNext, deciding: !!model, run: clock.run, end, delay })) {
      advanced.current = true;
      onNext();
    }
  }, [auto, paused, hasNext, model, clock.run, end, delay, onNext]);
  const typed = typedLines(texts, sched, clock.elapsed, perChar);

  // 결정 띠가 뜬 뒤 잠시 있다가 팝업을 연다 (설정으로 끌 수 있다)
  const [open, setOpen] = useState(false);
  const deciding = !!model && clock.done;
  useEffect(() => {
    if (!model) {
      setOpen(false);
      return;
    }
    if (!deciding || !settings.autoOpen) return;
    const t = setTimeout(() => setOpen(true), PROGRESS_TIMING.decideOpen * pm);
    return () => clearTimeout(t);
  }, [model?.key, deciding, settings.autoOpen, pm]);

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

  const alerts = clock.done ? report.alerts : [];
  const nextLabel = model ? tr.t('ui.next.decide') : tr.t('ui.progress.continue');

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

        <section ref={storyRef} className={p.story} aria-live="polite" onClick={clock.skip}>
          {recaps.map((r) => (
            <div key={r.slot} className={p.recap}>
              <span className={p.recapLabel}>{tr.t(`ui.step.${r.slot}`)}</span>
              <span className={`${p.recapText} ${u.serif}`} title={r.text}>
                {r.text}
                {r.chose && <span className={p.recapChose}> · {tr.t('ui.result.chose', { option: r.chose })}</span>}
              </span>
            </div>
          ))}

          <div className={p.now}>
            <span className={p.nowLabel}>
              {tr.t(`ui.phase.${report.slot}.days`)}
              {report.tier && clock.done && <span className={p.tier}>{tr.t(`tier.${report.tier}`)}</span>}
            </span>
            {typed.map((t, i) => {
              const para = paras[i];
              return (
                // 이름표는 문단 앞에 붙여 쓴다 (따로 한 줄을 쓰면 두 칸 전략의 순에서 높이가 넘친다)
                <p key={i} className={`${p.paraText} ${u.serif}`}>
                  {para?.label && <span className={para.lead ? p.leadLabel : p.paraLabel}>{para.label}</span>}
                  {t.text}
                  {t.typing && <Caret />}
                </p>
              );
            })}
            <div className="visually-hidden">{texts.join(' ')}</div>
          </div>

          {alerts.length > 0 && (
            <div className={`${p.alerts} ${u.in}`}>
              {alerts.map((a, i) => {
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
          )}

          {deciding && (
            <button type="button" className={`${p.decide} ${u.in}`} onClick={() => setOpen(true)}>
              <span className={p.decideDot} aria-hidden="true" />
              {tr.t(settings.autoOpen ? 'ui.progress.decideAuto' : 'ui.progress.decide')}
            </button>
          )}
        </section>
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
