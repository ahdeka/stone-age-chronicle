// 발전 나무 칸의 선 그림 (viewBox 0 0 48 48, 동굴벽화풍 선). 시안 docs/design/r2/r2.js와 같은 그림이다.
// 칸 id로 찾는다. 일러스트로 바꿀 때는 이 표를 이미지 경로로 바꾸면 된다(칸 데이터는 그대로).
// React·CSS를 가져오지 않는다 (검증 도구가 읽을 수 있게).

export const TECH_ICONS: Record<string, string> = {
  stone_spear: 'M8 40 L34 14 M34 14 l-2 8 M34 14 l-8 2 M10 32 q6 -4 12 0 q-6 3 -12 0',
  spear_thrower: 'M6 36 L26 28 M26 28 l3 -4 M12 34 L42 10 M42 10 l-7 1 M42 10 l-1 7',
  weir_rack: 'M6 40 C14 36 22 42 30 38 C36 35 40 37 42 36 M10 30 V12 M38 30 V12 M8 14 h32 M16 14 v8 M24 14 v10 M32 14 v8',
  sled: 'M6 38 L40 32 M6 38 l4 -4 M10 34 L40 28 M16 32 v-9 h14 v7 M40 28 l4 -10',
  grinding_stone: 'M8 34 q16 8 32 0 q-16 -6 -32 0 M16 28 q8 -6 16 0 M20 19 l2 2 M26 16 l2 2 M31 21 l2 2',
  grain_meadow: 'M14 42 V18 M14 22 l-4 -4 M14 22 l4 -4 M14 28 l-4 -4 M14 28 l4 -4 M30 42 V14 M30 18 l-4 -4 M30 18 l4 -4 M30 24 l-4 -4 M30 24 l4 -4 M6 42 h36',
  farm_tools: 'M12 40 L32 12 M32 12 q8 2 8 10 q-6 -4 -12 -4 M8 42 h20',
  first_harvest: 'M24 42 L16 14 M24 42 L24 12 M24 42 L32 14 M17 30 h14 M14 14 l2 -4 M24 12 v-4 M32 14 l2 -4',
  tent_repair: 'M6 40 L24 10 L42 40 Z M24 10 V40 M15 28 l6 4 M27 32 l6 -4',
  cave_fortify: 'M4 40 Q8 12 24 10 Q40 12 44 40 M16 40 Q16 26 24 24 Q32 26 32 40 M4 40 h40 M8 40 v-8 M11 40 v-10',
  pit_house: 'M8 38 L24 14 L40 38 M14 38 q10 -6 20 0 M24 14 l-4 -6 M24 14 l4 -6 M4 38 h40',
  village: 'M4 40 L12 28 L20 40 M18 40 L28 22 L38 40 M34 40 L40 32 L46 40 M2 40 h46',
  lock: 'M15 22 v-5 a5 5 0 0 1 10 0 v5 M12 22 h16 v12 h-16 Z',
  none: 'M14 24 h20',
};
