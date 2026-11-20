// 게임 화면: 상단 자원/계절 바 / 좌측 부족 패널 / 중앙 카드 영역 / 우측 연대기 / 하단 턴 종료 (CLAUDE.md UI/UX)

import { useEffect, useState } from 'react';
import { optionStatuses, reduce, type ChapterDefinition, type Command, type GameState, type LogEntry } from '../../engine';
import { commonBalance } from '../../data/balance';
import { Chronicle } from '../components/Chronicle';
import { DebugPanel } from '../components/DebugPanel';
import { EventCard } from '../components/EventCard';
import { Hand } from '../components/Hand';
import { ExportButton, LoadButton } from '../components/SaveControls';
import { fmtDelta, fmtInt } from '../format';
import { useDeltas, type Delta } from '../hooks/useDeltas';
import { Icon } from '../icons/Icon';
import { useT } from '../i18n';
import g from '../components/game.module.css';
import s from './screens.module.css';

interface Props {
  def: ChapterDefinition;
  state: GameState;
  onChange: (s: GameState) => void;
  onQuit: () => void;
}

function Floats({ deltas, target }: { deltas: Delta[]; target: string }) {
  return (
    <>
      {deltas
        .filter((d) => d.target === target)
        .map((d) => (
          <span key={d.id} className={d.delta > 0 ? g.floatUp : g.floatDown} aria-hidden>
            {d.delta > 0 ? '▲' : '▼'}
            {fmtDelta(d.delta)}
          </span>
        ))}
    </>
  );
}

