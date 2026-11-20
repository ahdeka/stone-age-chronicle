// 시작 화면 (시안에 없음 — 인트로 앞에 작게 둔다): 새로 시작(시드), 이어 하기, 불러오기

import { useState } from 'react';
import type { GameState } from '../../engine';
import { LoadButton } from '../components/SaveControls';
import { SceneView } from '../components/SceneView';
import { useT } from '../i18n';
import t from './title.module.css';
import u from '../ui.module.css';

interface Props {
  scene: Parameters<typeof SceneView>[0]['scene'];
  canContinue: boolean;
  onContinue: () => void;
  onStart: (seed: string) => void;
  onLoad: (state: GameState) => void;
}

/** 시드 기본값: 시계를 엔진에 넣지 않으려고 화면에서 만든다 */
function defaultSeed(): string {
  return `seed-${Date.now().toString(36)}`;
}

export function TitleScreen({ scene, canContinue, onContinue, onStart, onLoad }: Props) {
  const tr = useT();
  const [seed, setSeed] = useState(defaultSeed);
  return (
    <main className={t.page}>
      <div className={t.scene}>
        <SceneView scene={scene} align="xMaxYMax" />
      </div>
      <div className={t.shade} aria-hidden="true" />
      <div className={`${t.box} ${u.in}`}>
        <h1 className={`${t.title} ${u.serif}`}>{tr.t('ui.title')}</h1>
        <p className={`${t.subtitle} ${u.serif}`}>{tr.t('ui.subtitle')}</p>
        <form
          className={t.form}
          onSubmit={(e) => {
            e.preventDefault();
            onStart(seed.trim() || defaultSeed());
          }}
        >
          <div className={t.buttons}>
            <button type="submit" className={u.btnPrimary}>
              {tr.t('ui.newGame')}
            </button>
            {canContinue && (
              <button type="button" className={u.btnGhost} onClick={onContinue}>
                {tr.t('ui.continue')}
              </button>
            )}
            <LoadButton onLoad={onLoad} />
          </div>
          <label className={t.seed}>
            <span className={u.muted}>{tr.t('ui.seed')}</span>
            <input value={seed} onChange={(e) => setSeed(e.target.value)} />
          </label>
        </form>
      </div>
    </main>
  );
}
