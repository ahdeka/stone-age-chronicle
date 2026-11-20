// 이벤트 카드: 상황 + 선택지 (1~4 키). 잠긴 선택지는 숨기지 않고 흐리게, 해금 힌트와 함께.

import { findEvent, optionStatuses, previewEffects, type ChapterDefinition, type GameState } from '../../engine';
import { useT } from '../i18n';
import { liveParams, lockHint } from '../format';
import { Preview } from './Preview';
import s from './game.module.css';

interface Props {
  def: ChapterDefinition;
  state: GameState;
  onChoose: (eventUid: string, optionId: string) => void;
}

export function EventCard({ def, state, onChoose }: Props) {
  const tr = useT();
  const { t } = tr;
  const inst = state.events.pending[0];
  if (!inst) return null;
  const ev = findEvent(def, inst.eventId);
  if (!ev) return null;
  const params = liveParams(def, state, tr, inst.actors);
  const textKey = inst.variant ? `event.${ev.id}.text.${inst.variant}` : `event.${ev.id}.text`;
  const options = optionStatuses(def, state, inst).filter((o) => o.visible);

  return (
    <article className={s.eventCard} key={inst.uid} aria-live="polite">
      <header className={s.cardHead}>
        <span className={s.kindTag}>{state.events.pending.length > 1 ? t('ui.eventCount', { i: 1, n: state.events.pending.length }) : ''}</span>
        <h2>{t(`event.${ev.id}.title`, params)}</h2>
      </header>
      <p className={s.body}>{t(textKey, params)}</p>
      <ol className={s.options}>
        {options.map((o, i) => {
          const items = previewEffects(def, state, o.option.effects, inst.actors);
          const later = (o.option.followUps?.length ?? 0) > 0 && !items.some((x) => x.kind === 'later');
          if (later) items.push({ kind: 'later' });
          return (
            <li key={o.option.id}>
              <button
                type="button"
                className={o.available ? s.option : s.optionLocked}
                disabled={!o.available}
                onClick={() => onChoose(inst.uid, o.option.id)}
                aria-keyshortcuts={String(i + 1)}
              >
                <span className={s.key}>{i + 1}</span>
                <span className={s.optionMain}>
                  <span className={s.optionLabel}>
                    {!o.available && <span aria-label={t('ui.locked')}>⊘ </span>}
                    {t(`event.${ev.id}.opt.${o.option.id}`, params)}
                  </span>
                  {o.available ? (
                    <Preview items={items} def={def} state={state} />
                  ) : (
                    <span className={s.lockHint}>{lockHint(o.failed, o.option.lockHintKey, tr)}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className={s.keysHint}>{t('ui.keysOptions')}</p>
    </article>
  );
}
