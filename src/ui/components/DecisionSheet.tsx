// 결정 팝업 (화면 시안 Decide, 2026-11-24 3차 피드백 · 2026-11-25 4차 피드백)
// 데스크톱은 화면 가운데 대화상자, 폭 640px 미만은 아래에서 올라오는 시트.
// 전략 고르기, 월초 사건, 중순 사건, 남은 고기 처리가 모두 이 틀을 쓴다. 기본 글자 크기에서 세로 스크롤이 없다.
// 위: 제목(전략은 단계 표시)과 핵심 수치 칩 / 가운데: 전략 틀(①식량 ②발전) 또는 사건 틀 / 아래: 고른 것과 대가, 다음·확정 버튼

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Hint, PlanLabor, SceneSpec } from '../../engine';
import { useT } from '../i18n';
import type { Choice, DecisionModel } from './Decision';
import { Icon, RiskBadge } from './bits';
import { Portrait, SceneView } from './SceneView';
import d from './sheet.module.css';
import u from '../ui.module.css';

export interface Chip {
  text: string;
  tone: 'warn' | 'normal' | 'good';
  /** 기본 칩(식량·장작·날씨): 늘 맨 앞에 보인다. 그 밖(위험·기회)은 뒤에, 넘치면 "외 n개"로 */
  base?: boolean;
}

/** 머리 칩은 최대 이만큼의 줄로 보인다 (2026-11-25 5차 피드백) */
export const CHIP_LINES = 2;

/**
 * 기본 칩(식량·장작·날씨) → 경고 칩(위험) → 나머지(기회 등). 같은 묶음 안에서는 들어온 순서 그대로.
 * 그래서 경고 칩이 "외 n개"로 들어가는 것은 경고 칩만으로 두 줄이 넘칠 때뿐이다.
 */
export function orderChips(chips: readonly Chip[]): Chip[] {
  const rank = (c: Chip) => (c.base ? 0 : c.tone === 'warn' ? 1 : 2);
  return [0, 1, 2].flatMap((k) => chips.filter((c) => rank(c) === k));
}

/**
 * 머리 칩 줄: 최대 CHIP_LINES줄까지 줄바꿈해 보이고, 넘치면 마지막에 "외 n개" 칩을 둔다.
 * "외 n개"를 누르거나 마우스를 올리면 나머지가 작은 팝오버로 보인다. 흐리게 잘라 숨기지 않는다.
 * 몇 개가 들어가는지는 그린 뒤 재서(칩의 offsetTop으로 줄 수를 센다) 줄여 간다. 기본 칩은 숨기지 않는다.
 */
function ChipRow({ chips }: { chips: readonly Chip[] }) {
  const tr = useT();
  const sig = chips.map((c) => `${c.tone}:${c.base ? 1 : 0}:${c.text}`).join('|');
  const ordered = orderChips(chips);
  const baseCount = ordered.filter((c) => c.base).length;
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ sig: '', width: -1, shown: ordered.length });
  const [, setWidth] = useState(0);
  const [more, setMore] = useState(false);
  const fresh = fit.sig === sig;
  const shown = fresh ? fit.shown : ordered.length;

  // 폭이 바뀌면 다시 잰다 (높이만 바뀐 것은 무시)
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.clientWidth;
    // 칩이나 폭이 바뀌었으면 전부 그린 상태에서 다시 잰다
    if (!fresh || fit.width !== w) {
      if (shown !== ordered.length) {
        setFit({ sig, width: w, shown: ordered.length });
        return;
      }
    }
    const items = Array.from(el.children) as HTMLElement[];
    const tops = [...new Set(items.map((x) => Math.round(x.offsetTop)))].sort((a, b) => a - b);
    if (tops.length <= CHIP_LINES) {
      if (!fresh || fit.width !== w) setFit({ sig, width: w, shown });
      return;
    }
    const lastTop = tops[CHIP_LINES - 1]!;
    // 처음 넘쳤으면 두 줄 안에 든 만큼, "외 n개"가 있는데도 넘치면 하나씩 줄인다
    const fits = items.filter((x) => Math.round(x.offsetTop) <= lastTop).length;
    const next = Math.max(baseCount, shown === ordered.length ? Math.min(fits, ordered.length - 1) : shown - 1);
    if (next !== shown || !fresh || fit.width !== w) setFit({ sig, width: w, shown: next });
  });

  const visible = ordered.slice(0, shown);
  const hidden = ordered.slice(shown);
  const chip = (c: Chip, i: number) => (
    <span key={i} className={`${d.chip} ${c.tone === 'warn' ? d.chipWarn : c.tone === 'good' ? d.chipGood : ''}`}>
      {c.tone === 'warn' && <span aria-hidden="true">! </span>}
      {c.text}
    </span>
  );
  return (
    <div ref={ref} className={d.chips} data-chips={hidden.length > 0 ? 'more' : 'all'}>
      {visible.map(chip)}
      {hidden.length > 0 && (
        <span className={d.moreWrap} onMouseEnter={() => setMore(true)} onMouseLeave={() => setMore(false)}>
          <button
            type="button"
            className={`${d.chip} ${d.moreChip} ${hidden.some((c) => c.tone === 'warn') ? d.chipWarn : ''}`}
            aria-expanded={more}
            onClick={() => setMore((m) => !m)}
            onBlur={() => setMore(false)}
          >
            {tr.t('ui.sheet.moreChips', { n: hidden.length })}
          </button>
          {more && (
            <span className={d.morePop} role="tooltip">
              <span className={d.morePopInner}>{hidden.map(chip)}</span>
            </span>
          )}
        </span>
      )}
    </div>
  );
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
  /** 제목 옆 단계 표시 (전략 틀) */
  steps?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}

