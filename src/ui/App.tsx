// 앱 흐름: 시작 화면 → (새 게임이면) 인트로 → 게임
// 설정(속도, 움직임, 글자 크기)과 번역기, 장 테마를 여기서 깐다.

import { useEffect, useState } from 'react';
import { createGame, type GameState } from '../engine';
import { DEFAULT_CHAPTER, commonStrings, getChapter } from '../data/registry';
import { I18nProvider } from './i18n';
import { MotionProvider } from './motion';
import { GameView } from './screens/GameView';
import { IntroScreen } from './screens/IntroScreen';
import { TitleScreen } from './screens/TitleScreen';
import { autosave, clearAutosave, loadAutosave } from './storage';
import { applyTheme } from './theme/applyTheme';

type Screen = 'title' | 'intro' | 'game';

export function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [screen, setScreen] = useState<Screen>('title');
  const [saved, setSaved] = useState<GameState | null>(() => loadAutosave());

  const chapterId = state?.chapterId ?? saved?.chapterId ?? DEFAULT_CHAPTER;
  const entry = getChapter(chapterId) ?? getChapter(DEFAULT_CHAPTER)!;
  const def = entry.definition;

  useEffect(() => applyTheme(def.theme), [def]);

  const update = (next: GameState) => {
    setState(next);
    autosave(next);
  };

  const quit = () => {
    clearAutosave();
    setSaved(null);
    setState(null);
    setScreen('title');
  };

  let body;
  if (screen === 'intro' && state) body = <IntroScreen def={def} state={state} onStart={() => setScreen('game')} />;
  else if (screen === 'game' && state) body = <GameView def={def} state={state} onChange={update} onQuit={quit} />;
  else
    body = (
      <TitleScreen
        scene={def.scenes.intro}
        canContinue={saved !== null && saved.step !== 'ended'}
        onContinue={() => {
          if (!saved) return;
          setState(saved);
          setScreen('game');
        }}
        onStart={(seed) => {
          update(createGame(def, { seed }));
          setScreen('intro');
        }}
        onLoad={(s) => {
          update(s);
          setScreen('game');
        }}
      />
    );

  return (
    <MotionProvider>
      <I18nProvider tables={[commonStrings.ko, entry.strings.ko]}>{body}</I18nProvider>
    </MotionProvider>
  );
}
