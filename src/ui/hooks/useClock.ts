// 화면의 시간표: 흐른 시간(ms)을 재고, "빨리 보기"(끝으로 건너뛰기)와 "다시 보기"를 제공한다.
// 타이핑과 순차 등장은 모두 이 시간에서 계산한다 (시안의 elapsed 방식).
// 움직임을 줄였으면 처음부터 끝 상태로 보여 준다 (그래도 실제 흐른 시간 run은 잰다 — 자동 진행용).
//
// 두 가지 시간을 따로 센다.
// - run: 실제로 흐른 시간. 멈춤(hold) 동안은 늘지 않는다. 자동 진행은 이것으로 잰다.
// - elapsed: 화면에 보이는 진행. run + "빨리 보기"로 건너뛴 시간.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMotion } from '../motion';

export interface Clock {
  elapsed: number;
  /** 실제로 흐른 시간 (건너뛴 시간 제외) */
  run: number;
  /** 끝까지 건너뛴다 */
  skip: () => void;
  replay: () => void;
  done: boolean;
}

export interface ClockOpts {
  /** 시간을 멈춘다 (화면에 아직 안 보임, 일시정지) */
  hold?: boolean;
  /** 끝에 닿으면 더 세지 않는다 (결정을 기다리는 동안 시간이 쌓이지 않게) */
  stopAtEnd?: boolean;
  /** 끝난 뒤에도 이만큼 더 센다 (자동 진행의 쉬는 시간) */
  tail?: number;
}

/** end: 시간표의 끝(ms, 이미 속도 배율을 곱한 값). key가 바뀌면 처음부터 다시 잰다 */
export function useClock(end: number, key: unknown, opts: ClockOpts = {}): Clock {
  const { reduced } = useMotion();
  const hold = !!opts.hold;
  const stopAtEnd = !!opts.stopAtEnd;
  const tail = opts.tail ?? 0;
  const run = useRef(0);
  const jump = useRef(0);
  const [t, setT] = useState({ run: 0, jump: 0 });
  // 다시 보기를 누르면 늘려서 시간 재기를 새로 시작한다
  const [gen, setGen] = useState(0);
  const endRef = useRef(end);
  endRef.current = end;

  useEffect(() => {
    run.current = 0;
    jump.current = 0;
    setT({ run: 0, jump: 0 });
  }, [key]);

  useEffect(() => {
    if (hold) return;
    const limit = stopAtEnd ? end : end + tail + 50;
    if (run.current >= limit) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      run.current = Math.min(limit, run.current + Math.max(0, now - last));
      last = now;
      setT({ run: run.current, jump: jump.current });
      if (run.current < limit) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, gen, hold, end, tail, stopAtEnd]);

  const skip = useCallback(() => {
    jump.current = Math.max(jump.current, endRef.current - run.current + 1);
    setT({ run: run.current, jump: jump.current });
  }, []);

  const replay = useCallback(() => {
    run.current = 0;
    jump.current = 0;
    setT({ run: 0, jump: 0 });
    setGen((g) => g + 1);
  }, []);

  const e = reduced ? end + 1 : t.run + t.jump;
  return { elapsed: e, run: t.run, skip, replay, done: e >= end };
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
