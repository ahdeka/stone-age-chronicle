// 직접 만든 단색 SVG 아이콘. 동굴 벽화처럼 굵은 선과 단순한 도형. currentColor를 따른다.

const PATHS: Record<string, string> = {
  // 자원
  food: 'M5 15c0-5 4-9 9-9 1 4-1 9-6 11M8 17l-3 3', // 고기 덩이와 뼈
  tools: 'M6 18 14 6l4 3-9 11zM14 6l3-2', // 뗀돌 날
  lore: 'M5 6h14M5 11h10M5 16h12M19 11l-2 2', // 벽에 새긴 줄
  cohesion: 'M7 9a2 2 0 1 0 0-.1M17 9a2 2 0 1 0 0-.1M12 7a2 2 0 1 0 0-.1M4 19c1-4 15-4 16 0', // 둘러앉은 사람들
  population: 'M12 6a2.5 2.5 0 1 0 0-.1M7 20c0-5 10-5 10 0', // 사람
  // 역할
  gather: 'M12 20V9M12 13c-3 0-5-2-5-5 3 0 5 2 5 5zM12 11c2-3 4-4 6-4 0 3-2 5-6 5', // 풀
  hunt: 'M4 20 18 6M18 6l-5 1M18 6l-1 5', // 창
  craft: 'M5 19l6-6M11 13l3-6 5 3-6 4z', // 망치돌
  ritual: 'M12 4c3 4 4 7 0 11-4-4-3-7 0-11zM8 20h8', // 불꽃
  guard: 'M12 4l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V7z', // 방패 모양 바위
};

export function Icon({ name, label, size = 20 }: { name: string; label?: string; size?: number }) {
  const d = PATHS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {d ? <path d={d} /> : <circle cx="12" cy="12" r="6" />}
    </svg>
  );
}
