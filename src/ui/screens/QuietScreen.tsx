// 평온한 달의 한 화면 요약 (DESIGN.md §19, 확정 D5)
// 사건·죽음·새 기억이 없던 달은 상순·중순·하순을 한 줄씩, 대표 장면 한 장, 이달의 결과(축약 장부)로 보여 준다.
// "펼쳐 보기"를 누르면 평소처럼 단계별로 본다. 설정에서 끌 수 있다.

import { useEffect } from 'react';
import { findPolicy, type ChapterDefinition, type GameState } from '../../engine';
import { SceneView } from '../components/SceneView';
import { dateText } from '../format';
import { useT } from '../i18n';
import { LedgerBlock, orderRows, paragraphs, rowLabel, type Timing } from './PhaseScreen';
import p from './phase.module.css';
import u from '../ui.module.css';

interface Props {
  def: ChapterDefinition;
  state: GameState;
  onNext: () => void;
  onExpand: () => void;
}

const DONE: Timing = { elapsed: Number.MAX_SAFE_INTEGER, done: true, gap: 0, roll: 1 };

export function QuietScreen({ def, state, onNext, onExpand }: Props) {
  const tr = useT();
  const reports = state.work.reports;
  const phases = reports.filter((r) => r.slot === 'early' || r.slot === 'mid' || r.slot === 'late');
  const settle = reports.find((r) => r.slot === 'settlement');
  const policy = state.work.chosen ? findPolicy(def, state.work.chosen.policyId) : undefined;
  const crewPolicy = !!policy?.crew;
  const scene = phases[0]?.scene ?? def.scenes.briefing;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      if (e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNext]);

  const foodRows = orderRows((settle?.rows ?? []).filter((r) => r.res === 'food'));
  const woodRows = orderRows((settle?.rows ?? []).filter((r) => r.res === 'firewood'));
  const label = (r: Parameters<typeof rowLabel>[1]) => rowLabel(tr, r, true, crewPolicy);

  return (
    <div className={p.page}>
      <div className={p.wrap}>
        <div className={`${p.head} ${u.in}`}>
          <div className={p.headText}>
            <span className={`${p.month} ${u.serif}`}>{tr.t('ui.kicker', { date: dateText(tr, def, state) })}</span>
            {policy && <span className={`${u.muted} ${u.small}`}>{tr.t('ui.phase.policyLine', { policy: tr.t(`policy.${policy.id}.name`) })}</span>}
          </div>
          <span className={u.label}>{tr.t('ui.quiet.title')}</span>
        </div>

        <section className={p.sceneBox}>
          <SceneView scene={scene} className={p.scene} />
          <div className={p.shade} aria-hidden="true" />
        </section>

        <div className={p.cols}>
          <section className={p.story}>
            {phases.map((r) => {
              const first = paragraphs(tr, def, state, r.lines)[0];
              return (
                <div key={r.slot} className={`${p.para} ${u.in}`}>
                  <span className={p.paraLabel}>{tr.t(`ui.phase.${r.slot}.days`)}</span>
                  <p className={`${p.paraText} ${u.serif}`}>{first?.text ?? ''}</p>
                </div>
              );
            })}
            <p className={u.muted}>{tr.t('ui.quiet.hint')}</p>
          </section>

          <aside className={p.aside}>
            {settle && (
              <>
                <section className={p.ledger}>
                  <LedgerBlock
                    title={tr.t('ui.ledger.food')}
                    from={settle.from.food}
                    value={settle.to?.food ?? settle.from.food}
                    rows={foodRows}
                    start={0}
                    timing={DONE}
                    label={label}
                    big
                  />
                </section>
                <section className={p.ledger}>
                  <LedgerBlock
                    title={tr.t('ui.ledger.firewood')}
                    from={settle.from.firewood}
                    value={settle.to?.firewood ?? settle.from.firewood}
                    rows={woodRows}
                    start={0}
                    timing={DONE}
                    label={label}
                  />
                </section>
              </>
            )}
            <div className={p.controls}>
              <button type="button" className={u.btnPrimary} onClick={onNext} autoFocus>
                {tr.t(state.step === 'ended' ? 'ui.next.ending' : 'ui.next.month')}
              </button>
              <button type="button" className={u.btnGhost} onClick={onExpand}>
                {tr.t('ui.quiet.expand')}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
