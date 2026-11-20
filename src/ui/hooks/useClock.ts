// 화면의 시간표: 흐른 시간(ms)을 재고, "빨리 보기"(끝으로 건너뛰기)와 "다시 보기"를 제공한다.
// 타이핑과 순차 등장은 모두 이 시간에서 계산한다 (시안의 elapsed 방식).
// 움직임을 줄였으면 처음부터 끝 상태로 보여 준다.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMotion } from '../motion';

export interface Clock {
  elapsed: number;
  /** 끝까지 건너뛴다 */
  skip: () => void;
  replay: () => void;
  done: boolean;
}

/** end: 시간표의 끝(ms, 이미 속도 배율을 곱한 값). key가 바뀌면 처음부터 다시 잰다 */
export function useClock(end: number, key: unknown): Clock {
  const { reduced } = useMotion();
  const [elapsed, setElapsed] = useState(0);
  const start = useRef(0);
  const offset = useRef(0);
  const endRef = useRef(end);
  endRef.current = end;

  useEffect(() => {
    start.current = performance.now();
    offset.current = 0;
    setElapsed(0);
  }, [key]);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const tick = (now: number) => {
      const e = now - start.current + offset.current;
      setElapsed(e);
      if (e < endRef.current + 50) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, reduced, end]);

  const skip = useCallback(() => {
    offset.current = endRef.current - (performance.now() - start.current) + 1;
    setElapsed(endRef.current + 1);
  }, []);

  const replay = useCallback(() => {
    start.current = performance.now();
    offset.current = 0;
    setElapsed(0);
  }, []);

  const e = reduced ? end + 1 : elapsed;
  return { elapsed: e, skip, replay, done: e >= end };
}

export interface TypedLine {
  text: string;
  typing: boolean;
  /** 이미 다 친 줄 */
  done: boolean;
}

export interface TypeSchedule {
  /** 각 줄의 시작 시각 */
  starts: number[];
  end: number;
}

/** 줄마다 한 글자씩 치는 시간표 */
export function typeSchedule(texts: readonly string[], opts: { startAt: number; perChar: number; gap: number }): TypeSchedule {
  let t = opts.startAt;
  const starts: number[] = [];
  for (const txt of texts) {
    starts.push(t);
    t += [...txt].length * opts.perChar + opts.gap;
  }
  return { starts, end: t };
}

/** 지금까지 보일 글자 (아직 시작하지 않은 줄은 빼고) */
export function typedLines(texts: readonly string[], sched: TypeSchedule, elapsed: number, perChar: number): TypedLine[] {
  const out: TypedLine[] = [];
  texts.forEach((txt, i) => {
    const st = sched.starts[i] ?? 0;
    if (elapsed < st) return;
    const chars = [...txt];
    const n = Math.max(0, Math.min(chars.length, Math.floor((elapsed - st) / perChar)));
    out.push({ text: chars.slice(0, n).join(''), typing: n < chars.length, done: n >= chars.length });
  });
  return out;
}
