// 한 달의 화면 흐름: 월초 상황 화면 → (전략 확정) → 진행 화면(상순 → 중순 → 하순) → 이달의 결과 → 다음 달 상황 화면
// 엔진은 다음 결정 지점까지 미리 계산해 두고, 이 화면이 보고(work.reports)를 하나씩 보여 준다.

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { reduce, type ChapterDefinition, type Command, type GameState } from '../../engine';
import { DebugPanel } from '../components/DebugPanel';
import type { StatusMode } from '../components/StatusBar';
import { TechTree } from '../components/TechTree';
import { TreeContext, type TreeApi } from '../tree';
import { screenKey } from '../flow';
import { EndingScreen } from './EndingScreen';
import { ProgressScreen } from './ProgressScreen';
import { ResultScreen } from './ResultScreen';
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
  const [view, setView] = useState<{ turn: number; index: number } | null>(null);
  const [showEnding, setShowEnding] = useState(false);
  // 자동 진행 일시정지: 한 턴 동안 유지하고 새 턴에는 풀린다 (계절 턴은 턴 안에서 달이 바뀐다)
  const [pausedTurn, setPausedTurn] = useState<number | null>(null);
  const paused = pausedTurn === state.turn;
  const setPaused = useCallback((p: boolean) => setPausedTurn(p ? state.turn : null), [state.turn]);
  // 발전 나무 판 (R2-b-2): 지금 화면 위에 겹쳐 뜬다. 닫아도 아래 화면(전략 팝업에서 고른 것)은 그대로다
  const [tree, setTree] = useState<{ focus?: string; fromPlan: boolean } | null>(null);
  const treeApi = useMemo<TreeApi>(
    () => ({
      open: (focus, fromPlan = false) => setTree({ ...(focus ? { focus } : {}), fromPlan }),
      close: () => setTree(null),
      isOpen: tree !== null,
    }),
    [tree],
  );
  // T로 연다 (닫기는 판이 받는다). 글 입력 중이나 단축키 조합은 건드리지 않는다
  useEffect(() => {
    if (tree) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 't' || e.key === 'T' || e.key === 'ㅅ') {
        e.preventDefault();
        setTree({ fromPlan: state.step === 'policy' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tree, state.step]);

  const send = useCallback(
    (cmd: Command) => {
      const r = reduce(def, state, cmd);
      if (r.error) {
        console.warn(r.error);
        return;
      }
      if (cmd.type === 'choosePlan') setView({ turn: r.state.turn, index: 1 });
      if (cmd.type === 'nextMonth') setView(null);
      onChange(r.state);
    },
    [def, state, onChange],
  );

  useEffect(() => {
    if (view && view.turn !== state.turn) setView(null);
  }, [state.turn, view]);

  let body;
  let key: string;
  // 판 위 지표 바의 기준: 아래 화면과 같게 (월초 상황 = 지금 값, 진행 중 = 월초 기준, 결과 = 증감)
  let barMode: StatusMode = 'live';
  if (showEnding && state.step === 'ended') {
    key = screenKey('ending', state.turn);
    body = <EndingScreen def={def} state={state} onQuit={onQuit} />;
  } else if (situationTime(state)) {
    key = screenKey('situation', state.turn);
    body = <SituationScreen def={def} state={state} send={send} />;
  }
  else {
    const last = state.work.reports.length - 1;
    const index = view && view.turn === state.turn ? Math.min(view.index, last) : last;
    const finish = () => {
      if (state.step === 'settlement') send({ type: 'nextMonth' });
      else if (state.step === 'ended') setShowEnding(true);
    };
    const onNext = () => {
      if (index < last) setView({ turn: state.turn, index: index + 1 });
      else finish();
    };
    // 정산 보고는 이달의 결과 화면, 그 밖(상순·중순·하순)은 진행 화면
    const result = state.work.reports[index]?.slot === 'settlement';
    // 진행 화면은 한 턴 동안 한 화면이다 (세 순 또는 세 단계가 서술 칸에 쌓인다, 4차 피드백)
    key = result ? screenKey('result', state.turn) : screenKey('progress', state.turn);
    barMode = result ? 'result' : 'start';
    body = result ? (
      <ResultScreen def={def} state={state} onNext={finish} />
    ) : (
      <ProgressScreen key={key} def={def} state={state} index={index} onNext={onNext} send={send} paused={paused} setPaused={setPaused} />
    );
  }

  return (
    <TreeContext.Provider value={treeApi}>
      <ScrollTop screen={key} />
      {body}
      {tree && <TechTree key={`${state.turn}-${tree.focus ?? ''}`} def={def} state={state} focus={tree.focus} fromPlan={tree.fromPlan} barMode={barMode} onClose={treeApi.close} />}
      {import.meta.env.DEV && <DebugPanel def={def} state={state} onChange={onChange} />}
    </TreeContext.Provider>
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
