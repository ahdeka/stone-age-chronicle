// 진행 화면의 흐름 판단 (React와 무관한 순수 함수라 따로 시험한다)
// - 자동 진행: 중간 사건이 없으면 상순 → 중순 → 하순 → 이달의 결과까지 저절로 넘어간다.
//   멈추는 곳은 결정 팝업과 이달의 결과 두 곳뿐이다.
// - 스크롤: 화면이 바뀌는 순간(새 달, 진행 화면 진입, 순 바뀜, 이달의 결과) 맨 위로 올린다.

export interface AutoAdvanceInput {
  /** 설정 "한 순씩 넘기기"가 꺼져 있는가 */
  auto: boolean;
  /** 사용자가 일시정지를 눌렀는가 */
  paused: boolean;
  /** 이 화면 다음에 볼 보고가 있는가 (없으면 결정을 기다리거나 이달의 결과다) */
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
 * 타이핑에 걸렸을 만큼은 읽을 시간을 준다. 바로 넘기려면 "계속"을 누르면 된다.
 */
export function autoAdvanceDue(x: AutoAdvanceInput): boolean {
  if (!x.auto || x.paused || !x.hasNext || x.deciding) return false;
  return x.run >= x.end + x.delay;
}

/** 진행 화면에서 일시정지 버튼을 보여 줄까 (저절로 넘어갈 수 있는 화면에서만) */
export function canPause(auto: boolean, hasNext: boolean, deciding: boolean): boolean {
  return auto && hasNext && !deciding;
}

export type ScreenKind = 'situation' | 'phase' | 'quiet' | 'ending';

/** 화면이 바뀌었는지 가리는 열쇠. 이 값이 바뀌면 스크롤을 맨 위로 올린다 */
export function screenKey(kind: ScreenKind, month: number, index = 0): string {
  return kind === 'phase' ? `phase-${month}-${index}` : `${kind}-${month}`;
}
