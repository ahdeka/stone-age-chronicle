// 우리말 수 읽기 (화면 시안: "서른네 명", "열여드레분", "순록 세 마리")
// 문장 템플릿에서 {n:num} {n:count} {n:days}로 쓴다. 99를 넘으면 아라비아 숫자로 둔다.

const ONES = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉'];
const ONES_ATTR = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];
const TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
const DAYS = ['', '하루', '이틀', '사흘', '나흘', '닷새', '엿새', '이레', '여드레', '아흐레'];

function native(n: number, ones: readonly string[]): string | undefined {
  if (!Number.isInteger(n) || n < 1 || n > 99) return undefined;
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${ones[o]}`;
}

/** 셈: 하나, 둘, 열여덟, 서른넷 */
export function koNum(n: number): string {
  return native(n, ONES) ?? String(n);
}

/** 단위 앞: 한, 두, 세, 네, 스무, 서른네 (명, 마리, 채 앞) */
export function koCount(n: number): string {
  if (n === 20) return '스무';
  return native(n, ONES_ATTR) ?? String(n);
}

/** 날수: 하루, 이틀, 열흘, 열여드레, 스무날, 스무사흘. 30 이상과 0은 "N일" */
export function koDays(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n >= 30) return `${n}일`;
  if (n === 10) return '열흘';
  if (n === 20) return '스무날';
  const t = Math.floor(n / 10);
  return `${t === 0 ? '' : t === 1 ? '열' : '스무'}${DAYS[n % 10]}`;
}

export const FORMATTERS: Record<string, (n: number) => string> = {
  num: koNum,
  count: koCount,
  days: koDays,
};
