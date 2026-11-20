// 월초 상황 화면 (화면 시안 TurnModal의 채택안)
// 상황을 읽는 곳: 장면 + 이번 달 소식 타이핑, 땅, 사람들, 시대 목표, 부족, 아직 남은 일, 연대기.
// 결정은 아래에서 올라오는 팝업에서 한다. 소식 타이핑이 끝나면 한 번 자동으로 열린다 (설정으로 끌 수 있다).

import { useEffect, useMemo, useState } from 'react';
import {
  ailingCount,
  band,
  countBand,
  goalProgress,
  living,
  totalKg,
  workers,
  type ChapterDefinition,
  type Command,
  type GameState,
} from '../../engine';
import { Caret } from '../components/bits';
import { decisionModel, DecisionPopup } from '../components/Decision';
import { Portrait, SceneView } from '../components/SceneView';
import { TopBar } from '../components/TopBar';
import { RosterDialog } from '../components/RosterDialog';
import { lineText } from '../format';
import { typedLines, typeSchedule, useClock } from '../hooks/useClock';
import { useT } from '../i18n';
import { useMotion } from '../motion';
import v from './situation.module.css';
import u from '../ui.module.css';

interface Props {
  def: ChapterDefinition;
  state: GameState;
  send: (c: Command) => void;
}

export function SituationScreen({ def, state, send }: Props) {
  const tr = useT();
  const { mul, settings } = useMotion();
  const brief = state.work.brief;
  const news = useMemo(() => (brief?.news ?? []).map((l) => lineText(tr, l)), [brief, tr]);
  const sched = useMemo(() => typeSchedule(news, { startAt: 700 * mul, perChar: 32 * mul, gap: 500 * mul }), [news, mul]);
  const clock = useClock(sched.end, `brief-${state.month}`);
  const typed = typedLines(news, sched, clock.elapsed, 32 * mul);

  const model = decisionModel(tr, def, state);
  const [open, setOpen] = useState(false);
  const [autoDone, setAutoDone] = useState<number | null>(null);
  useEffect(() => {
    if (clock.done && settings.autoOpen && autoDone !== state.month && model) {
      setOpen(true);
      setAutoDone(state.month);
    }
  }, [clock.done, settings.autoOpen, autoDone, state.month, model]);

  return (
    <div className={v.page}>
      <TopBar def={def} state={state} />
      <div className={v.layout}>
        <main className={v.main}>
          <section className={`${v.hero} ${u.in} ${u.d1}`} onClick={clock.skip}>
            {brief && <SceneView scene={brief.scene} className={v.heroScene} />}
            <div className={v.heroShade} aria-hidden="true" />
            <div className={v.heroText}>
              <span className={u.label}>{tr.t('ui.briefingLabel')}</span>
              <h1 className={`${v.headline} ${u.serif}`}>{brief ? lineText(tr, brief.headline) : ''}</h1>
              <div className={`${v.news} ${u.serif}`} aria-live="polite">
                {typed.map((l, i) => (
                  <p key={i}>
                    {l.text}
                    {l.typing && <Caret />}
                  </p>
                ))}
              </div>
              {/* 화면 읽기 프로그램에는 소식 전체를 바로 준다 */}
              <div className="visually-hidden">{news.join(' ')}</div>
            </div>
          </section>
          <LandCard def={def} state={state} />
          <PeopleCard def={def} state={state} />
        </main>
        <aside className={v.side}>
          <GoalsCard def={def} state={state} />
          <TribeCard def={def} state={state} />
          <MemoryCard def={def} state={state} />
          <ChronicleCard state={state} />
        </aside>
      </div>
      {model && <DecisionPopup model={model} open={open} setOpen={setOpen} send={send} />}
    </div>
  );
}

