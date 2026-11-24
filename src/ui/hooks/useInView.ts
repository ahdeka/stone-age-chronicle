// 요소가 화면에 들어왔는가. 타이핑 서술은 그 글이 보일 때 시작한다 (보이지 않는 곳에서 먼저 끝나지 않게).
// 한 번 보이면 true로 남는다 (읽다가 스크롤을 내려도 타이핑과 장부는 계속된다).
// IntersectionObserver가 없는 곳(서버 렌더링, 오래된 브라우저)에서는 처음부터 보인다고 본다.

import { useEffect, useState, type RefObject } from 'react';

export function useInView(ref: RefObject<Element | null>, key: unknown): boolean {
  const supported = typeof IntersectionObserver === 'function';
  const [seen, setSeen] = useState(!supported);

  useEffect(() => {
    if (!supported) return;
    setSeen(false);
    const el = ref.current;
    if (!el) {
      setSeen(true);
      return;
    }
    // 아래쪽 10%는 빼고 잰다: 화면 맨 아래에 한 줄 걸친 정도로는 시작하지 않는다
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((x) => x.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, key, supported]);

  return seen;
}
