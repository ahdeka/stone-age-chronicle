// 부족원 명단: 전원의 이름, 나이, 가족, 상태 (조언자 외의 사람은 여기서 본다)

import { useEffect, useRef } from 'react';
import { ageYears, band, type ChapterDefinition, type GameState, type Person } from '../../engine';
import { useT } from '../i18n';
import { Icon } from './bits';
import r from './roster.module.css';
import u from '../ui.module.css';

export function RosterDialog({ def, state, onClose }: { def: ChapterDefinition; state: GameState; onClose: () => void }) {
  const tr = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const order = { adult: 0, elder: 1, child: 2 } as const;
  const all = Object.values(state.people);
  const alive = all
    .filter((p) => p.alive)
    .sort((a, b) => Number(!!b.isChief) - Number(!!a.isChief) || Number(!!b.advisor) - Number(!!a.advisor) || order[band(def, state, a)] - order[band(def, state, b)] || ageYears(state, b) - ageYears(state, a));
  const dead = all.filter((p) => !p.alive);
  const names = (p: Person) => p.parents.map((id) => state.people[id]).filter((x): x is Person => !!x).map((x) => tr.label(x.name)).join(', ');

  return (
    <div className={r.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} className={r.dialog} role="dialog" aria-modal="true" aria-label={tr.t('ui.roster.title')}>
        <div className={r.head}>
          <h2 className={u.h2}>
            {tr.t('ui.roster.title')} <span className={u.muted}>{alive.length}</span>
          </h2>
          <button type="button" className={u.btnGhost} onClick={onClose}>
            {tr.t('ui.roster.close')} <Icon name="close" size={16} />
          </button>
        </div>
        <table className={r.table}>
          <tbody>
            {alive.map((p) => (
              <tr key={p.id}>
                <td>
                  <b>{tr.label(p.name)}</b>
                  {p.advisor && <span className={r.seat}> {tr.t(`seat.${p.advisor.seat}`)}</span>}
                </td>
                <td className={u.muted}>
                  {tr.t(`ui.tribe.${band(def, state, p) === 'adult' ? 'adults' : band(def, state, p) === 'elder' ? 'elders' : 'children'}`)} ·{' '}
                  {tr.t('ui.age', { age: ageYears(state, p) })}
                </td>
                <td className={p.ailments.length > 0 ? r.ailing : u.muted}>
                  {p.ailments.length > 0 ? p.ailments.map((a) => tr.t(`ailment.${a.kind}`)).join(', ') : tr.t('ui.state.healthy')}
                </td>
                <td className={u.muted}>{p.parents.length > 0 ? tr.t('ui.roster.parents', { names: names(p) }) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {dead.length > 0 && (
          <>
            <h3 className={r.sub}>{tr.t('ui.roster.dead')}</h3>
            <ul className={r.dead}>
              {dead.map((p) => (
                <li key={p.id}>
                  † {tr.label(p.name)} — {tr.t(`cause.${p.cause}`)}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
