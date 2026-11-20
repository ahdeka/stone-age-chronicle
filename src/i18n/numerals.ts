// 수 표기 (CLAUDE.md "화면 표기 원칙")
// 화면 정보는 아라비아 숫자만 쓴다. 이야기 문장에서만 작은 수(10 이하)를 우리말로 읽는다.
// 문장 템플릿에서 {n:num} {n:count} {n:days}로 쓴다.
//   {n:count}마리 → "세 마리" / "14마리"  (우리말일 때만 띄어 쓴다. 템플릿에는 띄어쓰기 없이 단위를 붙인다)
//   {n:num}       → "셋" / "18"
//   {n:days}      → "18일치" (늘 아라비아 숫자, 식량·장작이 며칠 가는지)

/** 우리말로 읽는 가장 큰 수 */
export const NATIVE_MAX = 10;

const ONES = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
const ONES_ATTR = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];

function small(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= NATIVE_MAX;
}

/** 셈: 하나, 둘, 셋 … 열. 넘으면 아라비아 숫자 */
export function koNum(n: number): string {
  return small(n) ? ONES[n]! : String(n);
}

/** 단위 앞: "세 " (뒤에 띄어쓰기 포함), 넘으면 "14" (단위를 바로 붙인다) */
export function koCount(n: number): string {
  return small(n) ? `${ONES_ATTR[n]!} ` : String(n);
}

/** 며칠치: 늘 아라비아 숫자 */
export function koDays(n: number): string {
  return `${n}일치`;
}

export const FORMATTERS: Record<string, (n: number) => string> = {
  num: koNum,
  count: koCount,
  days: koDays,
};