export function GameScreen({ def, state, onChange, onQuit }: Props) {
  const { t, label } = useT();
  const [error, setError] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<Record<string, string>>({});
  const deltas = useDeltas(state);

  const dispatch = (cmd: Command) => {
    const r = reduce(def, state, cmd);
    if (r.error) return setError(r.error);
    setError(null);
    onChange(r.state);
  };

  // ── 역할 배분 초안: 합계가 인구와 맞을 때만 엔진에 보낸다 ──
  const [draft, setDraft] = useState(state.tribe.roles);
  useEffect(() => setDraft(state.tribe.roles), [state.tribe.roles]);
  const unassigned = state.tribe.population - Object.values(draft).reduce((a, b) => a + b, 0);
  const changeRole = (role: string, d: number) => {
    const next = { ...draft, [role]: Math.max(0, (draft[role] ?? 0) + d) };
    const sum = Object.values(next).reduce((a, b) => a + b, 0);
    if (sum > state.tribe.population) return;
    setDraft(next);
    if (sum === state.tribe.population) dispatch({ type: 'setRoles', roles: next });
  };

  const canEnd = state.phase === 'action' && unassigned === 0;
  const endTurn = () => {
    if (!canEnd) return;
    setAssignees({});
    dispatch({ type: 'endActionPhase' });
  };
  const play = (cardUid: string) => dispatch({ type: 'playAction', cardUid, personId: assignees[cardUid] || undefined });

  // ── 키보드: 1~4 선택지, 1~5 카드, Space/Enter 턴 종료 ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const n = Number(e.key);
      if (state.phase === 'event' && n >= 1 && n <= 4) {
        const inst = state.events.pending[0];
        const opt = inst && optionStatuses(def, state, inst).filter((o) => o.visible)[n - 1];
        if (inst && opt?.available) dispatch({ type: 'chooseOption', eventUid: inst.uid, optionId: opt.option.id });
        return;
      }
      if (state.phase === 'action' && n >= 1 && n <= 5) {
        const card = state.deck.hand[n - 1];
        if (card) play(card.uid);
        return;
      }
      if ((e.key === ' ' || e.key === 'Enter') && tag !== 'BUTTON') {
        e.preventDefault();
        endTurn();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const timeLabel = t('time.reignSeason', { reign: state.reign, season: t(`season.${state.season}.name`) });
  const last = state.history[state.history.length - 1];

  return (
    <div className={s.game}>
      <header className={s.topbar}>
        <div className={s.time}>
          <strong className={g.seasonName} key={state.turn}>
            {timeLabel}
          </strong>
          <span className={s.muted}>
            {label(state.tribe.name)} · {t(`era.${state.eraId}.name`)} · {t(`lifestyle.${state.tribe.lifestyle}.name`)}
          </span>
          {state.turn >= def.balance.warnTurn && state.phase !== 'ended' && <span className={s.warn}>{t('time.legendEnding')}</span>}
        </div>
        <ul className={s.resources}>
          <li className={g.resItem}>
            <Icon name="population" />
            <span>{t('ui.population')}</span>
            <strong>{state.tribe.population}</strong>
            <Floats deltas={deltas} target="population" />
          </li>
          {def.resources.map((r) => (
            <li key={r.id} className={g.resItem}>
              <Icon name={r.icon} />
              <span>{t(`resource.${r.id}.name`)}</span>
              <strong>{fmtInt(state.tribe.resources[r.id] ?? 0)}</strong>
              <Floats deltas={deltas} target={`resource:${r.id}`} />
            </li>
          ))}
        </ul>
      </header>

      <aside className={s.left}>
        <section className={s.panel}>
          <h2>{t('ui.roles')}</h2>
          <ul className={s.roles}>
            {def.roles.map((r) => (
              <li key={r.id}>
                <Icon name={r.icon} />
                <span className={s.grow}>{t(`role.${r.id}.name`)}</span>
                <button type="button" aria-label={`${t(`role.${r.id}.name`)} −1`} onClick={() => changeRole(r.id, -1)} disabled={(draft[r.id] ?? 0) <= 0}>
                  −
                </button>
                <strong className={s.count}>{draft[r.id] ?? 0}</strong>
                <button type="button" aria-label={`${t(`role.${r.id}.name`)} +1`} onClick={() => changeRole(r.id, 1)} disabled={unassigned <= 0}>
                  +
                </button>
              </li>
            ))}
          </ul>
          {unassigned !== 0 && (
            <p className={s.warn}>
              {t('ui.rolesUnassigned')}: {unassigned}
            </p>
          )}
        </section>

        <section className={s.panel}>
          <h2>{t('ui.axes')}</h2>
          <ul className={s.axes}>
            {def.axes.map((a) => {
              const v = state.tribe.axes[a.id] ?? 0;
              const pct = ((v - a.min) / (a.max - a.min)) * 100;
              return (
                <li key={a.id} className={g.axisItem}>
                  <div className={s.axisLabels}>
                    <span>◀ {t(`axis.${a.id}.neg`)}</span>
                    <span className={s.muted}>{Math.round(v)}</span>
                    <span>{t(`axis.${a.id}.pos`)} ▶</span>
                  </div>
                  <div className={s.axisTrack} aria-hidden>
                    <div className={`${s.axisMark} ${g.axisMarkMove}`} style={{ left: `${pct}%` }} />
                  </div>
                  <Floats deltas={deltas} target={`axis:${a.id}`} />
                </li>
              );
            })}
          </ul>
        </section>

        <section className={s.panel}>
          <h2>{t('ui.people')}</h2>
          <ul className={s.people}>
            {Object.values(state.people)
              .filter((p) => p.alive)
              .map((p) => {
                const stage = def.lifeStages.find((x) => x.id === p.stage);
                const near = stage?.next && stage.turnsToNext - p.stageTurns <= commonBalance.ui.stageHintTurns;
                return (
                  <li key={p.id}>
                    <strong>{label(p.name)}</strong>
                    {p.office && <span className={s.tag}>{t(`office.${p.office}.name`)}</span>}
                    {state.actions.busy.includes(p.id) && <span className={s.tag}>✓</span>}
                    <div className={s.muted}>
                      {t(`stage.${p.stage}.name`)}
                      {near ? ` · ${t('ui.stageNear')}` : ''} · {p.traits.map((tr) => t(`trait.person.${tr}.name`)).join(', ')}
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      </aside>

      <main className={s.center}>
        {state.phase === 'ended' && state.ending && (
          <section className={g.endingCard}>
            <h2>{t(`ending.${state.ending.id}.title`)}</h2>
            <p className={g.body}>{t(`ending.${state.ending.id}.text`)}</p>
          </section>
        )}
        {state.phase === 'event' && <EventCard def={def} state={state} onChoose={(eventUid, optionId) => dispatch({ type: 'chooseOption', eventUid, optionId })} />}
        {state.phase === 'action' && (
          <Hand
            def={def}
            state={state}
            assignees={assignees}
            onAssign={(uid, pid) => setAssignees((a) => ({ ...a, [uid]: pid }))}
            onPlay={play}
          />
        )}
        {last && state.phase !== 'ended' && (
          <details className={s.card} open={state.phase === 'action'}>
            <summary>
              <h2 className={g.inlineH}>{t('ui.lastSeason')}</h2>
            </summary>
            <Summary log={last.log} />
          </details>
        )}
        {error && (
          <p role="alert" className={s.error}>
            {t(error)}
          </p>
        )}
      </main>

      <aside className={s.right}>
        <Chronicle state={state} />
        <section className={s.panel}>
          <ExportButton state={state} />
          <LoadButton onLoad={onChange} />
          <button type="button" className={s.secondary} onClick={onQuit}>
            {t('ui.newGame')}
          </button>
        </section>
        {import.meta.env.DEV && <DebugPanel def={def} state={state} dispatch={dispatch} replace={onChange} />}
      </aside>

      <footer className={s.footer}>
        <button type="button" className={s.primary} onClick={endTurn} disabled={!canEnd}>
          {state.phase === 'ended' ? t('ui.ended') : t('ui.endTurn')}
          <span className={s.kbd}>{t('ui.endTurnHint')}</span>
        </button>
      </footer>
    </div>
  );
}

/** 지난 계절의 변화를 출처별로 묶어 보여 준다. 색과 함께 부호(▲▼ +/−)를 항상 표시한다. */
function Summary({ log }: { log: LogEntry[] }) {
  const { t, has } = useT();
  const byKey = new Map<string, number>();
  const add = (k: string, d: number) => byKey.set(k, (byKey.get(k) ?? 0) + d);
  for (const l of log) {
    if (l.kind === 'resource') add(`${l.source}|resource.${l.key}.name`, l.delta);
    if (l.kind === 'population') add(`${l.source}|ui.population`, l.delta);
  }
  const sourceName = (src: string) => {
    if (has(`source.${src}`)) return t(`source.${src}`);
    const ev = /^event\.([^.]+)\./.exec(src);
    if (ev && has(`event.${ev[1]}.title`)) return t(`event.${ev[1]}.title`);
    const ac = /^action\.([^.]+)$/.exec(src);
    if (ac && has(`action.${ac[1]}.name`)) return t(`action.${ac[1]}.name`);
    return src;
  };
  const rows = [...byKey].filter(([, d]) => Math.abs(d) >= 0.05);
  if (rows.length === 0) return <p>{t('ui.nothingHappened')}</p>;
  return (
    <ul className={s.summary}>
      {rows.map(([k, delta]) => {
        const [source, nameKey] = k.split('|') as [string, string];
        return (
          <li key={k}>
            <span className={s.muted}>{sourceName(source)}</span>
            <span>{t(nameKey)}</span>
            <strong className={delta >= 0 ? s.good : s.bad}>
              {delta >= 0 ? '▲' : '▼'} {fmtDelta(delta)}
            </strong>
          </li>
        );
      })}
    </ul>
  );
}
