// 개발 모드 전용 디버그 패널: 시드·턴 보기, 자원 바꾸기, 이벤트 강제 발생, 턴 건너뛰기, 플래그·카운터·예약 보기.
// import.meta.env.DEV가 아니면 GameScreen이 이 컴포넌트를 그리지 않는다.

import { useState } from 'react';
import { optionStatuses, reduce, type ChapterDefinition, type Command, type GameState } from '../../engine';
import { useT } from '../i18n';
import s from './game.module.css';

interface Props {
  def: ChapterDefinition;
  state: GameState;
  dispatch: (cmd: Command) => void;
  replace: (s: GameState) => void;
}

/** 이벤트는 고를 수 있는 첫 선택지로, 카드는 쓰지 않고 n턴을 넘긴다 */
function skipTurns(def: ChapterDefinition, start: GameState, n: number): GameState {
  let s = start;
  const target = s.turn + n;
  let guard = 0;
  while (s.phase !== 'ended' && s.turn < target && guard++ < 1000) {
    if (s.phase === 'event') {
      const inst = s.events.pending[0]!;
      const opt = optionStatuses(def, s, inst).find((o) => o.available);
      if (!opt) break;
      s = reduce(def, s, { type: 'chooseOption', eventUid: inst.uid, optionId: opt.option.id }).state;
    } else {
      s = reduce(def, s, { type: 'endActionPhase' }).state;
    }
  }
  return s;
}

export function DebugPanel({ def, state, dispatch, replace }: Props) {
  const { t } = useT();
  const [eventId, setEventId] = useState(def.content.events[0]?.id ?? '');
  const [resKey, setResKey] = useState(def.resources[0]?.id ?? '');
  const [resVal, setResVal] = useState('0');

  return (
    <details className={s.debug}>
      <summary>{t('debug.title')}</summary>
      <dl>
        <dt>{t('debug.seed')}</dt>
        <dd>{state.seed}</dd>
        <dt>{t('debug.turn')}</dt>
        <dd>
          {state.turn} / {def.balance.turnLimit} ({state.phase})
        </dd>
      </dl>
      <div className={s.debugRow}>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} aria-label={t('debug.forceEvent')}>
          {def.content.events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.id}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => dispatch({ type: 'debug', debug: { op: 'forceEvent', eventId } })}>
          {t('debug.forceEvent')}
        </button>
      </div>
      <div className={s.debugRow}>
        <select value={resKey} onChange={(e) => setResKey(e.target.value)} aria-label={t('debug.setResource')}>
          {def.resources.map((r) => (
            <option key={r.id} value={r.id}>
              {t(`resource.${r.id}.name`)}
            </option>
          ))}
        </select>
        <input value={resVal} onChange={(e) => setResVal(e.target.value)} inputMode="numeric" size={5} aria-label={t('debug.setResource')} />
        <button type="button" onClick={() => dispatch({ type: 'debug', debug: { op: 'setResource', key: resKey, value: Number(resVal) || 0 } })}>
          {t('debug.apply')}
        </button>
      </div>
      <div className={s.debugRow}>
        {[1, 4, 12].map((n) => (
          <button key={n} type="button" onClick={() => replace(skipTurns(def, state, n))}>
            {t('debug.skip', { n })}
          </button>
        ))}
      </div>
      <h3>{t('debug.flags')}</h3>
      <pre>{JSON.stringify(state.flags)}</pre>
      <h3>{t('debug.counters')}</h3>
      <pre>{JSON.stringify(state.counters)}</pre>
      <h3>{t('debug.scheduled')}</h3>
      <pre>{JSON.stringify(state.events.scheduled.map((x) => `${x.eventId}@${x.dueTurn}`))}</pre>
      <pre>{JSON.stringify(state.tribe.axes)}</pre>
    </details>
  );
}
