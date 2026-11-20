// 결말 화면 (시안에 없음 — 진행 화면과 같은 모양으로): 결말 이름과 문장, 부족의 연대기

import type { ChapterDefinition, GameState } from '../../engine';
import { ExportButton } from '../components/SaveControls';
import { SceneView } from '../components/SceneView';
import { lineText } from '../format';
import { useT } from '../i18n';
import p from './phase.module.css';
import e from './ending.module.css';
import u from '../ui.module.css';

export function EndingScreen({ def, state, onQuit }: { def: ChapterDefinition; state: GameState; onQuit: () => void }) {
  const tr = useT();
  const ending = state.ending;
  if (!ending) return null;
  return (
    <div className={p.page}>
      <div className={p.wrap}>
        <section className={p.sceneBox}>
          <SceneView scene={def.scenes.settlement} className={p.scene} />
          <div className={p.shade} aria-hidden="true" />
          <div className={p.sceneLabel}>
            <span className={u.label}>{tr.t('ui.ended')}</span>
            <h1 className={`${p.place} ${u.serif}`}>{tr.t(`ending.${ending.id}.title`)}</h1>
          </div>
        </section>
        <section className={`${u.card} ${u.in}`}>
          <p className={`${e.lead} ${u.serif}`}>{tr.t(`ending.${ending.id}.chron`)}</p>
        </section>
        <section className={`${u.card} ${u.in} ${u.d2}`}>
          <h2 className={u.h2accent}>{tr.t('ui.ending.chronicle')}</h2>
          <ol className={e.list}>
            {state.chronicle.map((c, i) => (
              <li key={i} className={u.serif}>
                <span className={e.month}>{tr.t('ui.chronicle.month', { n: c.month, month: tr.t(`month.${c.monthId}`) })}</span> {lineText(tr, c)}
              </li>
            ))}
          </ol>
        </section>
        <div className={e.buttons}>
          <button type="button" className={u.btnPrimary} onClick={onQuit}>
            {tr.t('ui.quit')}
          </button>
          <ExportButton state={state} />
        </div>
      </div>
    </div>
  );
}
