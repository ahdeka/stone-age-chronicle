// 작은 공용 조각: 위험 배지, 굴러가는 숫자, 타이핑 줄, 상태 아이콘

import { useEffect, useRef, useState } from 'react';
import type { Hint } from '../../engine';
import { useT } from '../i18n';
import { useMotion } from '../motion';
import u from '../ui.module.css';

const MARK: Record<Hint, string> = { sure: '●', fair: '◆', risky: '▲', unknown: '?' };

/** 위험 단서 배지: 색과 모양을 함께 쓴다 (색만으로 정보를 전하지 않는다) */
export function RiskBadge({ hint }: { hint: Hint }) {
  const tr = useT();
  return (
    <span className={`${u.risk} ${u[hint]}`}>
      <span aria-hidden="true">{MARK[hint]}</span> {tr.t(`hint.${hint}`)}
    </span>
  );
}

/** 값이 바뀌면 이전 값에서 굴러간다 (움직임을 줄였으면 바로 바뀐다) */
export function RollingNumber({ value, ms = 700 }: { value: number; ms?: number }) {
  const { reduced, mul } = useMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduced) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / (ms * mul));
      const v = a + (value - a) * (1 - (1 - k) ** 3);
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, ms, mul, reduced]);
  return <>{Math.round(shown).toLocaleString('ko-KR')}</>;
}

export function Caret() {
  return <span className={u.caret} aria-hidden="true" />;
}

const ICONS: Record<string, string[]> = {
  people: ['M9 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z', 'M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6', 'M17 11.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z', 'M16 14.2c2.8.2 5 2.2 5 5.8'],
  food: ['M14.5 4.5c3 0 5 2.2 5 5 0 3.6-3.6 5.8-7 5.8l-3.6 3.6a2 2 0 1 1-2.8-2.8l3.6-3.6C10.2 9 11.5 4.5 14.5 4.5z'],
  firewood: ['M12 3c1.5 3 4.5 4.5 4.5 8.5a4.5 4.5 0 0 1-9 0C7.5 8.5 10 7 12 3z', 'M4 21l16-3M4 18l16 3'],
  hide: ['M6 4c2 1 4 1 6 0 2 1 4 1 6 0l-1 6 2 4-3 6H8l-3-6 2-4z'],
  cohesion: ['M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M8 13c1.2 1.6 2.4 2.4 4 2.4s2.8-.8 4-2.4'],
  close: ['M6 6 L18 18 M18 6 L6 18'],
  warn: ['M12 3 L22 20 L2 20 Z', 'M12 10 v4 M12 17 v0.5'],
  settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4'],
};

export function Icon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      {(ICONS[name] ?? []).map((d) => (
        <path key={d} className={u.icon} d={d} />
      ))}
    </svg>
  );
}
