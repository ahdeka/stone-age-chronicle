// 진행 화면의 흐름 판단 (React와 무관한 순수 함수라 따로 시험한다)
// - 자동 진행: 중간 사건이 없으면 상순 → 중순 → 하순까지 저절로 넘어간다.
//   멈추는 곳은 결정 팝업과 하순 끝(이달의 결과 앞) 두 곳이다. 하순 글이 다 나오면 "결과 보기"를 눌러 넘어간다
//   (2026-11-25 5차 피드백: "계속" 버튼을 없애고 하순 끝의 버튼이 "결과 보기"로 바뀐다).
// - 스크롤: 화면이 바뀌는 순간(새 달, 진행 화면 진입, 순 바뀜, 이달의 결과) 맨 위로 올린다.

export interface AutoAdvanceInput {
  /** 설정 "한 순씩 넘기기"가 꺼져 있는가 */
  auto: boolean;
  /** 사용자가 일시정지를 눌렀는가 */
  paused: boolean;
  /** 이 순 다음에 볼 순이 있는가 (없으면 결정을 기다리거나 다음은 이달의 결과다) */
  hasNext: boolean;
  /** 결정 팝업을 띄울 차례인가 */
  deciding: boolean;
  /** 실제로 흐른 시간(ms). "빨리 보기"로 건너뛴 시간은 들어가지 않는다 */
  run: number;
  /** 이 화면 시간표의 끝(ms) */
  end: number;
  /** 끝난 뒤 쉬는 시간(ms) */
  delay: number;
}

/**
 * 지금 다음 순으로 저절로 넘어갈 때인가.
 * 실제로 흐른 시간으로 잰다: "빨리 보기"나 움직임 줄이기로 글이 한꺼번에 나와도
 * 타이핑에 걸렸을 만큼은 읽을 시간을 준다.
 */
export function autoAdvanceDue(x: AutoAdvanceInput): boolean {
  if (!x.auto || x.paused || !x.hasNext || x.deciding) return false;
  return x.run >= x.end + x.delay;
}

/** 진행 화면에서 일시정지 버튼을 보여 줄까 (저절로 넘어갈 수 있는 화면에서만) */
export function canPause(auto: boolean, hasNext: boolean, deciding: boolean): boolean {
  return auto && hasNext && !deciding;
}

export type ProgressAction = 'skip' | 'skipDone' | 'decide' | 'result' | 'nextPhase';

/**
 * 진행 화면 아래의 버튼 하나 ("글 바로 보기" 자리). "계속" 버튼은 없다 (5차 피드백).
 * - 글이 아직 나오는 중: 글 바로 보기
 * - 결정을 기다림: 결정하기 (팝업은 저절로 열리지만 닫았을 때 다시 열려고)
 * - 하순 끝(다음은 이달의 결과): 결과 보기
 * - 한 순씩 넘기기를 켰으면 순 끝에서: 이어서 보기
 * - 그 밖(저절로 넘어가는 중, 일시정지): 글 바로 보기(누를 수 없음)
 */
export function progressAction(x: { done: boolean; deciding: boolean; toResult: boolean; hasNext: boolean; auto: boolean }): ProgressAction {
  if (!x.done) return 'skip';
  if (x.deciding) return 'decide';
  if (x.toResult) return 'result';
  if (x.hasNext && !x.auto) return 'nextPhase';
  return 'skipDone';
}

export type ScreenKind = 'situation' | 'progress' | 'result' | 'ending';

/** 화면이 바뀌었는지 가리는 열쇠. 이 값이 바뀌면 스크롤을 맨 위로 올린다 */
export function screenKey(kind: ScreenKind, month: number, index = 0): string {
  return kind === 'progress' ? `progress-${month}-${index}` : `${kind}-${month}`;
}
