/** 세이브 포맷 버전. GameState 구조를 바꾸면 올리고 migrations에 변환을 추가한다.
 *  재설계(월/순 진행)부터 1로 다시 시작한다. 이전 설계의 세이브는 format이 같아도 구조 검사에서 거부된다.
 *  1: 재설계 M1 */
export const SAVE_VERSION = 1;
