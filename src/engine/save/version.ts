/** 세이브 포맷 버전. GameState 구조를 바꾸면 올리고 migrations에 변환을 추가한다.
 *  1: M1 (이벤트·카드 없음)
 *  2: M2 (이벤트 대기열, 덱, 연대기, 배정 인물)
 */
export const SAVE_VERSION = 2;
