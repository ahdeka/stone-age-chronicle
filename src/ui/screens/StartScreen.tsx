import { useState } from 'react';
import type { GameState } from '../../engine';
import { useT } from '../i18n';
import { LoadButton } from '../components/SaveControls';
import s from './screens.module.css';

interface Props {
  canContinue: boolean;
  onContinue: () => void;
  onStart: (seed: string) => void;
  onLoad: (state: GameState) => void;
}

export function StartScreen({ canContinue, onContinue, onStart, onLoad }: Props) {
  const { t } = useT();
  const [seed, setSeed] = useState('');

  return (
    <main className={s.start}>
      <h1 className={s.title}>{t('ui.title')}</h1>
      <p className={s.subtitle}>{t('ui.subtitle')}</p>
      <form
        className={s.startForm}
        onSubmit={(e) => {
          e.preventDefault();
          // 엔진은 시드를 받기만 한다. 빈 시드의 기본값은 UI가 시계로 만든다.
          onStart(seed.trim() || Date.now().toString(36));
        }}
      >
        <label className={s.field}>
          <span>{t('ui.seed')}</span>
          <input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder={t('ui.seedPlaceholder')} />
        </label>
        <button type="submit" className={s.primary}>
          {t('ui.newGame')}
        </button>
        {canContinue && (
          <button type="button" className={s.secondary} onClick={onContinue}>
            {t('ui.continue')}
          </button>
        )}
        <LoadButton onLoad={onLoad} />
      </form>
    </main>
  );
}
