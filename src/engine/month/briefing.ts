// 월초 보고 만들기 (DESIGN.md §4.1, 화면 시안 TurnModal의 상황 화면)
// 머리글, 이번 달 소식, 결정 팝업의 상황 칩, 월초 장면을 데이터 규칙에서 고른다.

import type { Briefing, ChapterDefinition, GameState, Id, SceneSpec } from '../types';
import { allTrue } from '../conditions/evaluate';
import { byId, findPlace, monthDef } from '../core/lookup';

/** 장면의 자리표시자를 채운다: {place} 방침 장소, {camp} 거처, {weather} 날씨 덮개 */
export function resolveSceneSpec(def: ChapterDefinition, state: GameState, spec: SceneSpec, placeId: Id, weatherId: Id): SceneSpec {
  const overlay = spec.overlay === '{weather}' ? (weatherId ? byId(def.weather, weatherId, 'weather').overlay : undefined) : spec.overlay;
  const bg = spec.bg === '{place}' ? findPlace(def, placeId).scene : spec.bg === '{camp}' ? findPlace(def, state.campPlace).scene : spec.bg;
  return { bg, ...(spec.subjects ? { subjects: spec.subjects } : {}), ...(overlay ? { overlay } : {}) };
}

export function buildBriefing(def: ChapterDefinition, state: GameState): Briefing {
  const r = def.briefing;
  const ok = (when: Parameters<typeof allTrue>[2]) => allTrue(def, state, when);

  const head = r.headlines.find((h) => ok(h.when));
  const headline = { key: head ? head.key : `brief.headline.${monthDef(def, state).season}`, group: 'info' as const };

  const matched = r.news.map((n, i) => ({ n, i })).filter(({ n }) => ok(n.when));
  matched.sort((a, b) => b.n.priority - a.n.priority || a.i - b.i);
  const top = matched.slice(0, def.balance.ui.maxNews);
  const news = top.map(({ n }) => ({ key: n.key, group: 'info' as const }));
  if (news.length === 0) news.push({ key: 'brief.news.quiet', group: 'info' });

  const chips: Briefing['chips'] = [];
  for (const { n } of matched) if (n.chip) chips.push({ key: n.chip, tone: n.tone ?? 'normal' });
  for (const c of r.chips) if (ok(c.when)) chips.push({ key: c.key, tone: c.tone });

  const spec = r.scenes.find((s) => ok(s.when))?.scene ?? def.scenes.briefing;
  const scene = resolveSceneSpec(def, state, spec, state.campPlace, state.work.weather[1] ?? '');
  return { headline, news, chips, scene };
}
