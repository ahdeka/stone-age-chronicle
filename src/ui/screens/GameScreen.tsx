// M1 상태 확인용 최소 화면. 레이아웃은 최종 구조(상단 바 / 좌측 부족 / 중앙 / 우측 연대기 / 하단 턴 종료)를 미리 따른다.

import { useEffect, useState } from 'react';
import { reduce, type ChapterDefinition, type Command, type GameState, type LogEntry } from '../../engine';
import { commonBalance } from '../../data/balance';
import { Icon } from '../icons/Icon';
import { useT } from '../i18n';
import { ExportButton, LoadButton } from '../components/SaveControls';
import s from './screens.module.css';

interface Props {
  def: ChapterDefinition;
  state: GameState;
  onChange: (s: GameState) => void;
  onQuit: () => void;
}

const fmt = (v: number) => Math.floor(v + 1e-9);
const fmtDelta = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r)}`;
};

export function GameScreen({ def, state, onChange, onQuit }: Props) {
  const { t, label } = useT();
  const [error, setError] = useState<string | null>(null);

  const dispatch = (cmd: Command) => {
    const r = reduce(def, state, cmd);
    if (r.error) return setError(r.error);
    setError(null);
    onChange(r.state);
  };

  // ── 역할 배분 초안: 합계가 인구와 맞을 때만 엔진에 보낸다 ──
  const [draft, setDraft] = useState(state.tribe.roles);
  useEffect(() => setDraft(state.tribe.roles), [state.tribe.roles]);
  const assigned = Object.values(draft).reduce((a, b) => a + b, 0);
  const unassigned = state.tribe.population - assigned;
  const changeRole = (role: string, d: number) => {
    const next = { ...draft, [role]: Math.max(0, (draft[role] ?? 0) + d) };
    const sum = Object.values(next).reduce((a, b) => a + b, 0);
    if (sum > state.tribe.population) return;
    setDraft(next);
    if (sum === state.tribe.population) dispatch({ type: 'setRoles', roles: next });
  };

  const canEnd = state.phase === 'action' && unassigned === 0;
  const endTurn = () => canEnd && dispatch({ type: 'endActionPhase' });

  // ── 키보드: Space / Enter로 턴 종료 (입력 칸이나 버튼에 포커스가 있을 때는 그쪽 동작을 따른다) ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'TEXTAREA') return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        endTurn();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const seasonName = t(`season.${state.season}.name`);
  const timeLabel = t('time.reignSeason', { reign: state.reign, season: seasonName });
  const last = state.history[state.history.length - 1];

  return (
    <div className={s.game}>
      {/* 상단: 시간과 자원 */}
      <header className={s.topbar}>
        <div className={s.time}>
          <strong>{timeLabel}</strong>
          <span className={s.muted}>
            {label(state.tribe.name)} · {t(`era.${state.eraId}.name`)} · {t(`lifestyle.${state.tribe.lifestyle}.name`)}
          </span>
          {state.turn >= def.balance.warnTurn && state.phase !== 'ended' && <span className={s.warn}>{t('time.legendEnding')}</span>}
        </div>
        <ul className={s.resources}>
          <li>
            <Icon name="population" />
            <span>{t('ui.population')}</span>
            <strong>{state.tribe.population}</strong>
          </li>
          {def.resources.map((r) => (
            <li key={r.id}>
              <Icon name={r.icon} />
              <span>{t(`resource.${r.id}.name`)}</span>
              <strong>{fmt(state.tribe.resources[r.id] ?? 0)}</strong>
            </li>
          ))}
        </ul>
      </header>

      {/* 좌측: 부족 패널 */}
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
                <li key={a.id}>
                  <div className={s.axisLabels}>
                    <span>◀ {t(`axis.${a.id}.neg`)}</span>
                    <span className={s.muted}>{Math.round(v)}</span>
                    <span>{t(`axis.${a.id}.pos`)} ▶</span>
                  </div>
                  <div className={s.axisTrack} aria-hidden>
                    <div className={s.axisMark} style={{ left: `${pct}%` }} />
                  </div>
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

      {/* 중앙: 지금은 지난 계절 요약 (M2에서 이벤트/카드 영역) */}
      <main className={s.center}>
        {state.phase === 'ended' && state.ending ? (
          <section className={s.card}>
            <h2>{t(`ending.${state.ending.id}.title`)}</h2>
            <p>{t(`ending.${state.ending.id}.text`)}</p>
          </section>
        ) : (
          <p className={s.notice}>{t('ui.m1Notice')}</p>
        )}
        <section className={s.card}>
          <h2>{t('ui.lastSeason')}</h2>
          {last ? <Summary log={last.log} /> : <p className={s.muted}>{t('ui.nothingHappened')}</p>}
        </section>
        {error && (
          <p role="alert" className={s.error}>
            {t(error)}
          </p>
        )}
      </main>

      {/* 우측: 연대기 자리 (M2) — 지금은 저장 도구 */}
      <aside className={s.right}>
        <section className={s.panel}>
          <ExportButton state={state} />
          <LoadButton onLoad={onChange} />
          <button type="button" className={s.secondary} onClick={onQuit}>
            {t('ui.newGame')}
          </button>
        </section>
      </aside>

      {/* 하단: 턴 종료 */}
      <footer className={s.footer}>
        <button type="button" className={s.primary} onClick={endTurn} disabled={!canEnd}>
          {state.phase === 'ended' ? t('ui.ended') : t('ui.endTurn')}
          <span className={s.kbd}>{t('ui.endTurnHint')}</span>
        </button>
      </footer>
    </div>
  );
}

/** 지난 계절의 변화를 출처별로 묶어 보여 준다. 색과 함께 부호(+/−)를 항상 표시한다. */
function Summary({ log }: { log: LogEntry[] }) {
  const { t, has } = useT();
  const rows: { source: string; text: string; delta: number }[] = [];
  const byKey = new Map<string, number>();
  for (const l of log) {
    if (l.kind === 'resource') byKey.set(`${l.source}|resource.${l.key}.name`, (byKey.get(`${l.source}|resource.${l.key}.name`) ?? 0) + l.delta);
    if (l.kind === 'population') byKey.set(`${l.source}|ui.population`, (byKey.get(`${l.source}|ui.population`) ?? 0) + l.delta);
  }
  for (const [k, delta] of byKey) {
    const [source, nameKey] = k.split('|') as [string, string];
    rows.push({ source: has(`source.${source}`) ? t(`source.${source}`) : source, text: t(nameKey), delta });
  }
  const stages = log.filter((l) => l.kind === 'stage');
  if (rows.length === 0 && stages.length === 0) return <p>{t('ui.nothingHappened')}</p>;
  return (
    <ul className={s.summary}>
      {rows.map((r, i) => (
        <li key={i}>
          <span className={s.muted}>{r.source}</span>
          <span>{r.text}</span>
          <strong className={r.delta >= 0 ? s.good : s.bad}>
            {r.delta >= 0 ? '▲' : '▼'} {fmtDelta(r.delta)}
          </strong>
        </li>
      ))}
    </ul>
  );
}
