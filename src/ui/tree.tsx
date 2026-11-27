// 발전 나무 판을 여는 길 (R2-b-2): 지표 바의 "발전 나무 n/12" 단추, 전략 팝업 카드의 "나무에서 보기", T 키.
// 판은 지금 화면 위에 겹쳐 뜬다. 아래 화면(전략 팝업에서 고른 것 등)은 그대로 남는다.

import { createContext, useContext } from 'react';

export interface TreeApi {
  /** 판을 연다. focus = 처음 볼 칸, fromPlan = 전략 팝업에서 왔다("← 전략으로 돌아가기") */
  open: (focus?: string, fromPlan?: boolean) => void;
  close: () => void;
  isOpen: boolean;
}

export const TreeContext = createContext<TreeApi | null>(null);

/** 판을 여는 길 (게임 화면 밖, 예: 시험의 단독 그리기에서는 null) */
export const useTree = () => useContext(TreeContext);