export function DecisionSheet({ open, onClose, kicker, title, chips, steps, children, footer }: SheetProps) {
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
      <div ref={ref} tabIndex={-1} className={d.sheet} role="dialog" aria-modal="true" aria-label={title} data-fit="sheet">
        <div className={d.head}>
          <div className={d.titles}>
            <h2 className={`${d.title} ${u.serif}`}>{title}</h2>
            <span className={d.kicker}>{kicker}</span>
          </div>
          {steps}
          <ChipRow chips={chips} />
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
  /** 위에 장면 그림(약 100px)을 두는 세로 카드 (전략 카드) */
  tall?: boolean;
  onPick: () => void;
}

/** 카드: (전략은 위에 그림 100px) 제목 / 위험 배지 / 한 줄 설명 / 대가 한 줄. 막힌 카드는 흐리게 + 이유 한 줄 */
export function ChoiceCard({ title, brief, meta, hint, scene, num, selected, accent, disabled, blockText, full, tall, onPick }: CardProps) {
  return (
    <button
      type="button"
      className={`${d.card} ${d[accent]} ${tall ? d.tall : ''} ${selected ? d.on : ''} ${disabled ? d.blocked : ''}`}
      aria-pressed={selected}
      aria-disabled={disabled}
      title={full}
      onClick={() => !disabled && onPick()}
    >
      {scene && (
        <span className={tall ? d.pic : d.thumb}>
          <SceneView scene={scene} />
        </span>
      )}
      {tall && !scene && <span className={`${d.pic} ${d.picEmpty}`} aria-hidden="true" />}
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

export type PlanStep = 1 | 2;

interface StepsProps {
  step: PlanStep;
  /** ②단계로 갈 수 있는가 (식량을 골랐고 큰 일이 아니다) */
  canGrowth: boolean;
  onStep: (s: PlanStep) => void;
}

/** 단계 표시 "1 식량 · 2 발전": 누르면 그 단계로, 지금 단계 강조 */
export function PlanSteps({ step, canGrowth, onStep }: StepsProps) {
  const tr = useT();
  const item = (n: PlanStep, label: string, enabled: boolean) => (
    <button type="button" className={`${d.step} ${step === n ? d.stepOn : ''}`} aria-current={step === n ? 'step' : undefined} disabled={!enabled} onClick={() => onStep(n)}>
      <span className={d.stepNum}>{n}</span>
      {label}
    </button>
  );
  return (
    <nav className={d.steps} aria-label={tr.t('ui.plan.steps')}>
      {item(1, tr.t('ui.plan.step.food'), true)}
      <span className={d.stepSep} aria-hidden="true">
        ·
      </span>
      {item(2, tr.t('ui.plan.step.growth'), canGrowth)}
    </nav>
  );
}

interface PlanBodyProps {
  model: DecisionModel;
  step: PlanStep;
  picked: string[];
  labor: PlanLabor;
  growthInfo: Map<string, { meta: string; blocked?: string }>;
  majorPicked: boolean;
  onPick: (c: Choice) => void;
  onStep: (s: PlanStep) => void;
}

/** 전략 틀. ①단계: 조언 4칸 → 식량 카드 → 큰 일 한 줄 / ②단계: 고른 식량 한 줄 → 일손 막대 → 발전 카드 */
export function PlanBody({ model, step, picked, labor, growthInfo, majorPicked, onPick, onStep }: PlanBodyProps) {
  const tr = useT();
  const food = model.choices.filter((c) => c.group === 'food');
  const growth = model.choices.filter((c) => c.group === 'growth');
  const major = model.choices.filter((c) => c.group === 'major');
  const total = Math.max(1, labor.total);
  const full = (c: Choice) => [c.desc, c.cost].filter(Boolean).join(' ');

  if (step === 1)
    return (
      <div className={d.plan}>
        <Quotes quotes={model.quotes} cols={4} />

        <section className={`${d.slot} ${majorPicked ? d.slotDim : ''}`}>
          <div className={d.slotHead}>
            <h3 className={`${d.slotTitle} ${d.foodInk}`}>{tr.t('ui.plan.group.food')}</h3>
            <span className={d.slotSub}>{tr.t('ui.plan.group.food.sub')}</span>
          </div>
          <div className={d.row}>
            {food.map((c, i) => (
              <ChoiceCard key={c.id} tall num={i + 1} accent="food" title={c.title} brief={c.brief} meta={c.meta} hint={c.hint} scene={c.scene} full={full(c)} selected={picked.includes(c.id)} onPick={() => onPick(c)} />
            ))}
          </div>
        </section>

        {major.map((c) => (
          <button key={c.id} type="button" className={`${d.major} ${picked.includes(c.id) ? d.on : ''}`} aria-pressed={picked.includes(c.id)} title={full(c)} onClick={() => onPick(c)}>
            <span className={d.num} aria-hidden="true">
              0
            </span>
            <span className={d.majorTag}>{tr.t('ui.plan.group.major')}</span>
            <b className={`${d.majorTitle} ${u.serif}`}>{c.title}</b>
            <span className={d.majorText}>{majorPicked ? tr.t('ui.plan.majorPicked', { major: c.title }) : [c.brief, c.meta].filter(Boolean).join(' · ')}</span>
            {c.hint && <RiskBadge hint={c.hint} />}
          </button>
        ))}
      </div>
    );

  const pickedFood = food.find((c) => picked.includes(c.id));
  return (
    <div className={d.plan}>
      {pickedFood && (
        <div className={d.foodLine}>
          <span>
            <span className={d.foodInk}>{tr.t('ui.plan.foodLine', { food: pickedFood.title, n: labor.food })}</span>
          </span>
          <button type="button" className={d.change} onClick={() => onStep(1)}>
            {tr.t('ui.plan.change')}
          </button>
        </div>
      )}

      <div className={d.labor}>
        <b className={d.laborTotal}>{tr.t('ui.chip.workers', { n: labor.total })}</b>
        <div className={d.laborBar} aria-hidden="true">
          <div className={d.laborFood} style={{ width: `${(labor.food / total) * 100}%` }} />
          <div className={d.laborGrowth} style={{ width: `${(labor.growth / total) * 100}%` }} />
          <div className={d.laborVillage} style={{ width: `${(labor.village / total) * 100}%` }} />
        </div>
        <span className={d.laborText}>
          <b className={d.foodInk}>{tr.t('ui.plan.laborFood', { n: labor.food })}</b> · <b className={d.growthInk}>{tr.t('ui.plan.laborGrowth', { n: labor.growth })}</b>
          {labor.village > 0 && ` · ${tr.t('ui.plan.laborVillage', { n: labor.village })}`}
          {labor.helpers > 0 && <span className={u.muted}> {tr.t('ui.plan.laborHelpers', { n: labor.helpers })}</span>}
        </span>
      </div>

      <section className={d.slot}>
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
                tall
                num={i + 1}
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
