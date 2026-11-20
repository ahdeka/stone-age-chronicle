// 선택 직후 자원·인구·축 변화를 잠깐 띄우는 피드백 (CLAUDE.md UI/UX: "선택에 반응이 있다는 느낌")

import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../../engine';

export interface Delta {
  id: number;
  /** 'resource:food' | 'population' | 'axis:share_hierarchy' */
  target: string;
  delta: number;
}

const SHOW_MS = 1600;

function snapshot(s: GameState): Record<string, number> {
  const out: Record<string, number> = { population: s.tribe.population };
  for (const [k, v] of Object.entries(s.tribe.resources)) out[`resource:${k}`] = v;
  for (const [k, v] of Object.entries(s.tribe.axes)) out[`axis:${k}`] = v;
  return out;
}

export function useDeltas(state: GameState): Delta[] {
  const prev = useRef<Record<string, number> | null>(null);
  const nextId = useRef(1);
  const [deltas, setDeltas] = useState<Delta[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 화면을 떠날 때만 타이머를 정리한다 (상태가 바뀔 때마다 정리하면 앞서 띄운 수치가 남는다)
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    const now = snapshot(state);
    const before = prev.current;
    prev.current = now;
    if (!before) return;
    const fresh: Delta[] = [];
    for (const [target, v] of Object.entries(now)) {
      const d = v - (before[target] ?? 0);
      if (Math.abs(d) >= 0.5) fresh.push({ id: nextId.current++, target, delta: d });
    }
    if (fresh.length === 0) return;
    setDeltas((xs) => [...xs, ...fresh]);
    const ids = new Set(fresh.map((f) => f.id));
    timers.current.push(setTimeout(() => setDeltas((xs) => xs.filter((x) => !ids.has(x.id))), SHOW_MS));
  }, [state]);

  return deltas;
}
