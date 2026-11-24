// 상단 지표 바 (2026-11-24 3차 피드백): 월초 상황, 진행 화면, 이달의 결과가 함께 쓴다.
// 인구, 식량 kg·며칠치, 장작, 일손·아픈 사람, 결속.
// - live: 지금 값 (월초 상황 화면)
// - start: 월초 기준으로 고정 (진행 화면. 순마다 갱신하지 않는다)
// - result: 이달의 결과. 새 값 옆에 월초 대비 증감

import type { ReactNode } from 'react';
import { cohesionBand, countBand, firewoodDays, monthDef, monthStartOf, type ChapterDefinition, type GameState, type MonthStart } from '../../engine';
import { dateText, tribeDisplayName, weatherSummary } from '../format';
import { useT } from '../i18n';

import { SettingsMenu } from './SettingsMenu';
import s from './status.module.css';

export type StatusMode = 'live' | 'start' | 'result';

interface Props {
  def: ChapterDefinition;
  state: GameState;
  mode: StatusMode;
  /** 가운데에 넣을 것 (진행 단계 표시) */
  children?: ReactNode;
}

const num = (n: number) => Math.round(n).toLocaleString('ko-KR');

function Delta({ d, unit = '' }: { d: number; unit?: string }) {
  const r = Math.round(d);
  if (r === 0) return null;
  return (
    <span className={r > 0 ? s.up : s.down}>
      {r > 0 ? '+' : '−'}
      {num(Math.abs(r))}
      {unit}
    </span>
  );
}

export function StatusBar({ def, state, mode, children }: Props) {
  const tr = useT();
  const now = monthStartOf(def, state);
  const start = state.work.start;
  const v: MonthStart = mode === 'start' ? start : now;
  const ui = def.balance.ui;
  const foodWarn = v.foodDays < ui.foodWarnDays;
  const season = monthDef(def, state).season;
  const woodWarn = mode === 'live' && firewoodDays(def, state) < ui.firewoodWarnDays && (season === 'winter' || season === 'autumn');
  const full = mode === 'live';
  const delta = mode === 'result';
  const ailing = v.sick + v.injured;

  return (
    <header className={`${s.bar} ${full ? s.full : s.compact}`}>
      <div className={s.inner}>
        <div className={s.brand}>
          <span className={s.tribe}>{tribeDisplayName(tr, def, state)}</span>
          <span className={s.when}>{full ? tr.t('ui.top.month', { date: dateText(tr, def, state), weather: weatherSummary(tr, state) }) : dateText(tr, def, state)}</span>
        </div>
        {children}
        <div className={s.stats}>
          {mode === 'start' && <span className={s.basis}>{tr.t('ui.status.basis')}</span>}
          <span className={s.stat}>
            <b>{tr.t('ui.top.people', { n: v.population })}</b>
            {full && <span className={s.muted}>{tr.t('ui.top.bands', { a: countBand(def, state, 'adult'), e: countBand(def, state, 'elder'), c: countBand(def, state, 'child') })}</span>}
            {delta && <Delta d={now.population - start.population} />}
          </span>
          <span className={`${s.stat} ${foodWarn ? s.warn : ''}`}>
            <b>{tr.t('ui.top.food', { kg: num(v.food) })}</b>
            <span className={foodWarn ? s.warnText : s.muted}>{tr.t('ui.top.foodDays', { days: v.foodDays })}</span>
            {delta && <Delta d={now.food - start.food} />}
          </span>
          <span className={`${s.stat} ${woodWarn ? s.warn : ''}`}>
            <b>{tr.t('ui.top.firewood', { kg: num(v.firewood) })}</b>
            {delta && <Delta d={now.firewood - start.firewood} />}
          </span>
          <span className={s.stat}>
            <b>{tr.t('ui.status.workers', { n: v.workers })}</b>
            {ailing > 0 && <span className={s.muted}>{tr.t('ui.status.ailing', { n: ailing })}</span>}
          </span>
          <span className={`${s.stat} ${v.cohesion < 25 ? s.warn : ''}`}>
            <b>{tr.t('ui.top.cohesion', { n: Math.round(v.cohesion) })}</b>
            {full && <span className={s.muted}>{tr.t(`cohesion.${cohesionBand(def, v.cohesion)}`)}</span>}
            {delta && <Delta d={now.cohesion - start.cohesion} />}
          </span>
          <SettingsMenu />
        </div>
      </div>
    </header>
  );
}

/** 진행 단계 표시: 전략 ✓ → 상순 → 중순 → 하순 → 이달의 결과 */
export const STEPS = ['policy', 'early', 'mid', 'late', 'settlement'] as const;
export type StepId = (typeof STEPS)[number];

export function StepTrail({ now }: { now: StepId }) {
  const tr = useT();
  const at = STEPS.indexOf(now);
  return (
    <ol className={s.steps} aria-label={tr.t('ui.steps')}>
      {STEPS.map((st, i) => (
        <li key={st} className={s.stepItem}>
          {i > 0 && (
            <span className={s.dash} aria-hidden="true">
              —
            </span>
          )}
          <span className={`${s.step} ${i < at ? s.done : ''} ${i === at ? s.now : ''}`} aria-current={i === at ? 'step' : undefined}>
            {tr.t(`ui.step.${st}`)}
            {i < at && ' ✓'}
          </span>
        </li>
      ))}
    </ol>
  );
}
