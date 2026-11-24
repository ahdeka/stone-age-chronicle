// 결정 팝업: 아래에서 올라오는 시트 (화면 시안 Decide, 2026-11-24 3차 피드백)
// 전략 고르기, 월초 사건, 중순 사건, 남은 고기 처리가 모두 이 틀을 쓴다. 기본 글자 크기에서 세로 스크롤이 없다.
// 위: 제목과 핵심 수치 칩 / 가운데: 전략 틀 또는 사건 틀 / 아래: 고른 것과 대가, 확정 버튼

import { useEffect, useRef, type ReactNode } from 'react';
import type { Hint, SceneSpec } from '../../engine';
import { useT } from '../i18n';
import type { Choice, DecisionModel } from './Decision';
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
  /** 전략 틀은 넓게 */
  wide?: boolean;
  children: ReactNode;
  footer: ReactNode;
}

export function DecisionSheet({ open, onClose, kicker, title, chips, wide, children, footer }: SheetProps) {
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
      <div ref={ref} tabIndex={-1} className={`${d.sheet} ${wide ? d.wide : ''}`} role="dialog" aria-modal="true" aria-label={title} data-fit="sheet">
        <div className={d.head}>
          <div className={d.titles}>
            <h2 className={`${d.title} ${u.serif}`}>{title}</h2>
            <span className={d.kicker}>{kicker}</span>
          </div>
          <div className={d.chips}>
            {chips.map((c, i) => (
              <span key={i} className={`${d.chip} ${c.tone === 'warn' ? d.chipWarn : c.tone === 'good' ? d.chipGood : ''}`}>
                {c.tone === 'warn' && <span aria-hidden="true">! </span>}
                {c.text}
              </span>
            ))}
          </div>
          <button type="button" className={`${u.btnGhost} ${d.close}`} onClick={onClose} aria-label={tr.t('ui.sheet.close')}>
            {tr.t('ui.sheet.close')} <Icon name="close" size={14} />
          </button>
        </div>
        <div className={d.body}>{children}</div>
        <div className={d.foot}>{footer}</div>
      </div>
    </div>
  );
}

/** 조언 한 줄 (4칸, 칸마다 최대 2줄) */
function Quotes({ quotes, cols }: { quotes: Quote[]; cols: number }) {
  if (quotes.length === 0) return null;
  return (
    <div className={d.quotes} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {quotes.map((q) => (
        <div key={q.key} className={d.quote}>
          <Portrait seat={q.seat} size={26} ailing={q.ailing} label={q.name} />
          <span className={d.quoteText}>
            <b>{q.name}</b> <span className={u.serif}>“{q.text}”</span>
          </span>
        </div>
      ))}
    </div>
  );
}

interface CardProps {
  title: string;
  brief?: string;
  meta?: string;
  hint?: Hint;
  scene?: SceneSpec;
  num: number;
  selected: boolean;
  accent: 'food' | 'growth' | 'option';
  disabled?: boolean;
  blockText?: string;
  full?: string;
  onPick: () => void;
}

/** 카드: 작은 그림 36px + 제목 / 위험 배지 / 한 줄 설명 / 대가 한 줄. 막힌 카드는 흐리게 + 이유 한 줄 */
export function ChoiceCard({ title, brief, meta, hint, scene, num, selected, accent, disabled, blockText, full, onPick }: CardProps) {
  return (
    <button
      type="button"
      className={`${d.card} ${d[accent]} ${selected ? d.on : ''} ${disabled ? d.blocked : ''}`}
      aria-pressed={selected}
      aria-disabled={disabled}
      title={full}
      onClick={() => !disabled && onPick()}
    >
      {scene && (
        <span className={d.thumb}>
          <SceneView scene={scene} />
        </span>
      )}
      <span className={d.cardBody}>
        <span className={d.cardTop}>
          <span className={d.num} aria-hidden="true">
            {num}
          </span>
          <b className={`${d.cardTitle} ${u.serif}`}>{title}</b>
        </span>
        {hint && (
          <span className={d.badgeRow}>
            <RiskBadge hint={hint} />
          </span>
        )}
        {brief && <span className={d.brief}>{brief}</span>}
        {disabled && blockText ? <span className={d.blockText}>⊘ {blockText}</span> : meta && <span className={d.meta}>{meta}</span>}
      </span>
    </button>
  );
}

interface PlanBodyProps {
  model: DecisionModel;
  picked: string[];
  labor: { total: number; food: number; growth: number };
  growthInfo: Map<string, { meta: string; blocked?: string }>;
  majorPicked: boolean;
  onPick: (c: Choice) => void;
}