function LandCard({ def, state }: { def: ChapterDefinition; state: GameState }) {
  const tr = useT();
  const preset = def.presets.find((p) => p.id === state.presetId) ?? def.presets[0]!;
  const land = preset.presentation.land;
  return (
    <section className={`${u.card} ${u.in} ${u.d2}`}>
      <div className={v.cardHead}>
        <h2 className={u.h2}>{tr.t(land.title)}</h2>
        <span className={`${u.muted} ${u.small}`}>{tr.t(land.subtitle)}</span>
      </div>
      <p className={`${v.landIntro} ${u.serif}`}>{tr.t(land.intro)}</p>
      <div className={v.facts}>
        {land.facts.map((f) => (
          <div key={f.label} className={v.fact}>
            <span className={v.factMark} aria-hidden="true">
              {tr.t(f.mark)}
            </span>
            <div className={v.factText}>
              <span className={`${u.muted} ${v.factLabel}`}>{tr.t(f.label)}</span>
              <span className={v.factValue}>{tr.t(f.value)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PeopleCard({ def, state }: { def: ChapterDefinition; state: GameState }) {
  const tr = useT();
  const advisors = living(state).filter((p) => p.advisor);
  return (
    <section className={`${u.card} ${u.in} ${u.d3}`}>
      <h2 className={u.h2}>{tr.t('ui.people.title')}</h2>
      <div className={v.people}>
        {advisors.map((p) => {
          const elder = band(def, state, p) === 'elder';
          const health = p.ailments.length > 0 ? p.ailments.map((a) => tr.t(`ailment.${a.kind}`)).join(', ') : tr.t('ui.state.healthy');
          return (
            <div key={p.id} className={v.person}>
              <Portrait seat={p.advisor?.seat} ailing={p.ailments.length > 0} label={tr.label(p.name)} />
              <div className={v.personText}>
                <b>{tr.label(p.name)}</b>
                <span className={`${u.muted} ${v.personRole}`}>
                  {tr.t(`seat.${p.advisor!.seat}`)} · {elder ? `${tr.t('ui.state.elder')} · ` : ''}
                  {health}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GoalsCard({ def, state }: { def: ChapterDefinition; state: GameState }) {
  const tr = useT();
  const goals = goalProgress(def, state);
  return (
    <section className={`${u.cardSm} ${u.in} ${u.d2}`}>
      <h2 className={u.h2accent}>{tr.t('goals.era')}</h2>
      {goals.map((g) => (
        <div key={g.id} className={v.goal}>
          <div className={v.goalHead}>
            <b>{tr.t(`goal.${g.id}`)}</b>
            <span className={u.muted}>{g.pct === null ? '—' : `${Math.round(g.pct * 100)}%`}</span>
          </div>
          <div className={v.bar} aria-hidden="true">
            <div className={v.barFill} style={{ width: `${Math.round((g.pct ?? 0) * 100)}%` }} />
          </div>
          <span className={v.paths}>
            {g.paths.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ' · '}
                <span className={p.pct === null ? v.unmeasured : undefined} title={p.pct === null ? tr.t('ui.goal.unmeasured') : `${Math.round(p.pct * 100)}%`}>
                  {tr.t(`goal.${g.id}.${p.id}`)}
                  {p.pct === null && <span className="visually-hidden"> ({tr.t('ui.goal.unmeasured')})</span>}
                </span>
              </span>
            ))}
          </span>
        </div>
      ))}
    </section>
  );
}

function TribeCard({ def, state }: { def: ChapterDefinition; state: GameState }) {
  const tr = useT();
  const [roster, setRoster] = useState(false);
  const ailing = ailingCount(state);
  return (
    <section className={`${u.cardSm} ${u.in} ${u.d3}`}>
      <h2 className={u.h2accent}>{tr.t('ui.tribe')}</h2>
      <div className={v.bands}>
        {(['adult', 'elder', 'child'] as const).map((b) => (
          <div key={b} className={v.bandBox}>
            <div className={v.bandNum}>{countBand(def, state, b)}</div>
            <div className={`${u.muted} ${v.bandLabel}`}>{tr.t(`ui.tribe.${b === 'adult' ? 'adults' : b === 'elder' ? 'elders' : 'children'}`)}</div>
          </div>
        ))}
      </div>
      <span className={`${u.muted} ${u.small}`}>
        {tr.t('ui.tribe.line', {
          workers: Math.round(workers(def, state)),
          ailing: ailing > 0 ? tr.t('ui.tribe.ailing', { n: ailing }) : tr.t('ui.tribe.noAiling'),
          shelter: tr.t(`shelter.${state.shelter.kind}`),
          units: state.shelter.units,
        })}
      </span>
      <button type="button" className={v.link} onClick={() => setRoster(true)}>
        {tr.t('ui.roster.open', { n: living(state).length })}
      </button>
      {roster && <RosterDialog def={def} state={state} onClose={() => setRoster(false)} />}
    </section>
  );
}

function MemoryCard({ def, state }: { def: ChapterDefinition; state: GameState }) {
  const tr = useT();
  const stale = def.balance.cache.staleAfterMonths;
  const items: string[] = [];
  for (const c of state.caches) {
    items.push(
      state.month - c.checkedMonth < stale
        ? tr.t('brief.cache.known', { place: tr.t(`place.${c.place}`), kg: Math.round(totalKg(c.lots)) })
        : tr.t('brief.cache.unknown', { place: tr.t(`place.${c.place}`) }),
    );
  }
  for (const x of state.scheduled) if (tr.has(`event.${x.event}.memo`)) items.push(tr.t(`event.${x.event}.memo`));
  for (const c of state.clues) items.push(tr.t(`clue.${c.id}`));
  return (
    <section className={`${u.cardSm} ${u.in} ${u.d4}`}>
      <h2 className={u.h2accent}>{tr.t('ui.memory')}</h2>
      {items.length === 0 ? (
        <p className={`${v.memoryEmpty} ${u.muted}`}>{tr.t('ui.memory.empty')}</p>
      ) : (
        <ul className={v.memory}>
          {items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ChronicleCard({ state }: { state: GameState }) {
  const tr = useT();
  const entries = state.chronicle.slice(-4).reverse();
  return (
    <section className={`${u.cardSm} ${u.in} ${u.d5}`}>
      <h2 className={u.h2accent}>{tr.t('ui.chronicle')}</h2>
      {entries.map((c, i) => (
        <p key={i} className={`${v.chron} ${u.serif}`}>
          <span className={v.chronMonth}>{tr.t('ui.chronicle.month', { n: c.month, month: tr.t(`month.${c.monthId}`) })}</span> {lineText(tr, c)}
        </p>
      ))}
    </section>
  );
}

