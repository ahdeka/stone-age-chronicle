// 효과 미리보기 칩. 색만으로 전달하지 않는다: 항상 ▲/▼ 또는 ◀/▶와 부호를 함께 쓴다.

import type { ChapterDefinition, GameState, PreviewItem } from '../../engine';
import { commonBalance } from '../../data/balance';
import { useT } from '../i18n';
import { fmtDelta } from '../format';
import s from './game.module.css';

function tierKey(p: number): string {
  const tier = commonBalance.uncertainty.tiers.find((x) => p >= x.minP) ?? commonBalance.uncertainty.tiers.at(-1)!;
  return `hint.${tier.id}`;
}

export function Preview({ items, def, state }: { items: PreviewItem[]; def: ChapterDefinition; state: GameState }) {
  const { t, label, has } = useT();
  if (items.length === 0) return null;

  const chip = (key: string, good: boolean | null, text: string) => (
    <li key={key} className={good === null ? s.chipNeutral : good ? s.chipGood : s.chipBad}>
      {text}
    </li>
  );

  return (
    <ul className={s.chips}>
      {items.map((it, i) => {
        switch (it.kind) {
          case 'resource':
            return chip(`r${i}`, it.delta > 0, `${t(`resource.${it.key}.name`)} ${it.delta > 0 ? '▲' : '▼'}${fmtDelta(it.delta)}`);
          case 'population':
            return chip(`p${i}`, it.delta > 0, `${t('ui.population')} ${it.delta > 0 ? '▲' : '▼'}${fmtDelta(it.delta)}`);
          case 'axis': {
            const side = it.delta < 0 ? t(`axis.${it.axis}.neg`) : t(`axis.${it.axis}.pos`);
            return chip(`a${i}`, null, it.delta < 0 ? `◀ ${side}` : `${side} ▶`);
          }
          case 'counter':
            return !has(`counter.${it.id}`) ? null : chip(`c${i}`, it.delta > 0, `${t(`counter.${it.id}`)} ${fmtDelta(it.delta)}`);
          case 'modifier': {
            const pol = def.balance.statPolarity[it.stat] ?? 1;
            const up = it.op === 'mul' ? it.value > 1 : it.value > 0;
            const good = up === (pol === 1);
            return chip(`m${i}`, good, `${t(`stat.${it.stat}`)} ${up ? '▲' : '▼'} (${t('preview.turns', { n: it.duration })})`);
          }
          case 'person': {
            const p = state.people[it.personId];
            if (!p) return null;
            return chip(`pe${i}`, it.relation > 0, `${t('preview.relation', { name: label(p.name) })} ${it.relation > 0 ? '▲' : '▼'}`);
          }
          case 'trait': {
            const p = state.people[it.personId];
            if (!p) return null;
            const trait = t(`trait.person.${it.trait}.name`);
            return chip(`t${i}`, null, t(it.added ? 'preview.traitAdd' : 'preview.traitRemove', { name: label(p.name), trait }));
          }
          case 'card':
            return chip(`k${i}`, it.delta > 0, `${t('preview.card', { name: t(`action.${it.cardId}.name`) })} ${fmtDelta(it.delta)}`);
          case 'chance':
            return (
              <li key={`x${i}`} className={s.chipChance}>
                <strong>{t(tierKey(it.p))}</strong>
                {it.success.length > 0 && (
                  <span className={s.branch}>
                    {t('preview.ifSuccess')}: <Preview items={it.success} def={def} state={state} />
                  </span>
                )}
                {it.failure.length > 0 && (
                  <span className={s.branch}>
                    {t('preview.ifFail')}: <Preview items={it.failure} def={def} state={state} />
                  </span>
                )}
              </li>
            );
          case 'random': {
            const labels = it.outcomes.filter((o) => o.labelKey).map((o) => t(o.labelKey!));
            return chip(`u${i}`, null, labels.length ? labels.join(' · ') : t('preview.unknown'));
          }
          case 'later':
            return chip(`l${i}`, null, t('preview.later'));
          default:
            return null;
        }
      })}
    </ul>
  );
}
