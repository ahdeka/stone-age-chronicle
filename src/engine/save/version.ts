/** 세이브 포맷 버전. GameState 구조를 바꾸면 올리고 migrations에 변환을 추가한다.
 *  재설계(월/순 진행)부터 1로 다시 시작한다. 이전 설계의 세이브는 generation 검사에서 거부된다.
 *  1: 재설계 M1
 *  2: M2 화면 — 거처 채 수, 월초 보고·조언, 단계별 장부·알림·식량 시작/끝값
 *  3: M2 봄 시작 — 플레이어가 정한 부족 이름(tribeName) */
export const SAVE_VERSION = 3;
