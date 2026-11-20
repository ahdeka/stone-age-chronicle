// 연대기: 기록자 시점의 한 문장씩. 최근 것이 위.

import type { GameState } from '../../engine';
import { useT } from '../i18n';
import { chronicleSentence, chronicleTime } from '../format';
import s from './game.module.css';

export function Chronicle({ state, limit }: { state: GameState; limit?: number }) {
  const tr = useT();
  const entries = [...state.chronicle].reverse().slice(0, limit ?? state.chronicle.length);
  return (
    <section className={s.chronicle} aria-label={tr.t('ui.chronicle')}>
      <h2>{tr.t('ui.chronicle')}</h2>
      {entries.length === 0 ? (
        <p className={s.muted}>{tr.t('ui.chronicleEmpty')}</p>
      ) : (
        <ol>
          {entries.map((e, i) => (
            <li key={`${e.turn}-${i}`} className={i === 0 ? s.chronNew : undefined}>
              <span className={s.chronTime}>{chronicleTime(e, tr)},</span> {chronicleSentence(e, tr)}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
