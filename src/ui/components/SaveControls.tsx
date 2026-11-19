import { useRef, useState } from 'react';
import { deserialize, type GameState } from '../../engine';
import { getChapter } from '../../data/registry';
import { useT } from '../i18n';
import { downloadSave } from '../storage';
import s from '../screens/screens.module.css';

export function ExportButton({ state }: { state: GameState }) {
  const { t } = useT();
  return (
    <button type="button" className={s.secondary} onClick={() => downloadSave(state)}>
      {t('ui.export')}
    </button>
  );
}

export function LoadButton({ onLoad }: { onLoad: (state: GameState) => void }) {
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const read = async (file: File) => {
    const r = deserialize(await file.text());
    if (!r.ok) return setError(r.error);
    if (!getChapter(r.state.chapterId)) return setError('error.save.unknownChapter');
    setError(null);
    onLoad(r.state);
  };

  return (
    <>
      <button type="button" className={s.secondary} onClick={() => input.current?.click()}>
        {t('ui.import')}
      </button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void read(f);
          e.target.value = '';
        }}
      />
      {error && (
        <p role="alert" className={s.error}>
          {t(error)}
        </p>
      )}
    </>
  );
}
