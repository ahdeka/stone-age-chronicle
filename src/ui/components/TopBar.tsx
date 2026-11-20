// 상단 바: 부족 이름, 달·계절·날씨, 상태 칩 (화면 시안 TurnModal의 header)

import type { ReactNode } from 'react';
import {
  coldestMonthFirewood,
  cohesionBand,
  countBand,
  firewoodDays,
  foodDays,
  monthDef,
  population,
  totalKg,
  type ChapterDefinition,
  type GameState,
} from '../../engine';
import { dateText, tribeDisplayName } from '../format';
import { useT } from '../i18n';
import { Icon, RollingNumber } from './bits';
import { SettingsMenu } from './SettingsMenu';
import c from './chrome.module.css';
import u from '../ui.module.css';

/** 이번 달 날씨를 한 줄로: 서로 다른 날씨만, 순서대로 (맑음, 서리) */
export function weatherSummary(tr: ReturnType<typeof useT>, state: GameState): string {
  return [...new Set(state.work.weather.filter(Boolean))].map((w) => tr.t(`weather.${w}`)).join(', ');
}

function Stat({ icon, warn, children }: { icon: string; warn?: boolean; children: ReactNode }) {
  return (
    <div className={`${c.stat} ${warn ? `${c.statWarn} ${u.warnPulse}` : ''}`}>
      <Icon name={icon} className={warn ? c.iconWarn : c.iconPlain} />
      <span>{children}</span>
    </div>
  );
}

export function TopBar({ def, state }: { def: ChapterDefinition; state: GameState }) {
  const tr = useT();
  const m = monthDef(def, state);
  const days = Math.floor(foodDays(def, state));
  const wDays = Math.floor(firewoodDays(def, state));
  const ui = def.balance.ui;
  const foodWarn = days < ui.foodWarnDays;
  const woodWarn = wDays < ui.firewoodWarnDays && (m.season === 'winter' || m.season === 'autumn');
  return (
    <header className={`${c.top} ${u.in}`}>
      <div className={c.topInner}>
        <div className={c.brand}>
          <span className={`${c.tribe} ${u.serif}`}>{tribeDisplayName(tr, def, state)}</span>
          <span className={c.when}>{tr.t('ui.top.month', { date: dateText(tr, def, state), weather: weatherSummary(tr, state) })}</span>
        </div>
        <div className={c.stats}>
          <Stat icon="people">
            <b>{tr.t('ui.top.people', { n: population(state) })}</b>{' '}
            <span className={u.muted}>
              {tr.t('ui.top.bands', { a: countBand(def, state, 'adult'), e: countBand(def, state, 'elder'), c: countBand(def, state, 'child') })}
            </span>
          </Stat>
          <Stat icon="food" warn={foodWarn}>
            <b>
              {tr.t('ui.ledger.food')} <RollingNumber value={totalKg(state.stores.food)} />
              kg
            </b>{' '}
            <span className={foodWarn ? c.warnText : u.muted}>{tr.t('ui.top.foodDays', { days })}</span>
          </Stat>
          <Stat icon="firewood" warn={woodWarn}>
            <b>
              {tr.t('ui.ledger.firewood')} <RollingNumber value={state.stores.firewood} />
              kg
            </b>{' '}
            <span className={woodWarn ? c.warnText : u.muted}>
              {woodWarn ? tr.t('ui.top.firewoodDays', { days: wDays }) : tr.t('ui.top.firewoodWinter', { kg: Math.round(coldestMonthFirewood(def, state) / 10) * 10 })}
            </span>
          </Stat>
          <Stat icon="hide">
            <b>{tr.t('ui.top.hides', { n: state.stores.goods['hide'] ?? 0 })}</b>
          </Stat>
          <Stat icon="cohesion" warn={state.cohesion < 25}>
            <b>{tr.t('ui.top.cohesion', { n: Math.round(state.cohesion) })}</b>{' '}
            <span className={u.muted}>{tr.t(`cohesion.${cohesionBand(def, state.cohesion)}`)}</span>
          </Stat>
          <SettingsMenu />
        </div>
      </div>
    </header>
  );
}
