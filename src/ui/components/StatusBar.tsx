// 상단 지표 바 (2026-11-24 3차 피드백): 월초 상황, 진행 화면, 이달의 결과가 함께 쓴다.
// 인구, 식량 kg·며칠치, 장작, 일할 사람·아픈 사람, 결속, "발전 나무 n/12" 단추(R2-b-2).
// - live: 지금 값 (월초 상황 화면)
// - start: 월초 기준으로 고정 (진행 화면. 순마다 갱신하지 않는다)
// - result: 이달의 결과. 새 값 옆에 월초 대비 증감

import { useMemo, type ReactNode } from 'react';
import { cohesionBand, countBand, firewoodDays, monthDef, monthStartOf, techView, type ChapterDefinition, type GameState, type MonthStart } from '../../engine';
import { useTree } from '../tree';
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
  /** 지금 값이라도 작은 바로 (발전 나무 판 위) */
  compact?: boolean;
  /** 발전 나무 판이 열려 있다 (단추 강조, 누르면 닫는다) */
  treeOn?: boolean;
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

export function StatusBar({ def, state, mode, children, compact = false, treeOn = false }: Props) {
  const tr = useT();
  const tree = useTree();
  const cells = useMemo(() => {
    const v = techView(def, state);
    return { done: v.done, total: v.total };
  }, [def, state]);
  const now = monthStartOf(def, state);
  const start = state.work.start;
  const v: MonthStart = mode === 'start' ? start : now;
  const ui = def.balance.ui;
  const foodWarn = v.foodDays < ui.foodWarnDays;
  const season = monthDef(def, state).season;
  const woodWarn = mode === 'live' && firewoodDays(def, state) < ui.firewoodWarnDays && (season === 'winter' || season === 'autumn');
  const full = mode === 'live' && !compact;
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
          {mode === 'start' && <span className={s.basis}>{tr.t(state.work.turn.kind === 'season' ? 'ui.status.basis.season' : 'ui.status.basis')}</span>}
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
          {tree && (
            <button
              type="button"
              className={`${s.treeBtn} ${treeOn ? s.treeOn : ''}`}
              aria-pressed={treeOn}
              onClick={() => (treeOn ? tree.close() : tree.open())}
              title={tr.t('ui.tree.keys')}
              data-tree-button
            >
              {tr.t('ui.tree.button')} <span className={s.muted}>{tr.t('ui.tree.count', cells)}</span>
            </button>
          )}
          <SettingsMenu />
        </div>
      </div>
    </header>
  );
}

/** 진행 단계 표시: 전략 ✓ → 상순 → 중순 → 하순 → 이달의 결과 */
export const STEPS = ['policy', 'early', 'mid', 'late', 'settlement'] as const;
export type StepId = (typeof STEPS)[number];

/** season: 계절 턴의 단계 이름 (초입·한가운데·끝자락) */
export function StepTrail({ now, season = false }: { now: StepId; season?: boolean }) {
  const tr = useT();
  const at = STEPS.indexOf(now);
  return (
    <ol className={s.steps} aria-label={tr.t(season ? 'ui.steps.season' : 'ui.steps')}>
      {STEPS.map((st, i) => (
        <li key={st} className={s.stepItem}>
          {i > 0 && (
            <span className={s.dash} aria-hidden="true">
              —
            </span>
          )}
          <span className={`${s.step} ${i < at ? s.done : ''} ${i === at ? s.now : ''} ${season ? s.stepTight : ''}`} aria-current={i === at ? 'step' : undefined}>
            {tr.t(season ? (tr.has(`ui.stage.trail.${st}`) ? `ui.stage.trail.${st}` : `ui.stage.${st}`) : `ui.step.${st}`)}
            {/* 계절 턴은 단계 이름이 길어(한가운데·끝자락·이 철의 결과) 1366폭에서 지표와 겹쳤다: ✓ 대신 흐린 글자만, 읽기 프로그램에는 "완료" */}
            {i < at && (season ? <span className="visually-hidden"> {tr.t('ui.step.doneMark')}</span> : ' ✓')}
          </span>
        </li>
      ))}
    </ol>
  );
}
