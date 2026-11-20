// 한 달의 화면 흐름: 월초 상황 화면 → (방침 확정) → 상순 → 중순 → 하순 → 정산 → 다음 달 상황 화면
// 엔진은 다음 결정 지점까지 미리 계산해 두고, 이 화면이 보고(work.reports)를 하나씩 보여 준다.

import { useCallback, useEffect, useState } from 'react';
import { reduce, type ChapterDefinition, type Command, type GameState } from '../../engine';
import { DebugPanel } from '../components/DebugPanel';
import { EndingScreen } from './EndingScreen';
import { PhaseScreen } from './PhaseScreen';
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
  const [view, setView] = useState<{ month: number; index: number } | null>(null);
  const [showEnding, setShowEnding] = useState(false);

  const send = useCallback(
    (cmd: Command) => {
      const r = reduce(def, state, cmd);
      if (r.error) {
        console.warn(r.error);
        return;
      }
      if (cmd.type === 'choosePolicy') setView({ month: r.state.month, index: 1 });
      if (cmd.type === 'nextMonth') setView(null);
      onChange(r.state);
    },
    [def, state, onChange],
  );

  useEffect(() => {
    if (view && view.month !== state.month) setView(null);
  }, [state.month, view]);

  let body;
  if (showEnding && state.step === 'ended') body = <EndingScreen def={def} state={state} onQuit={onQuit} />;
  else if (situationTime(state)) body = <SituationScreen def={def} state={state} send={send} />;
  else {
    const last = state.work.reports.length - 1;
    const index = view && view.month === state.month ? Math.min(view.index, last) : last;
    const onNext = () => {
      if (index < last) setView({ month: state.month, index: index + 1 });
      else if (state.step === 'settlement') send({ type: 'nextMonth' });
      else if (state.step === 'ended') setShowEnding(true);
    };
    body = <PhaseScreen key={`${state.month}-${index}`} def={def} state={state} index={index} onNext={onNext} send={send} />;
  }

  return (
    <>
      {body}
      {import.meta.env.DEV && <DebugPanel def={def} state={state} onChange={onChange} />}
    </>
  );
}
