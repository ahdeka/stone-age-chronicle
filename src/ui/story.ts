// 진행 화면과 이달의 결과가 함께 쓰는 글 만들기 (React와 무관한 순수 함수라 따로 시험한다)
// - 문단: 같은 무리의 연속된 줄을 한 문단으로. 사건은 "사건 직전 문장"을 제목 문단으로 먼저 둔다
// - 한 줄 회고: 순마다 첫 문장 하나 (중순 사건은 사건 이름과 고른 것)
// - 장부 행의 이름과 순서

import { findPolicy, type ChapterDefinition, type GameState, type LedgerLine, type Line, type PhaseReport, type PolicyTemplate } from '../engine';
import type { Translator } from '../i18n';
import { lineText } from './format';

/** 문단의 첫 문장 (마침표·물음표·느낌표까지) */
export function firstSentence(text: string): string {
  const m = text.match(/^.*?[.?!…](?=\s|$)/u);
  return (m ? m[0] : text).trim();
}

/** 사건 직전 문장: event.<id>.lead가 있으면 그것, 없으면 본문 첫 문장 */
export function eventLead(tr: Translator, eventId: string): string {
  const key = `event.${eventId}.lead`;
  return tr.has(key) ? tr.t(key) : firstSentence(tr.t(`event.${eventId}.text`));
}

export interface Para {
  label?: string;
  text: string;
  /** 사건 직전 문장 문단 (결정 팝업 앞에 먼저 보인다) */
  lead?: boolean;
}

/** 이번 달 전략 (plan 순서: 주 전략이 먼저) */
export function planPolicies(def: ChapterDefinition, state: GameState): PolicyTemplate[] {
  return state.work.plan.map((e) => findPolicy(def, e.bound.policyId));
}

const eventIdOf = (l: Line) => (l.group === 'event' && l.key.startsWith('event.') && l.key.endsWith('.title') ? l.key.slice('event.'.length, -'.title'.length) : undefined);

/** 같은 무리의 연속된 줄을 한 문단으로. 사람 알림 줄은 따로 보여 준다 */
export function paragraphs(tr: Translator, def: ChapterDefinition, state: GameState, lines: readonly Line[]): Para[] {
  const out: (Para & { group?: string })[] = [];
  let cur: (Para & { group?: string }) | undefined;
  // 원정 무리의 이름표는 원정에 나간 전략의 것 (두 칸 중 원정인 쪽)
  const policy = planPolicies(def, state).find((p) => p.crew && !p.crew.atHome);
  for (const l of lines) {
    if (l.group === 'people') continue;
    const ev = eventIdOf(l);
    if (ev) {
      // 사건 제목 줄 → 사건 직전 문장 문단 (이름표는 사건 제목). 그 뒤 사건 줄은 새 문단으로
      out.push({ label: tr.t(l.key), text: eventLead(tr, ev), lead: true, group: 'event-lead' });
      cur = undefined;
      continue;
    }
    if (!cur || cur.group !== l.group) {
      const label =
        l.group === 'crew'
          ? policy && tr.has(`policy.${policy.id}.crewLabel`)
            ? tr.t(`policy.${policy.id}.crewLabel`)
            : tr.t('group.crew')
          : l.group === 'village'
            ? tr.t('group.village')
            : l.group === 'growth'
              ? tr.t('group.growth')
              : undefined;
      cur = { ...(label ? { label } : {}), text: '', ...(l.group ? { group: l.group } : {}) };
      out.push(cur);
    }
    const t = lineText(tr, l);
    cur.text = cur.text ? `${cur.text} ${t}` : t;
  }
  return out.filter((x) => x.text.length > 0).map(({ group: _g, ...p }) => p);
}

export interface Recap {
  slot: 'early' | 'mid' | 'late';
  text: string;
  /** 중순 사건에서 고른 것 */
  chose?: string;
}

/** 한 순의 한 줄 회고: 사건이 있으면 사건 직전 문장 + 고른 것, 없으면 첫 문단의 첫 문장 */
export function recapOf(tr: Translator, def: ChapterDefinition, state: GameState, r: PhaseReport): Recap | undefined {
  if (r.slot !== 'early' && r.slot !== 'mid' && r.slot !== 'late') return undefined;
  const paras = paragraphs(tr, def, state, r.lines);
  const chose = r.lines.find((l) => l.key === 'line.chose');
  const lead = paras.find((p) => p.lead);
  const first = lead ?? paras[0];
  const option = chose?.params?.['option'];
  return {
    slot: r.slot,
    text: first ? firstSentence(first.text) : '',
    ...(option !== undefined ? { chose: typeof option === 'object' ? tr.label(option) : String(option) } : {}),
  };
}

/** 이 장부 출처가 원정에 나간 전략인가 ("메고 온 고기"로 보인다) */
export function crewSourceTest(def: ChapterDefinition, state: GameState): (source: string) => boolean {
  const ids = new Set(planPolicies(def, state).filter((p) => p.crew && !p.crew.atHome).map((p) => `policy.${p.id}`));
  return (source) => ids.has(source);
}

export function rowLabel(tr: Translator, row: LedgerLine, isCrew: (source: string) => boolean): string {
  const s = row.source;
  if (s.startsWith('bonus.')) {
    const what = s.slice('bonus.'.length);
    return tr.t('row.bonus', { what: tr.has(what) ? tr.t(what) : tr.t('row.other') });
  }
  if (s.startsWith('catch.')) return tr.t(`row.${s}`, { n: row.params?.['n'] ?? 0 });
  if (s === 'upkeep.food') return tr.t('src.upkeep.food');
  if (s.startsWith('policy.')) return isCrew(s) && row.res === 'food' ? tr.t('row.carried') : tr.t(`${s}.name`);
  if (s.startsWith('event.')) return tr.t(`${s}.title`);
  const key = `row.${s}`;
  return tr.has(key) ? tr.t(key) : tr.t('row.other');
}

/** 장부 행 순서: 얻은 것(큰 것부터) → 쓴 것(큰 것부터). 0.5kg 미만은 뺀다 */
export function orderRows(rows: readonly LedgerLine[]): LedgerLine[] {
  const keep = rows.filter((r) => Math.abs(r.delta) >= 0.5);
  const gains = keep.filter((r) => r.delta > 0).sort((a, b) => b.delta - a.delta);
  const spends = keep.filter((r) => r.delta < 0).sort((a, b) => a.delta - b.delta);
  return [...gains, ...spends];
}

/** 묶이지 않는 장부 줄: 먹은 양(소비 줄) */
export const pinnedRow = (r: LedgerLine): boolean => r.source === 'upkeep.food';

/**
 * 행이 너무 많으면 양이 큰 것부터 남기고, 양이 작은 줄부터 "그 밖"으로 합친다 (스크롤 없는 화면).
 * pin에 맞는 줄(먹은 양)은 크기와 상관없이 늘 남는다. 줄 순서는 들어온 순서(크기 순) 그대로.
 */
export function foldRows(
  rows: readonly LedgerLine[],
  n: number,
  pin: (r: LedgerLine) => boolean = pinnedRow,
): { shown: LedgerLine[]; rest?: { delta: number; count: number } } {
  if (rows.length <= n) return { shown: [...rows] };
  const pinned = rows.filter(pin);
  const others = [...rows.filter((r) => !pin(r))].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const keep = new Set([...pinned, ...others.slice(0, Math.max(0, n - 1 - pinned.length))]);
  const shown = rows.filter((r) => keep.has(r));
  const tail = others.filter((r) => !keep.has(r));
  return { shown, rest: { delta: tail.reduce((a, r) => a + r.delta, 0), count: tail.length } };
}
