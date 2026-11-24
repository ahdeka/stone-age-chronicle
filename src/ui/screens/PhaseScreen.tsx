// 진행 화면: 상순 → 중순 → 하순 → 정산 (화면 시안 Phase)
// 장면 → 서술 문단 타이핑(30ms/글자) → 부상·사망 알림 → 정산 행이 하나씩 들어오며 큰 숫자가 굴러간다.
// "빨리 보기"는 끝 상태로 건너뛴다. 중순 사건이 있으면 문단이 끝난 뒤 같은 결정 팝업이 뜬다.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  dailyFoodTotal,
  findPolicy,
  type ChapterDefinition,
  type Command,
  type GameState,
  type LedgerLine,
  type Line,
  type PhaseReport,
} from '../../engine';
import type { Translator } from '../../i18n';
import { Caret, Icon } from '../components/bits';
import { decisionModel, DecisionPopup } from '../components/Decision';
import { SceneView } from '../components/SceneView';
import { dateText, lineText } from '../format';
import { typedLines, typeSchedule, useClock } from '../hooks/useClock';
import { useT } from '../i18n';
import { useMotion } from '../motion';
import p from './phase.module.css';
import u from '../ui.module.css';

interface Props {
  def: ChapterDefinition;
  state: GameState;
  index: number;
  onNext: () => void;
  send: (c: Command) => void;
}

const STEPS = ['policy', 'early', 'mid', 'late', 'settlement'] as const;

interface Para {
  label?: string;
  text: string;
}

/** 같은 무리의 연속된 줄을 한 문단으로. 사람 알림 줄은 알림 카드로 따로 보여 준다 */
export function paragraphs(tr: Translator, def: ChapterDefinition, state: GameState, lines: readonly Line[]): Para[] {
  const out: Para[] = [];
  let cur: (Para & { group?: string }) | undefined;
  const policy = state.work.chosen ? findPolicy(def, state.work.chosen.policyId) : undefined;
  for (const l of lines) {
    if (l.group === 'people') continue;
    if (l.group === 'event' && l.key.startsWith('event.') && l.key.endsWith('.title')) {
      cur = { label: tr.t(l.key), text: '', group: 'event' };
      out.push(cur);
      continue;
    }
    if (!cur || cur.group !== l.group) {
      const label =
        l.group === 'crew'
          ? policy && tr.has(`policy.${policy.id}.crewLabel`)
            ? tr.t(`policy.${policy.id}.crewLabel`)
            : tr.t('group.crew')
          : l.group === 'village'
            ? tr.t('group.village')
            : undefined;
      cur = { ...(label ? { label } : {}), text: '', ...(l.group ? { group: l.group } : {}) };
      out.push(cur);
    }
    const t = lineText(tr, l);
    cur.text = cur.text ? `${cur.text} ${t}` : t;
  }
  return out.filter((x) => x.text.length > 0);
}

export function rowLabel(tr: Translator, row: LedgerLine, settlement: boolean, crewPolicy: boolean): string {
  const s = row.source;
  if (s.startsWith('catch.')) return tr.t(`row.${s}`, { n: row.params?.['n'] ?? 0 });
  if (s === 'upkeep.food') return settlement ? tr.t('src.upkeep.food') : tr.t('row.upkeep.food', { days: row.params?.['days'] ?? 10, people: row.params?.['people'] ?? 0 });
  if (s.startsWith('policy.')) return crewPolicy && row.res === 'food' ? tr.t('row.carried') : tr.t(`${s}.name`);
  if (s.startsWith('event.')) return tr.t(`${s}.title`);
  const key = `row.${s}`;
  return tr.has(key) ? tr.t(key) : tr.t('row.other');
}

/** 장부 행 순서: 얻은 것(큰 것부터) → 쓴 것(큰 것부터). 0.5kg 미만은 뺀다 */
export function orderRows(rows: readonly LedgerLine[]): LedgerLine[] {
  const keep = rows.filter((r) => Math.abs(r.delta) >= 0.5);
  const gains = keep.filter((r) => r.delta > 0).sort((a, b) => b.delta - a.delta);
  const spends = keep.filter((r) => r.delta < 0).sort((a, b) => a.delta - b.delta);
  return [...gains, ...spends];
}