/** 전략 틀: 조언 4칸 → 일손 막대 → 식량 줄 → 발전 줄 → 큰 일 한 줄 */
export function PlanBody({ model, picked, labor, growthInfo, majorPicked, onPick }: PlanBodyProps) {
  const tr = useT();
  const food = model.choices.filter((c) => c.group === 'food');
  const growth = model.choices.filter((c) => c.group === 'growth');
  const major = model.choices.filter((c) => c.group === 'major');
  const total = Math.max(1, labor.total);
  const full = (c: Choice) => [c.desc, c.cost].filter(Boolean).join(' ');

  return (
    <div className={d.plan}>
      <Quotes quotes={model.quotes} cols={4} />

      <div className={d.labor}>
        <b className={d.laborTotal}>{tr.t('ui.chip.workers', { n: labor.total })}</b>
        <div className={d.laborBar} aria-hidden="true">
          <div className={d.laborFood} style={{ width: `${(labor.food / total) * 100}%` }} />
          <div className={d.laborGrowth} style={{ width: `${(labor.growth / total) * 100}%` }} />
        </div>
        <span className={d.laborText}>
          <b className={d.foodInk}>{tr.t('ui.plan.laborFood', { n: labor.food })}</b> · <b className={d.growthInk}>{tr.t('ui.plan.laborGrowth', { n: labor.growth })}</b>
        </span>
      </div>

      <section className={`${d.slot} ${majorPicked ? d.slotDim : ''}`}>
        <div className={d.slotHead}>
          <h3 className={`${d.slotTitle} ${d.foodInk}`}>{tr.t('ui.plan.group.food')}</h3>
          <span className={d.slotSub}>{tr.t('ui.plan.group.food.sub')}</span>
        </div>
        <div className={d.row}>
          {food.map((c, i) => (
            <ChoiceCard key={c.id} num={i + 1} accent="food" title={c.title} brief={c.brief} meta={c.meta} hint={c.hint} scene={c.scene} full={full(c)} selected={picked.includes(c.id)} onPick={() => onPick(c)} />
          ))}
        </div>
      </section>

      <section className={`${d.slot} ${majorPicked ? d.slotDim : ''}`}>
        <div className={d.slotHead}>
          <h3 className={`${d.slotTitle} ${d.growthInk}`}>{tr.t('ui.plan.group.growth')}</h3>
          <span className={d.slotSub}>{tr.t('ui.plan.group.growth.sub')}</span>
        </div>
        <div className={d.row}>
          {growth.map((c, i) => {
            const info = growthInfo.get(c.id);
            return (
              <ChoiceCard
                key={c.id}
                num={i + 5}
                accent="growth"
                title={c.title}
                brief={c.brief}
                meta={info?.meta ?? c.meta}
                hint={c.hint}
                scene={c.scene}
                full={full(c)}
                disabled={!!info?.blocked}
                blockText={info?.blocked}
                selected={picked.includes(c.id)}
                onPick={() => onPick(c)}
              />
            );
          })}
        </div>
      </section>

      {major.map((c) => (
        <button key={c.id} type="button" className={`${d.major} ${picked.includes(c.id) ? d.on : ''}`} aria-pressed={picked.includes(c.id)} title={full(c)} onClick={() => onPick(c)}>
          <span className={d.majorTag}>{tr.t('ui.plan.group.major')}</span>
          <b className={`${d.majorTitle} ${u.serif}`}>{c.title}</b>
          <span className={d.majorText}>{majorPicked ? tr.t('ui.plan.majorPicked', { major: c.title }) : [c.brief, c.meta].filter(Boolean).join(' · ')}</span>
          {c.hint && <RiskBadge hint={c.hint} />}
        </button>
      ))}
    </div>
  );
}

/** 사건 틀: 그림 + 본문·대사 → 선택지 한 줄 */
export function EventBody({ model, picked, onPick }: { model: DecisionModel; picked: string[]; onPick: (c: Choice) => void }) {
  const n = Math.max(2, Math.min(4, model.choices.length));
  return (
    <div className={d.event}>
      <div className={d.eventTop}>
        {model.intro?.scene && (
          <div className={d.eventScene}>
            <SceneView scene={model.intro.scene} />
          </div>
        )}
        <div className={d.eventText}>
          {model.intro && <p className={`${d.eventProse} ${u.serif}`}>{model.intro.text}</p>}
          {model.quotes.length > 0 && (
            <div className={d.eventQuotes}>
              {model.quotes.map((q) => (
                <div key={q.key} className={d.quote}>
                  <Portrait seat={q.seat} size={26} ailing={q.ailing} label={q.name} />
                  <span className={d.quoteText}>
                    <b>{q.name}</b> <span className={u.serif}>“{q.text}”</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className={d.row} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {model.choices.map((c, i) => (
          <ChoiceCard
            key={c.id}
            num={i + 1}
            accent="option"
            title={c.title}
            brief={c.cost}
            hint={c.hint}
            disabled={c.disabled}
            blockText={c.lockText}
            selected={picked.includes(c.id)}
            onPick={() => onPick(c)}
          />
        ))}
      </div>
    </div>
  );
}
