// 한 달의 화면 흐름: 월초 상황 화면 → (방침 확정) → 상순 → 중순 → 하순 → 정산 → 다음 달 상황 화면
// 엔진은 다음 결정 지점까지 미리 계산해 두고, 이 화면이 보고(work.reports)를 하나씩 보여 준다.

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { reduce, type ChapterDefinition, type Command, type GameState } from '../../engine';
import { DebugPanel } from '../components/DebugPanel';
import { screenKey } from '../flow';
import { EndingScreen } from './EndingScreen';
import { PhaseScreen } from './PhaseScreen';
import { QuietScreen } from './QuietScreen';
import { useMotion } from '../motion';
import { SituationScreen } from './SituationScreen';

interface Props {
  def: ChapterDefinition;
  state: GameState;
  onChange: (s: GameState) => void;
  onQuit: () => void;
}

/** 지금 단계에서 상황 화면을 보여 줄 차례인가 (방침 선택 전, 또는 월초 사건) */
function situationTime(s: GameState): boolean {
  if (s.step === 'policy') return true;
  return s.step === 'decision' && s.work.decision?.kind === 'event' && s.work.decision.slot === 'briefing';
}

export function GameView({ def, state, onChange, onQuit }: Props) {
  // 진행 화면에서 보고 있는 보고 번호. 불러온 직후에는 마지막 보고부터
  // summary: 평온한 달을 한 화면으로 볼 차례인가 (펼쳐 보면 false)
  const [view, setView] = useState<{ month: number; index: number; summary?: boolean } | null>(null);
  const { settings } = useMotion();
  const [showEnding, setShowEnding] = useState(false);
  // 자동 진행 일시정지: 한 달 동안 유지하고 새 달에는 풀린다
  const [pausedMonth, setPausedMonth] = useState<number | null>(null);
  const paused = pausedMonth === state.month;
  const setPaused = useCallback((p: boolean) => setPausedMonth(p ? state.month : null), [state.month]);

  const send = useCallback(
    (cmd: Command) => {
      const r = reduce(def, state, cmd);
      if (r.error) {
        console.warn(r.error);
        return;
      }
      if (cmd.type === 'choosePolicy') setView({ month: r.state.month, index: 1, summary: true });
      if (cmd.type === 'nextMonth') setView(null);
      onChange(r.state);
    },
    [def, state, onChange],
  );

  useEffect(() => {
    if (view && view.month !== state.month) setView(null);
  }, [state.month, view]);

  let body;
  let key: string;
  if (showEnding && state.step === 'ended') {
    key = screenKey('ending', state.month);
    body = <EndingScreen def={def} state={state} onQuit={onQuit} />;
  } else if (situationTime(state)) {
    key = screenKey('situation', state.month);
    body = <SituationScreen def={def} state={state} send={send} />;
  }
  else {
    const last = state.work.reports.length - 1;
    const index = view && view.month === state.month ? Math.min(view.index, last) : last;
    const finish = () => {
      if (state.step === 'settlement') send({ type: 'nextMonth' });
      else if (state.step === 'ended') setShowEnding(true);
    };
    const onNext = () => {
      if (index < last) setView({ month: state.month, index: index + 1 });
      else finish();
    };
    const h = state.history[state.history.length - 1];
    const quiet = settings.quietSummary && view?.summary && view.month === state.month && h?.month === state.month && h.quiet && state.step !== 'decision';
    key = quiet ? screenKey('quiet', state.month) : screenKey('phase', state.month, index);
    body = quiet ? (
      <QuietScreen def={def} state={state} onNext={finish} onExpand={() => setView({ month: state.month, index: 1, summary: false })} />
    ) : (
      <PhaseScreen key={key} def={def} state={state} index={index} onNext={onNext} send={send} paused={paused} setPaused={setPaused} />
    );
  }

  return (
    <>
      <ScrollTop screen={key} />
      {body}
      {import.meta.env.DEV && <DebugPanel def={def} state={state} onChange={onChange} />}
    </>
  );
}

/** 화면이 바뀌면(새 달, 진행 화면 진입, 순 바뀜, 이달의 결과) 스크롤을 맨 위로 올린다. 그려지기 전에 올려 깜빡이지 않게 */
function ScrollTop({ screen }: { screen: string }) {
  useLayoutEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [screen]);
  return null;
}
