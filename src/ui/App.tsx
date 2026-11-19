import { useEffect, useState } from 'react';
import { createGame, type GameState } from '../engine';
import { DEFAULT_CHAPTER, commonStrings, getChapter } from '../data/registry';
import { I18nProvider } from './i18n';
import { GameScreen } from './screens/GameScreen';
import { StartScreen } from './screens/StartScreen';
import { autosave, clearAutosave, loadAutosave } from './storage';
import { applyTheme } from './theme/applyTheme';

export function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [saved, setSaved] = useState<GameState | null>(() => loadAutosave());

  const chapterId = state?.chapterId ?? saved?.chapterId ?? DEFAULT_CHAPTER;
  const entry = getChapter(chapterId) ?? getChapter(DEFAULT_CHAPTER)!;

  useEffect(() => applyTheme(entry.definition.theme), [entry]);

  const update = (next: GameState) => {
    setState(next);
    autosave(next);
  };

  const start = (seed: string) => {
    const def = entry.definition;
    update(createGame(def, { kind: 'preset', presetId: def.startPresets[0]!.id, tribeTraits: [], seed }));
  };

  const quit = () => {
    clearAutosave();
    setSaved(null);
    setState(null);
  };

  return (
    <I18nProvider tables={[commonStrings.ko, entry.strings.ko]}>
      {state ? (
        <GameScreen def={entry.definition} state={state} onChange={update} onQuit={quit} />
      ) : (
        <StartScreen canContinue={saved !== null && saved.phase !== 'ended'} onContinue={() => saved && setState(saved)} onStart={start} onLoad={update} />
      )}
    </I18nProvider>
  );
}
