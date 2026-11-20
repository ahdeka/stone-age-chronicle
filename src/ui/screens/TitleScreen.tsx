// 시작 화면 (시안에 없음 — 인트로 앞에 작게 둔다): 부족 이름, 새로 시작(세계 번호), 이어 하기, 불러오기
// 부족 이름은 추천 이름을 고르거나 직접 쓴다 (CLAUDE.md "시작 브리핑")

import { useState } from 'react';
import { cleanTribeName, TRIBE_NAME_MAX, type GameState } from '../../engine';
import { LoadButton } from '../components/SaveControls';
import { SceneView } from '../components/SceneView';
import { useT } from '../i18n';
import t from './title.module.css';
import u from '../ui.module.css';

interface Props {
  scene: Parameters<typeof SceneView>[0]['scene'];
  /** 추천 부족 이름 (문자열 키). 첫 번째가 기본값 */
  nameSuggestions: string[];
  canContinue: boolean;
  onContinue: () => void;
  onStart: (seed: string, tribeName: string) => void;
  onLoad: (state: GameState) => void;
}

/** 세계 번호 기본값: 시계를 엔진에 넣지 않으려고 화면에서 만든다 */
function defaultSeed(): string {
  return `seed-${Date.now().toString(36)}`;
}

export function TitleScreen({ scene, nameSuggestions, canContinue, onContinue, onStart, onLoad }: Props) {
  const tr = useT();
  const suggestions = nameSuggestions.map((k) => tr.t(k));
  const [seed, setSeed] = useState(defaultSeed);
  const [name, setName] = useState(suggestions[0] ?? '');
  const clean = cleanTribeName(name);
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
            if (!clean) return;
            onStart(seed.trim() || defaultSeed(), clean);
          }}
        >
          <label className={t.field}>
            <span className={t.fieldLabel}>{tr.t('ui.tribeName')}</span>
            <input
              className={t.nameInput}
              value={name}
              maxLength={TRIBE_NAME_MAX + 4}
              onChange={(e) => setName(e.target.value)}
              aria-describedby="tribe-name-hint"
            />
            <span id="tribe-name-hint" className={u.muted}>
              {tr.t('ui.tribeName.hint', { max: TRIBE_NAME_MAX })}
            </span>
          </label>
          <div className={t.suggest} role="group" aria-label={tr.t('ui.tribeName.suggest')}>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className={`${t.chip} ${s === clean ? t.chipOn : ''}`}
                aria-pressed={s === clean}
                onClick={() => setName(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className={t.buttons}>
            <button type="submit" className={u.btnPrimary} disabled={!clean}>
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
