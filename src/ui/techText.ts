// 발전 칸 보기(engine techView)를 화면 글로 (발전 나무 화면과 전략 팝업 ②단계가 같이 쓴다, R2-b-2)

import { calendarDate, type CellView, type ChapterDefinition, type GameState, type HiddenReason, type LockReason, type OpenView, type TechLogEntry } from '../engine';
import type { Translator } from '../i18n';

export const cellName = (tr: Translator, id: string) => tr.t(`tech.${id}`);
export const branchName = (tr: Translator, id: string) => tr.t(`branch.${id}`);

/** 진척 % (내림) */
export const cellPct = (v: Pick<CellView, 'progress' | 'seasons'>) => Math.floor((v.progress / v.seasons) * 100 + 1e-6);

/** 철 수를 턴 단위 글로: 1년차 "3달", 계절 턴 "1철". 소수는 한 자리 */
export function durText(tr: Translator, seasons: number, kind: 'month' | 'season'): string {
  const n = kind === 'month' ? seasons * 3 : seasons;
  const r = Math.round(n * 10) / 10;
  return tr.t(`ui.tree.dur.${kind}`, { n: Number.isInteger(r) ? r : r.toFixed(1) });
}

export function personName(tr: Translator, s: GameState, id: string | undefined): string | undefined {
  const p = id ? s.people[id] : undefined;
  return p ? tr.label(p.name) : undefined;
}

/** 맡을 사람: "바위", "바위 또는 이끼" */
export function crewWho(tr: Translator, s: GameState, v: CellView): string | undefined {
  const a = personName(tr, s, v.crew?.person);
  const b = personName(tr, s, v.crew?.fallback);
  if (a && b && a !== b) return tr.t('ui.tree.or', { a, b });
  return a ?? b;
}

/** 무리 한 줄: "1철 · 3명 · 바위 또는 이끼" (1년차 "3달 · 2명 · …") */
export function crewLine(tr: Translator, s: GameState, v: CellView, kind: 'month' | 'season'): string {
  return [durText(tr, v.seasons, kind), v.crew ? tr.t('ui.plan.crewN', { n: v.crew.n }) : '', crewWho(tr, s, v)].filter(Boolean).join(' · ');
}

/** 시작 비용: "가죽 6장 · 장작 100kg" / "비용 없음" / 이미 냈으면 "비용은 냈다" */
export function costText(tr: Translator, v: CellView): string {
  if (v.costPaid) return tr.t('ui.tree.cost.paid');
  const k = v.cost;
  const parts: string[] = [];
  for (const [g, n] of Object.entries(k?.goods ?? {})) parts.push(tr.t('ui.tree.cost.goods', { name: tr.t(`res.${g}`), n }));
  if (k?.firewoodKg) parts.push(tr.t('ui.tree.cost.firewood', { kg: k.firewoodKg }));
  if (k?.foodKg) parts.push(tr.t('ui.tree.cost.food', { kg: k.foodKg }));
  return parts.length ? parts.join(' · ') : tr.t('ui.tree.noCost');
}

export const openKind = (tr: Translator, o: Pick<OpenView, 'kind'>) => tr.t(`ui.tree.kind.${o.kind}`);
export const openName = (tr: Translator, o: OpenView) => tr.t(o.name);

/** 덧붙는 것 (tech.<id>.extra, 있을 때만) */
export function extraText(tr: Translator, id: string): string | undefined {
  return tr.has(`tech.${id}.extra`) ? tr.t(`tech.${id}.extra`) : undefined;
}

export function lockText(tr: Translator, lock: LockReason | undefined): string {
  if (!lock) return '';
  switch (lock.kind) {
    case 'prev':
      return tr.t('ui.tree.lock.prev', { cell: cellName(tr, lock.cell) });
    case 'branch':
      return lock.cell ? tr.t('ui.tree.lock.branchCell', { cell: cellName(tr, lock.cell) }) : tr.t('ui.tree.lock.branch', { branch: branchName(tr, lock.branch) });
    case 'custom':
      return tr.t(`tech.${lock.cell}.need`);
    case 'planned':
      return tr.t('ui.tree.lock.planned');
  }
}

/** 시작 비용이 모자란 양: "가죽 1장 모자람 · 장작 20kg 모자람" */
export function shortageText(tr: Translator, v: Pick<CellView, 'shortage'>): string {
  const s = v.shortage;
  if (!s) return '';
  const parts: string[] = [];
  for (const [g, n] of Object.entries(s.goods ?? {})) parts.push(tr.t('ui.plan.short.goods', { name: tr.t(`res.${g}`), n }));
  if (s.firewoodKg) parts.push(tr.t('ui.plan.short.firewood', { kg: s.firewoodKg }));
  if (s.foodKg) parts.push(tr.t('ui.plan.short.food', { kg: s.foodKg }));
  return parts.join(' · ');
}

export function hiddenText(tr: Translator, h: HiddenReason | undefined, v?: Pick<CellView, 'shortage'>): string {
  if (!h) return '';
  if (h.kind === 'behind') return tr.t('ui.tree.hidden.behind', { cell: cellName(tr, h.cell) });
  if (h.kind === 'cost') return tr.t('ui.tree.hidden.cost', { short: v ? shortageText(tr, v) : '' });
  return tr.t(`ui.tree.hidden.${h.kind}`);
}

/** 선물 줄: "왜가리가 준 몫 50%" / "선물로 받은 몫 33%" */
export function giftText(tr: Translator, s: GameState, v: CellView): string | undefined {
  if (v.gifted <= 1e-9) return undefined;
  const pct = Math.round((v.gifted / v.seasons) * 100);
  const name = personName(tr, s, v.giftBy);
  return name ? tr.t('ui.tree.gift.by', { name, pct }) : tr.t('ui.tree.gift', { pct });
}

/** 켜진 때: "2년차 봄" */
export function doneAtText(tr: Translator, def: ChapterDefinition, s: GameState, month: number): string {
  const d = calendarDate(def, s, month);
  return tr.t('ui.tree.doneAt', { year: d.year, season: tr.t(`season.${d.season}`) });
}

/** 칸 기록 한 줄 (칸 자세히) */
export function logText(tr: Translator, def: ChapterDefinition, s: GameState, l: TechLogEntry, kind: 'month' | 'season'): string {
  const d = calendarDate(def, s, l.month);
  const date = tr.t('ui.date.short', { year: d.year, num: d.number });
  const amt = durText(tr, l.amount, kind);
  if (l.kind === 'gift') {
    const who = personName(tr, s, l.by);
    return who ? tr.t('ui.tree.log.gift', { date, who, amt }) : tr.t('ui.tree.log.giftAnon', { date, amt });
  }
  return tr.t(`ui.tree.log.${l.kind}`, { date, amt });
}

/** 이어 가던 칸 이름을 굵게 보이려고 문장을 세 조각으로 (앞, 이름, 뒤) */
export function splitAround(text: string, name: string): [string, string, string] {
  const i = text.indexOf(name);
  return i < 0 ? [text, '', ''] : [text.slice(0, i), name, text.slice(i + name.length)];
}
