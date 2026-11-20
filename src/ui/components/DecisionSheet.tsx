// 결정 팝업: 아래에서 올라오는 시트 (화면 시안 TurnModal)
// 방침 선택, 월초 사건, 중순 사건, 남은 고기 처리가 모두 이 컴포넌트를 쓴다.
// 위: 제목과 핵심 수치 칩(고정) / 가운데: 대사와 선택지 카드 / 아래: 고른 것과 확정 버튼(고정)

import { useEffect, useRef, type ReactNode } from 'react';
import type { Hint, SceneSpec } from '../../engine';
import { useT } from '../i18n';
import { Icon, RiskBadge } from './bits';
import { Portrait, SceneView } from './SceneView';
import d from './sheet.module.css';
import u from '../ui.module.css';

export interface Chip {
  text: string;
  tone: 'warn' | 'normal' | 'good';
}

export interface Quote {
  key: string;
  seat?: string;
  name: string;
  /** 입장 이름 (대담, 신중...) */
  tag?: string;
  text: string;
  ailing?: boolean;
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  kicker: string;
  title: string;
  chips: Chip[];
  quotes?: Quote[];
  /** 사건 본문과 장면 */
  intro?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}

export function DecisionSheet({ open, onClose, kicker, title, chips, quotes, intro, children, footer }: SheetProps) {
  const tr = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={d.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} className={d.sheet} role="dialog" aria-modal="true" aria-label={title}>
        <div className={d.head}>
          <div className={d.headRow}>
            <div className={d.titles}>
              <span className={u.label}>{kicker}</span>
              <h2 className={`${d.title} ${u.serif}`}>{title}</h2>
            </div>
            <button type="button" className={`${u.btnGhost} ${d.close}`} onClick={onClose} aria-label={tr.t('ui.sheet.close')}>
              {tr.t('ui.sheet.close')} <Icon name="close" size={16} />
            </button>
          </div>
          <div className={d.chips}>
            {chips.map((c, i) => (
              <span key={i} className={`${u.chip} ${c.tone === 'warn' ? u.chipWarn : c.tone === 'good' ? u.chipGood : ''}`}>
                {c.tone === 'warn' && <span aria-hidden="true">!</span>}
                {c.text}
              </span>
            ))}
          </div>
        </div>

        <div className={d.body}>
          {intro}
          {quotes && quotes.length > 0 && (
            <div className={d.quotes}>
              {quotes.map((q) => (
                <div key={q.key} className={d.quote}>
                  <Portrait seat={q.seat} size={36} ailing={q.ailing} label={q.name} />
                  <div className={d.quoteText}>
                    <span className={d.quoteWho}>
                      <b>{q.name}</b> {q.tag && <span className={u.muted}>· {q.tag}</span>}
                    </span>
                    <span className={`${d.quoteLine} ${u.serif}`}>“{q.text}”</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className={d.choices}>{children}</div>
        </div>

        <div className={d.foot}>{footer}</div>
      </div>
    </div>
  );
}

interface ChoiceProps {
  num: number;
  title: string;
  desc?: string;
  cost?: string;
  crew?: string;
  hint?: Hint;
  scene?: SceneSpec;
  selected: boolean;
  disabled?: boolean;
  lockText?: string;
  onPick: () => void;
}

/** 선택지 카드: 장면, 번호, 위험 배지, 제목, 설명, 대가, 투입 인원. 잠긴 선택지는 점선과 힌트 */
export function ChoiceCard({ num, title, desc, cost, crew, hint, scene, selected, disabled, lockText, onPick }: ChoiceProps) {
  return (
    <button
      type="button"
      className={`${d.choice} ${selected ? d.on : ''} ${disabled ? d.locked : ''}`}
      aria-pressed={selected}
      aria-disabled={disabled}
      onClick={() => !disabled && onPick()}
    >
      {scene && (
        <div className={d.thumb}>
          <SceneView scene={scene} />
        </div>
      )}
      <div className={d.choiceBody}>
        <div className={d.choiceTop}>
          <span className={d.num}>{num}</span>
          {hint && <RiskBadge hint={hint} />}
        </div>
        <span className={`${d.choiceTitle} ${u.serif}`}>{title}</span>
        {desc && <span className={d.desc}>{desc}</span>}
        {cost && <span className={d.cost}>{cost}</span>}
        {disabled && lockText && <span className={d.lock}>⊘ {lockText}</span>}
        {crew && <span className={d.crew}>{crew}</span>}
      </div>
    </button>
  );
}
