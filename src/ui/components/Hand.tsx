// 행동 손패: 카드마다 대가, 효과 미리보기, 맡길 사람. 1~5 키로 쓴다.

import { canAssign, cardStatus, previewEffects, type ChapterDefinition, type GameState } from '../../engine';
import { useT } from '../i18n';
import { cardReason } from '../format';
import { Icon } from '../icons/Icon';
import { Preview } from './Preview';
import s from './game.module.css';

interface Props {
  def: ChapterDefinition;
  state: GameState;
  assignees: Record<string, string>;
  onAssign: (cardUid: string, personId: string) => void;
  onPlay: (cardUid: string) => void;
}

export function Hand({ def, state, assignees, onAssign, onPlay }: Props) {
  const tr = useT();
  const { t, label } = tr;
  const hand = state.deck.hand;

  return (
    <section className={s.handArea} aria-label={t('ui.hand')}>
      <header className={s.handHead}>
        <h2>{t('ui.hand')}</h2>
        <span className={s.plays}>{t('ui.playsLeft', { n: state.actions.playsLeft })}</span>
      </header>
      {hand.length === 0 && <p className={s.muted}>{t('ui.handEmpty')}</p>}
      <ol className={s.hand}>
        {hand.map((card, i) => {
          const chosen = assignees[card.uid];
          const st = cardStatus(def, state, card, chosen || undefined);
          const a = st.def;
          if (!a) return null;
          const actors: Record<string, string> = chosen ? { assignee: chosen } : {};
          const cost = previewEffects(def, state, a.cost ?? [], actors);
          const effects = previewEffects(def, state, a.effects, actors);
          const people = a.assign
            ? Object.keys(state.people)
                .sort()
                .filter((id) => canAssign(a, state, id) || id === chosen)
            : [];
          return (
            <li key={card.uid} className={st.available ? s.actionCard : s.actionCardLocked}>
              <div className={s.actionTop}>
                <span className={s.key}>{i + 1}</span>
                <Icon name={a.icon} />
                <strong>{t(`action.${a.id}.name`)}</strong>
              </div>
              <p className={s.actionText}>{t(`action.${a.id}.text`)}</p>
              {cost.length > 0 && (
                <div className={s.costRow}>
                  <span className={s.muted}>{t('ui.cost')}</span>
                  <Preview items={cost} def={def} state={state} />
                </div>
              )}
              <Preview items={effects} def={def} state={state} />
              {a.assign && (
                <label className={s.assign}>
                  <span className={s.muted}>{t('ui.assign')}</span>
                  <select value={chosen ?? ''} onChange={(e) => onAssign(card.uid, e.target.value)}>
                    <option value="">{t('ui.noAssign')}</option>
                    {people.map((id) => (
                      <option key={id} value={id}>
                        {label(state.people[id]!.name)}
                        {state.people[id]!.traits.length ? ` · ${state.people[id]!.traits.map((x) => t(`trait.person.${x}.name`)).join(', ')}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {st.available ? (
                <button type="button" className={s.play} onClick={() => onPlay(card.uid)} aria-keyshortcuts={String(i + 1)}>
                  {t('ui.play')}
                </button>
              ) : (
                <p className={s.lockHint}>⊘ {cardReason(st.reason, st.failed, a.lockHintKey, tr)}</p>
              )}
            </li>
          );
        })}
      </ol>
      <p className={s.keysHint}>{t('ui.keysCards')}</p>
    </section>
  );
}
