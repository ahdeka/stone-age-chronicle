import type { ThemeDef } from '../../engine';

/** 장 테마 토큰을 CSS 변수로 주입한다. 장이 바뀌면 이 함수만 다시 부르면 된다. */
export function applyTheme(theme: ThemeDef): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.tokens)) root.style.setProperty(`--${k}`, v);
  root.dataset['theme'] = theme.id;
  root.dataset['motif'] = theme.motif;
}
