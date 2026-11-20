// 개발 모드 전용 디버그 패널 (CLAUDE.md "재미 검증 도구" 1). 빌드에서는 import.meta.env.DEV로 빠진다.

import { useState } from 'react';
import { firstChoice, playMonths, reduce, type ChapterDefinition, type DebugOp, type GameState } from '../../engine';
import { useT } from '../i18n';
import u from '../ui.module.css';

export function DebugPanel({ def, state, onChange }: { def: ChapterDefinition; state: GameState; onChange: (s: GameState) => void }) {
  const tr = useT();
  const [eventId, setEventId] = useState(def.content.events[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  const debug = (op: DebugOp) => {
    const r = reduce(def, state, { type: 'debug', debug: op });
    setError(r.error ?? null);
    if (!r.error) onChange(r.state);
  };
  const skip = () => {
    const next = structuredClone(state);
    try {
      playMonths(def, next, firstChoice, 1);
      setError(null);
      onChange(next);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <details
      style={{
        position: 'fixed',
        left: 12,
        bottom: 12,
        zIndex: 30,
        maxWidth: 'min(520px, calc(100vw - 24px))',
        maxHeight: '60vh',
        overflow: 'auto',
        padding: '8px 12px',
        borderRadius: 12,
        background: 'var(--sheet)',
        border: '1px solid var(--border-strong)',
        fontSize: 'var(--fs-sm)',
      }}
    >
      <summary style={{ cursor: 'pointer' }}>{tr.t('ui.debug')}</summary>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <button type="button" className={u.btnGhost} onClick={skip}>
          {tr.t('ui.debug.skip')}
        </button>
        <button type="button" className={u.btnGhost} onClick={() => debug({ op: 'setFood', kind: 'raw_meat', kg: 1000 })}>
          {tr.t('ui.debug.food')}
        </button>
        <button type="button" className={u.btnGhost} onClick={() => debug({ op: 'setFirewood', kg: 0 })}>
          {tr.t('ui.debug.firewood')}
        </button>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} aria-label={tr.t('ui.debug.event')}>
          {def.content.events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.id}
            </option>
          ))}
        </select>
        <button type="button" className={u.btnGhost} onClick={() => debug({ op: 'forceEvent', eventId })}>
          {tr.t('ui.debug.event')}
        </button>
      </div>
      {error && <p role="alert">{error.startsWith('error.') ? tr.t(error) : error}</p>}
      <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>
        {JSON.stringify(
          {
            seed: state.seed,
            step: state.step,
            flags: state.flags,
            counters: state.counters,
            animals: state.animals,
            clues: state.clues,
            scheduled: state.scheduled,
            caches: state.caches,
            knowledge: state.knowledge,
            hungerStage: state.hungerStage,
          },
          null,
          1,
        )}
      </pre>
    </details>
  );
}