export interface Timing {
  elapsed: number;
  done: boolean;
  gap: number;
  roll: number;
}

/** 굴러가는 최종값: 시작값 + 지금까지 들어온 행. 다 끝나면 엔진이 계산한 최종값으로 확정한다 */
function rolled(from: number, to: number | undefined, rows: readonly LedgerLine[], start: number, t: Timing): number {
  if (t.done && to !== undefined) return to;
  let v = from;
  rows.forEach((r, i) => {
    const at = start + i * t.gap;
    if (t.elapsed >= at) v += r.delta * Math.min(1, (t.elapsed - at) / t.roll);
  });
  return v;
}

const kgText = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}kg`;

/** 식량·장작 장부 한 칸: 시작 → 얻은 것 → 쓴 것 → 구분선 → 최종 */
export function LedgerBlock(props: {
  title: string;
  from: number;
  value: number;
  rows: LedgerLine[];
  start: number;
  timing: Timing;
  label: (r: LedgerLine) => string;
  big?: boolean;
  aside?: ReactNode;
}) {
  const tr = useT();
  const { title, from, value, rows, start, timing, label, big, aside } = props;
  const shown = rows.filter((_, i) => timing.elapsed >= start + i * timing.gap);
  const gains = shown.filter((r) => r.delta > 0);
  const spends = shown.filter((r) => r.delta < 0);
  const group = (key: string, list: LedgerLine[]) =>
    list.length > 0 && (
      <>
        <span className={p.groupLabel}>{tr.t(key)}</span>
        {list.map((r) => (
          <div key={`${r.source}-${r.delta > 0}`} className={`${p.row} ${u.pop}`}>
            <span>{label(r)}</span>
            <b className={r.delta > 0 ? p.up : p.down}>
              {r.delta > 0 ? '+' : '−'}
              {kgText(Math.abs(r.delta))}
            </b>
          </div>
        ))}
      </>
    );
  return (
    <>
      <h2 className={p.ledgerTitle}>{title}</h2>
      <div className={p.startRow}>
        <span>{tr.t('ui.ledger.start')}</span>
        <span>{kgText(from)}</span>
      </div>
      {group('ui.ledger.gain', gains)}
      {group('ui.ledger.spend', spends)}
      <div className={`${p.finalRow} ${big ? p.big : p.small}`}>
        <span className={p.finalLabel}>{tr.t('ui.ledger.final')}</span>
        <span className={big ? p.bigNum : p.smallNum}>{Math.round(value).toLocaleString('ko-KR')}</span>
        <span className={p.unit}>kg</span>
        {aside}
      </div>
    </>
  );
}

export function PhaseScreen({ def, state, index, onNext, send }: Props) {
  const tr = useT();
  const { mul, settings } = useMotion();
  const report = state.work.reports[index] as PhaseReport | undefined;
  const isLast = index === state.work.reports.length - 1;
  const settlement = report?.slot === 'settlement';
  const policy = state.work.chosen ? findPolicy(def, state.work.chosen.policyId) : undefined;
  const crewPolicy = !!policy?.crew;

  const paras = useMemo(() => (report ? paragraphs(tr, def, state, report.lines) : []), [report, tr, def, state]);
  const chronicle = settlement ? state.chronicle.filter((c) => c.month === state.month).at(-1) : undefined;
  const texts = [...paras.map((x) => x.text), ...(chronicle ? [lineText(tr, chronicle)] : [])];
  const perChar = 30 * mul;
  const sched = typeSchedule(texts, { startAt: 1200 * mul, perChar, gap: 600 * mul });

  // 장부: 시작 → 얻은 것 → 쓴 것 → 최종 (식량 다음 장작). 행은 이 순서로 하나씩 들어온다
  const foodRows = orderRows((report?.rows ?? []).filter((r) => r.res === 'food'));
  const woodRows = orderRows((report?.rows ?? []).filter((r) => r.res === 'firewood'));
  const haulRows = (report?.rows ?? []).filter((r) => r.res === 'haul');
  const rowGap = 900 * mul;
  const rowsStart = sched.end;
  const woodStart = rowsStart + foodRows.length * rowGap;
  const end = woodStart + woodRows.length * rowGap + 300 * mul;
  const clock = useClock(end, `${state.month}-${index}`);
  const typed = typedLines(texts, sched, clock.elapsed, perChar);
  const timing = { elapsed: clock.elapsed, done: clock.done, gap: rowGap, roll: 700 * mul };

  const food = rolled(report?.from.food ?? 0, report?.to?.food, foodRows, rowsStart, timing);
  const daily = dailyFoodTotal(def, state);
  const days = daily > 0 ? Math.max(0, Math.floor(food / daily)) : 0;
  const narrativeDone = clock.elapsed >= sched.end;

  // 결정 (중순 사건, 남은 고기): 이 단계의 문단이 다 나온 뒤에 팝업
  const model = isLast && state.step === 'decision' ? decisionModel(tr, def, state) : undefined;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (model && narrativeDone && settings.autoOpen) setOpen(true);
    if (!model) setOpen(false);
  }, [model?.key, narrativeDone, settings.autoOpen]);

  // 키보드: Space/Enter = 빨리 보기, 끝났으면 다음
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
  const nowStep = report.slot === 'briefing' ? 'policy' : report.slot;
  const nowIdx = STEPS.indexOf(nowStep as (typeof STEPS)[number]);
  const next = state.work.reports[index + 1];
  let nextLabel: string;
  if (!isLast && next) {
    const base = tr.t(`ui.next.${next.slot}`);
    nextLabel = next.lines.some((l) => l.group === 'event') ? tr.t('ui.next.news', { label: base }) : base;
  } else if (model) nextLabel = tr.t('ui.next.decide');
  else if (state.step === 'ended') nextLabel = tr.t('ui.next.ending');
  else nextLabel = tr.t('ui.next.month');

  const leader = state.work.chosen?.leaderId ? state.people[state.work.chosen.leaderId] : undefined;
  const place = report.place ?? state.work.place ?? state.campPlace;

  return (
    <div className={p.page}>
      <div className={p.wrap}>
        <div className={`${p.head} ${u.in}`}>
          <div className={p.headText}>
            <span className={`${p.month} ${u.serif}`}>{tr.t('ui.kicker', { date: dateText(tr, def, state) })}</span>
            {policy && (
              <span className={`${u.muted} ${u.small}`}>
                {tr.t('ui.phase.policyLine', { policy: tr.t(`policy.${policy.id}.name`) })}
                {state.work.chosen && state.work.chosen.crew.length > 0 && ` · ${tr.t('ui.phase.crew', { n: state.work.chosen.crew.length })}`}
                {leader && ` · ${tr.t('ui.crew.leader', { name: tr.label(leader.name) })}`}
              </span>
            )}
          </div>
          <nav aria-label={tr.t('ui.steps')} className={p.steps}>
            {STEPS.map((st, i) => (
              <span key={st} className={`${p.step} ${i < nowIdx ? p.done : ''} ${i === nowIdx ? p.now : ''}`} aria-current={i === nowIdx ? 'step' : undefined}>
                {i < nowIdx && '✓ '}
                {tr.t(`ui.step.${st}`)}
              </span>
            ))}
          </nav>
        </div>

        <section className={p.sceneBox}>
          <SceneView scene={report.scene} className={p.scene} />
          <div className={p.shade} aria-hidden="true" />
          <div className={p.sceneLabel}>
            <span className={u.label}>{tr.t(`ui.phase.${report.slot}.days`)}</span>
            <span className={`${p.place} ${u.serif}`}>{settlement ? dateText(tr, def, state) : tr.t(`place.${place}`)}</span>
            {report.tier && <span className={p.tier}>{tr.t(`tier.${report.tier}`)}</span>}
          </div>
        </section>

        <div className={p.cols}>
          <section className={p.story} aria-live="polite" onClick={clock.skip}>
            {typed.map((t, i) => {
              const para = paras[i];
              const label = para ? para.label : tr.t('ui.chronicle');
              return (
                <div key={i} className={p.para}>
                  {label && <span className={p.paraLabel}>{label}</span>}
                  <p className={`${p.paraText} ${u.serif}`}>
                    {t.text}
                    {t.typing && <Caret />}
                  </p>
                </div>
              );
            })}
            <div className="visually-hidden">{texts.join(' ')}</div>
          </section>

          <aside className={p.aside}>
            <section className={p.ledger}>
              <LedgerBlock
                title={tr.t('ui.ledger.food')}
                from={report.from.food}
                value={food}
                rows={foodRows}
                start={rowsStart}
                timing={timing}
                label={(r) => rowLabel(tr, r, settlement, crewPolicy)}
                big
                aside={<span className={`${p.days} ${days < def.balance.ui.foodWarnDays ? p.warn : ''}`}>{tr.t('ui.top.foodDays', { days })}</span>}
              />
              {narrativeDone && haulRows.length > 0 && (
                <div className={p.haul}>
                  <span className={u.muted}>{tr.t('ui.haulNote')}</span>
                  {haulRows.map((r) => (
                    <div key={r.source} className={p.row}>
                      <span>{rowLabel(tr, r, settlement, crewPolicy)}</span>
                      <b>+{Math.round(r.delta).toLocaleString('ko-KR')}kg</b>
                    </div>
                  ))}
                </div>
              )}
            </section>
            {clock.elapsed >= woodStart && (
              <section className={`${p.ledger} ${u.in}`}>
                <LedgerBlock
                  title={tr.t('ui.ledger.firewood')}
                  from={report.from.firewood}
                  value={rolled(report.from.firewood, report.to?.firewood, woodRows, woodStart, timing)}
                  rows={woodRows}
                  start={woodStart}
                  timing={timing}
                  label={(r) => rowLabel(tr, r, settlement, crewPolicy)}
                />
              </section>
            )}

            {narrativeDone &&
              report.alerts.map((a, i) => {
                const person = state.people[a.personId];
                const name = person ? tr.label(person.name) : '';
                const what = a.kind === 'death' ? tr.t(`cause.${a.what}`) : tr.t(`ailment.${a.what}`);
                const detail =
                  a.kind === 'death' ? tr.t('alert.death.detail', { cause: what }) : a.kind === 'healed' ? tr.t('alert.healed.detail') : tr.has(`ailment.${a.what}.effect`) ? tr.t(`ailment.${a.what}.effect`) : '';
                return (
                  <section key={i} className={`${p.alert} ${a.kind === 'healed' ? p.alertGood : ''} ${u.in}`}>
                    <Icon name="warn" size={22} className={a.kind === 'healed' ? p.alertIconGood : p.alertIcon} />
                    <div className={p.alertText}>
                      <b>{tr.t(`alert.${a.kind}`, { name, what })}</b>
                      {detail && <span>{detail}</span>}
                    </div>
                  </section>
                );
              })}

            <div className={p.controls}>
              {clock.done ? (
                <button type="button" className={`${u.btnPrimary} ${u.in}`} onClick={() => (model ? setOpen(true) : onNext())}>
                  {nextLabel}
                </button>
              ) : (
                <button type="button" className={u.btnGhost} onClick={clock.skip}>
                  {tr.t('ui.skip')}
                </button>
              )}
              <button type="button" className={u.btnText} onClick={clock.replay}>
                {tr.t('ui.replay')}
              </button>
            </div>
          </aside>
        </div>
      </div>
      {model && clock.done && <DecisionPopup model={model} open={open} setOpen={setOpen} send={send} />}
    </div>
  );
}
