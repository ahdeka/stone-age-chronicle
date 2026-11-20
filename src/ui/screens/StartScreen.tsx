// 시작 화면: 시드 입력, 새로 시작, 이어 하기, 불러오기. 시작 브리핑 화면은 M2에서 만든다.

import { useState } from 'react';
import type { GameState } from '../../engine';
import { LoadButton } from '../components/SaveControls';
import { useT } from '../i18n';
import s from './screens.module.css';

interface Props {
  canContinue: boolean;
  onContinue: () => void;
  onStart: (seed: string) => void;
  onLoad: (state: GameState) => void;
}

/** 시드 기본값: 시계를 엔진에 넣지 않으려고 UI에서 만든다 */
function defaultSeed(): string {
  return `seed-${Date.now().toString(36)}`;
}

export function StartScreen({ canContinue, onContinue, onStart, onLoad }: Props) {
  const tr = useT();
  const [seed, setSeed] = useState(defaultSeed);
  return (
    <main className={s.start}>
      <h1 className={s.title}>{tr.t('ui.title')}</h1>
      <p className={s.subtitle}>{tr.t('ui.subtitle')}</p>
      <form
        className={s.startForm}
        onSubmit={(e) => {
          e.preventDefault();
          onStart(seed.trim() || defaultSeed());
        }}
      >
        <label className={s.field}>
          {tr.t('ui.seed')}
          <input value={seed} onChange={(e) => setSeed(e.target.value)} />
        </label>
        <button type="submit" className={s.primary}>
          {tr.t('ui.newGame')}
        </button>
        {canContinue && (
          <button type="button" className={s.secondary} onClick={onContinue}>
            {tr.t('ui.continue')}
          </button>
        )}
        <LoadButton onLoad={onLoad} />
      </form>
    </main>
  );
}
