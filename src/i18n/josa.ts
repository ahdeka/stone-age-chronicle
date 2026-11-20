// 받침에 따라 바뀌는 조사 (CLAUDE.md "화면 표기 원칙", DESIGN.md §12)
// 템플릿: {tribe:은} {name:이} {place:을} {name:와} {tribe:으로} {name:아}
// 서식 이름은 받침이 있을 때의 꼴과 없을 때의 꼴 어느 쪽으로 써도 같다 ({tribe:는} = {tribe:은}).

/** [받침 있을 때, 받침 없을 때] */
const PAIRS: readonly (readonly [string, string])[] = [
  ['은', '는'],
  ['이', '가'],
  ['을', '를'],
  ['과', '와'],
  ['으로', '로'],
  ['아', '야'],
  ['이라', '라'],
  ['이나', '나'],
];

const BY_FORM: Record<string, readonly [string, string]> = {};
for (const p of PAIRS) {
  BY_FORM[p[0]] = p;
  BY_FORM[p[1]] = p;
}

export function isJosaFormat(fmt: string): boolean {
  return BY_FORM[fmt] !== undefined;
}

/** 숫자를 읽었을 때 끝소리의 받침: 0 영, 1 일(ㄹ), 2 이, 3 삼, 4 사, 5 오, 6 육, 7 칠(ㄹ), 8 팔(ㄹ), 9 구 */
const DIGIT_FINAL: Record<string, 'none' | 'other' | 'rieul'> = {
  '0': 'other',
  '1': 'rieul',
  '2': 'none',
  '3': 'other',
  '4': 'none',
  '5': 'none',
  '6': 'other',
  '7': 'rieul',
  '8': 'rieul',
  '9': 'none',
};

const RIEUL = 8;

/** 끝 글자의 받침: 'none' 없음, 'rieul' ㄹ, 'other' 그 밖, undefined 판단할 수 없음 */
export function finalSound(word: string): 'none' | 'rieul' | 'other' | undefined {
  // 끝의 괄호, 따옴표, 문장부호, 공백은 건너뛴다
  const chars = [...word.replace(/[\s)\]}'"”’.,!?·…]+$/u, '')];
  const last = chars[chars.length - 1];
  if (!last) return undefined;
  const code = last.codePointAt(0)!;
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    return jong === 0 ? 'none' : jong === RIEUL ? 'rieul' : 'other';
  }
  return DIGIT_FINAL[last];
}

/** 조사 하나를 고른다. 받침을 모르면 "은(는)"처럼 둘 다 쓴다 */
export function josa(word: string, fmt: string): string {
  const pair = BY_FORM[fmt];
  if (!pair) return '';
  const [withFinal, without] = pair;
  const f = finalSound(word);
  if (f === undefined) return `${withFinal}(${without})`;
  if (f === 'none') return without;
  // ㄹ 받침 뒤의 '으로'는 '로' (사람들로, 강물로)
  if (f === 'rieul' && withFinal === '으로') return without;
  return withFinal;
}

/** 단어 + 조사 */
export function withJosa(word: string, fmt: string): string {
  return `${word}${josa(word, fmt)}`;
}
