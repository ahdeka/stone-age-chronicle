// M1 상태 확인 화면: 엔진의 월/순 진행을 글과 표로 그대로 보여 준다.
// M2에서 장면 그림, "계속" 진행, 평온한 달 요약, 증감 애니메이션을 가진 화면으로 바뀐다.

import { useCallback, useEffect } from 'react';
import {
  ageYears,
  band,
  findEvent,
  findPolicy,
  firewoodDays,
  foodDays,
  LEFTOVER_OPTIONS,
  leftoverAvailable,
  monthDef,
  optionStatuses,
  population,
  reduce,
  totalKg,
  type ChapterDefinition,
  type Command,
  type GameState,
  type PhaseReport,
} from '../../engine';
import { DebugPanel } from '../components/DebugPanel';
import { ExportButton } from '../components/SaveControls';
import { kg, lineText, resName, sourceName } from '../format';
import { useT } from '../i18n';
import s from './status.module.css';
import base from './screens.module.css';

interface Props {
  def: ChapterDefinition;
  state: GameState;
  onChange: (s: GameState) => void;
  onQuit: () => void;
}

export function StatusScreen({ def, state, onChange, onQuit }: Props) {
  const tr = useT();
  const send = useCallback(
    (cmd: Command) => {
      const r = reduce(def, state, cmd);
      if (r.error) console.warn(r.error);
      else onChange(r.state);
    },
    [def, state, onChange],
  );

  // 키보드: 1~5 선택, Space/Enter 다음 달
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 5) {
        if (state.step === 'policy') {
          const c = state.work.candidates[n - 1];
          if (c) send({ type: 'choosePolicy', uid: c.uid });
        } else if (state.step === 'decision' && state.work.decision) {
          const d = state.work.decision;
          const ids = d.kind === 'leftover' ? [...LEFTOVER_OPTIONS] : findEvent(def, d.eventId).options.map((o) => o.id);
          const id = ids[n - 1];
          if (id) send({ type: 'chooseOption', uid: d.uid, optionId: id });
        }
      } else if ((e.key === ' ' || e.key === 'Enter') && state.step === 'settlement') {
        e.preventDefault();
        send({ type: 'nextMonth' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [def, state, send]);

  const m = monthDef(def, state);

  return (
    <div>
      <header className={s.bar}>
        <span>
          <strong>{tr.t('tribe.name')}</strong> · {tr.t('brief.month', { n: state.month, month: tr.t(`month.${m.id}`), season: tr.t(`season.${m.season}`) })}
        </span>
        <span>{state.work.weather.map((w) => tr.t(`weather.${w}`)).join(' / ')}</span>
        <span>
          {tr.t('settle.population', { from: state.work.start.population, to: population(state) })}
        </span>
        <span>{tr.t('brief.food', { kg: Math.round(totalKg(state.stores.food)), days: Math.floor(foodDays(def, state)) })}</span>
        <span>{tr.t('brief.firewood', { kg: Math.round(state.stores.firewood), days: Math.floor(firewoodDays(def, state)) })}</span>
        <span>
          {tr.t('ui.cohesion')} {Math.round(state.cohesion)}
        </span>
        <span>{tr.t(`shelter.${state.shelter.kind}`)}</span>
        {state.hungerStage > 0 && <span className={s.down}>{tr.t(`line.hunger.${state.hungerStage}`)}</span>}
      </header>

      <div className={s.layout}>
        <main className={s.main}>
          {state.work.reports.map((r, i) => (
            <Phase key={i} report={r} />
          ))}

          {state.step === 'policy' && <Policies def={def} state={state} send={send} />}
          {state.step === 'decision' && <DecisionBox def={def} state={state} send={send} />}
          {state.step === 'settlement' && (
            <section className={s.box}>
              <h2>{tr.t('ui.settlement')}</h2>
              <Ledger state={state} />
              <p>
                <button type="button" className={base.primary} onClick={() => send({ type: 'nextMonth' })}>
                  {tr.t('ui.nextMonth')}
                </button>
              </p>
            </section>
          )}
          {state.step === 'ended' && state.ending && (
            <section className={s.box}>
              <h2>
                {tr.t('ui.ended')} — {tr.t(`ending.${state.ending.id}.title`)}
              </h2>
              <p>{tr.t(`ending.${state.ending.id}.chron`)}</p>
              <Ledger state={state} />
            </section>
          )}
          <div className={s.row}>
            <ExportButton state={state} />
            <button type="button" className={base.secondary} onClick={onQuit}>
              {tr.t('ui.quit')}
            </button>
          </div>
          {import.meta.env.DEV && <DebugPanel def={def} state={state} onChange={onChange} />}
        </main>

        <aside className={s.side}>
          <People def={def} state={state} />
          <Memory def={def} state={state} />
          <ChronicleBox state={state} />
        </aside>
      </div>
    </div>
  );
}

function Phase({ report }: { report: PhaseReport }) {
  const tr = useT();
  const layers = [report.scene.bg, ...(report.scene.subjects ?? []), ...(report.scene.overlay ? [report.scene.overlay] : [])];
  return (
    <section className={`${s.box} ${s.phase}`}>
      <div className={s.phaseHead}>
        <strong>{tr.t(`ui.phase.${report.slot}`)}</strong>
        {report.weather && <span>{tr.t(`weather.${report.weather}`)}</span>}
        {report.tier && <span className={s.hint}>{tr.t(`tier.${report.tier}`)}</span>}
        <span>{tr.t('ui.scene', { layers: layers.join(' + ') })}</span>
      </div>
      <ul className={s.lines}>
        {report.lines.map((l, i) => (
          <li key={i}>{lineText(tr, l)}</li>
        ))}
      </ul>
      {Object.keys(report.deltas).length > 0 && (
        <div className={s.meta}>
          {Object.entries(report.deltas).map(([res, d]) => (
            <span key={res} className={d >= 0 ? s.up : s.down}>
              {resName(tr, res)} {d >= 0 ? '▲' : '▼'}
              {Math.abs(Math.round(d))}{' '}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function Policies({ def, state, send }: { def: ChapterDefinition; state: GameState; send: (c: Command) => void }) {
  const tr = useT();
  return (
    <section className={s.box}>
      <h2>{tr.t('ui.policies')}</h2>
      <div className={s.choices}>
        {state.work.candidates.map((c, i) => {
          const leader = c.leaderId ? state.people[c.leaderId] : undefined;
          return (
            <button key={c.uid} type="button" className={s.choice} onClick={() => send({ type: 'choosePolicy', uid: c.uid })}>
              <div className={s.choiceTop}>
                <strong>
                  {i + 1}. {tr.t(`policy.${c.policyId}.name`)}
                </strong>
                <span className={s.hint}>{tr.t(`hint.${c.hint}`)}</span>
              </div>
              <div>{tr.t(`policy.${c.policyId}.summary`, { crew: c.crew.length })}</div>
              <div className={s.meta}>
                {findPolicy(def, c.policyId).crew && tr.t('ui.crew', { n: c.crew.length })}
                {leader && ` · ${tr.t('ui.leader', { name: tr.label(leader.name) })}`}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DecisionBox({ def, state, send }: { def: ChapterDefinition; state: GameState; send: (c: Command) => void }) {
  const tr = useT();
  const d = state.work.decision;
  if (!d) return null;
  if (d.kind === 'leftover') {
    return (
      <section className={s.box}>
        <h2>{tr.t('leftover.title')}</h2>
        <p>{tr.t('leftover.text', { kg: Math.round(d.kg) })}</p>
        <div className={s.choices}>
          {LEFTOVER_OPTIONS.map((id, i) => {
            const ok = leftoverAvailable(def, state, id);
            return (
              <button key={id} type="button" className={s.choice} disabled={!ok} onClick={() => send({ type: 'chooseOption', uid: d.uid, optionId: id })}>
                {i + 1}. {tr.t(`leftover.${id}`)}
                {!ok && <div className={s.meta}>⊘ {tr.t(`leftover.${id}.lock`)}</div>}
              </button>
            );
          })}
        </div>
      </section>
    );
  }
  const ev = findEvent(def, d.eventId);
  const leaderId = state.work.chosen?.leaderId;
  return (
    <section className={s.box}>
      <h2>{tr.t(`event.${ev.id}.title`)}</h2>
      <p>{tr.t(`event.${ev.id}.text`)}</p>
      {(ev.speakers ?? []).map((sp, i) => {
        const who = sp.who === 'leader' ? leaderId : typeof sp.who === 'object' && 'seat' in sp.who ? Object.values(state.people).find((p) => p.alive && p.advisor?.seat === (sp.who as { seat: string }).seat)?.id : undefined;
        const p = who ? state.people[who] : undefined;
        return p ? (
          <p key={i}>
            <strong>{tr.label(p.name)}</strong> “{tr.t(sp.line)}”
          </p>
        ) : null;
      })}
      <div className={s.choices}>
        {optionStatuses(def, state, ev, d.actors).map(({ option, available }, i) => (
          <button key={option.id} type="button" className={s.choice} disabled={!available} onClick={() => send({ type: 'chooseOption', uid: d.uid, optionId: option.id })}>
            {i + 1}. {tr.t(`event.${ev.id}.opt.${option.id}`)}
            {!available && <span className={s.meta}> ⊘ {tr.t('ui.locked')}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

function Ledger({ state }: { state: GameState }) {
  const tr = useT();
  const sums = new Map<string, { res: string; source: string; delta: number }>();
  for (const l of state.work.ledger) {
    const k = `${l.res}|${l.source}`;
    const cur = sums.get(k) ?? { res: l.res, source: l.source, delta: 0 };
    cur.delta += l.delta;
    sums.set(k, cur);
  }
  const rows = [...sums.values()].filter((r) => Math.abs(r.delta) >= 0.5).sort((a, b) => (a.res === b.res ? b.delta - a.delta : a.res < b.res ? -1 : 1));
  return (
    <table className={s.table}>
      <thead>
        <tr>
          <th>{tr.t('ui.ledger.res')}</th>
          <th>{tr.t('ui.ledger.source')}</th>
          <th>{tr.t('ui.ledger.delta')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.res}|${r.source}`}>
            <td>{resName(tr, r.res)}</td>
            <td>{sourceName(tr, r.source)}</td>
            <td className={r.delta >= 0 ? s.up : s.down}>
              {r.delta >= 0 ? '+' : '−'}
              {r.res === 'food' || r.res === 'firewood' ? kg(Math.abs(r.delta)) : Math.abs(Math.round(r.delta))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function People({ def, state }: { def: ChapterDefinition; state: GameState }) {
  const tr = useT();
  const order = { adult: 0, elder: 1, child: 2 } as const;
  const people = Object.values(state.people)
    .filter((p) => p.alive)
    .sort((a, b) => Number(!!b.advisor) - Number(!!a.advisor) || order[band(def, state, a)] - order[band(def, state, b)] || (a.id < b.id ? -1 : 1));
  const dead = Object.values(state.people).filter((p) => !p.alive);
  return (
    <section className={s.box}>
      <h3>
        {tr.t('ui.people')} ({people.length})
      </h3>
      <div className={s.scroll}>
        <table className={s.table}>
          <tbody>
            {people.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.advisor ? <strong>{tr.label(p.name)}</strong> : tr.label(p.name)}
                  {p.advisor && <span className={s.meta}> {tr.t(`seat.${p.advisor.seat}`)}</span>}
                </td>
                <td className={s.meta}>{p.ailments.map((a) => tr.t(`ailment.${a.kind}`)).join(', ') || tr.t('ui.healthy')}</td>
                <td>{tr.t('ui.age', { age: ageYears(state, p) })}</td>
              </tr>
            ))}
            {dead.map((p) => (
              <tr key={p.id} className={s.meta}>
                <td>† {tr.label(p.name)}</td>
                <td>{tr.t(`cause.${p.cause}`)}</td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Memory({ def, state }: { def: ChapterDefinition; state: GameState }) {
  const tr = useT();
  const stale = def.balance.cache.staleAfterMonths;
  return (
    <section className={s.box}>
      <h3>{tr.t('ui.memory')}</h3>
      <ul className={s.lines}>
        {state.caches.map((c) => (
          <li key={c.id}>
            {state.month - c.checkedMonth < stale
              ? tr.t('brief.cache.known', { place: tr.t(`place.${c.place}`), kg: Math.round(totalKg(c.lots)) })
              : tr.t('brief.cache.unknown', { place: tr.t(`place.${c.place}`) })}
          </li>
        ))}
        {state.clues.map((c) => (
          <li key={c.id}>{tr.t(`clue.${c.id}`)}</li>
        ))}
        {state.scheduled.map((x) => (
          <li key={x.uid}>{tr.t(`event.${x.event}.title`)}</li>
        ))}
        {state.knowledge.has.map((k) => (
          <li key={k}>{tr.t('line.knowledge', { knowledge: tr.t(`knowledge.${k}`) })}</li>
        ))}
      </ul>
    </section>
  );
}

function ChronicleBox({ state }: { state: GameState }) {
  const tr = useT();
  return (
    <section className={s.box}>
      <h3>{tr.t('ui.chronicle')}</h3>
      <ul className={`${s.lines} ${s.scroll}`}>
        {state.chronicle
          .slice()
          .reverse()
          .map((c, i) => (
            <li key={i}>
              <span className={s.meta}>{tr.t(`month.${c.monthId}`)} · </span>
              {lineText(tr, c)}
            </li>
          ))}
      </ul>
    </section>
  );
}
