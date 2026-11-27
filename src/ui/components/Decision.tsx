// 결정 팝업의 내용 만들기 + 하단 결정 바 (화면 시안 Decide, 2026-11-24 3차 피드백)
// 엔진 상태(전략 후보, 사건, 남은 고기)를 팝업에 넣을 글과 카드로 바꾼다.
// 두 틀: 전략 틀(식량 줄 + 발전 줄 + 큰 일 한 줄)과 사건 틀(그림·본문·대사 + 선택지 한 줄).

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  crewSplit,
  currentEntry,
  currentPlace,
  eventText,
  findEvent,
  findPolicy,
  firewoodDays,
  foodDays,
  LEFTOVER_OPTIONS,
  leftoverAvailable,
  optionStatuses,
  previewPlan,
  resolveSceneSpec,
  techView,
  totalKg,
  type BoundPolicy,
  type CellView,
  type TechView,
  type ChapterDefinition,
  type PlanLabor,
  type PlanPreview,
  type Command,
  type GameState,
  type Hint,
  type PolicySlot,
  type SceneSpec,
} from '../../engine';
import type { Translator } from '../../i18n';
import { dateText, lineText, weatherSummary } from '../format';
import { useT } from '../i18n';
import { eventLead } from '../story';
import { cellName, costText, crewLine, crewWho, shortageText } from '../techText';

import { DecisionSheet, EventBody, PlanBody, PlanSteps, type Chip, type PlanStep, type Quote } from './DecisionSheet';
import c from './chrome.module.css';
import u from '../ui.module.css';

export interface Choice {
  id: string;
  title: string;
  /** 한 줄 설명 (전략은 policy.<id>.brief) */
  brief?: string;
  /** 긴 설명 (전략은 summary). 카드에는 없고 팝업 아래 줄에 보인다 */
  desc?: string;
  /** 대가 글 (긴 문장). 팝업 아래 줄의 "고른 전략의 대가" */
  cost?: string;
  /** 카드의 대가 한 줄 (사람 수 · 곳 · 식량 kg) */
  meta?: string;
  hint?: Hint;
  scene?: SceneSpec;
  disabled?: boolean;
  lockText?: string;
  /** 전략 칸 (전략 고르기에서만). 칸마다 하나씩 고른다 */
  group?: PolicySlot;
  /** 발전 나무 칸 전략이면 그 칸 (R2-b-2: 카드에 갈래·진척·여는 것) */
  cell?: CellView;
  /** 1년차 작은 발전의 "겨울 준비" 이름표 (§B3.6) */
  prep?: boolean;
  /** 이끄는 사람 이름 (식량 한 줄 "노을이 이끈다") */
  leader?: string;
  /** 칸 카드의 무리 줄: "1철 · 3명 · 바위 또는 이끼" / 비용을 이미 냈으면 짧게 "2명 · 노을 또는 버들" */
  cellCrew?: string;
  cellCrewShort?: string;
}

/** "발전하지 않는다" 카드의 id (엔진 후보가 아니다) */
export const NO_GROWTH = '__no_growth__';
/** 시작 비용이 모자라 흐리게 보이는 칸 카드의 id 앞머리 (엔진 후보가 아니다, 고를 수 없다) */
export const COST_PREFIX = '__cost_';

export interface PlanModel {
  command: (ids: string[]) => Command;
  /** 고를 수 없는 조합이면 이유 */
  check: (ids: string[]) => string | undefined;
  /** 고른 카드들의 일할 사람 (전체, 식량 무리, 발전 무리, 마을, 족장과 노인) */
  labor: (ids: string[]) => PlanLabor;
  /** 발전 카드의 대가 한 줄과 막힘 이유, 식량 대가 kg: 지금 고른 식량 전략 기준 */
  growthMeta: (foodId: string | undefined, growthId: string) => { meta: string; blocked?: string; kg?: number };
  /** 고른 발전 칸의 아래 줄 대가 글 (칸 전략만, R2-b-2): "가죽 6장 · 3명이 한 철 마을 일에서 빠진다 · 식량 약 −210kg · …" */
  growthFoot: (foodId: string | undefined, growthId: string) => string | undefined;
  /** 발전 나무 보기 (카드의 칸, 균형 규칙 한 줄, 숨은 칸 수) */
  tech: TechView;
  /** 처음부터 골라 둘 카드 (이어지는 공사) */
  initial: string[];
}

export interface DecisionModel {
  kind: 'policy' | 'event' | 'leftover';
  /** 결정을 구분하는 키 (바뀌면 고른 것을 지운다) */
  key: string;
  kicker: string;
  title: string;
  chips: Chip[];
  quotes: Quote[];
  intro?: { text: string; scene?: SceneSpec };
  /** 진행 화면에서 결정 직전에 먼저 보여 줄 문장 */
  lead?: string;
  choices: Choice[];
  command: (id: string) => Command;
  plan?: PlanModel;
}

const opt = (tr: Translator, key: string) => (tr.has(key) ? tr.t(key) : undefined);

function keyChips(tr: Translator, def: ChapterDefinition, s: GameState): Chip[] {
  const days = Math.floor(foodDays(def, s));
  const chips: Chip[] = [
    { text: tr.t('ui.chip.food', { kg: Math.round(totalKg(s.stores.food)), days }), tone: days < def.balance.ui.foodWarnDays ? 'warn' : 'normal', base: true },
    { text: tr.t('ui.chip.firewood', { kg: Math.round(s.stores.firewood) }), tone: firewoodDays(def, s) < def.balance.ui.firewoodWarnDays ? 'warn' : 'normal', base: true },
    { text: weatherSummary(tr, s), tone: 'normal', base: true },
  ];
  // 위험·기회 칩 (늑대 무리, 곰, 물고기 떼 등)은 기본 칩 뒤에. 넘치면 팝업 머리에서 "외 n개"로 접힌다
  for (const ch of s.work.brief?.chips ?? []) chips.push({ text: lineText(tr, ch), tone: ch.tone });
  return chips;
}

function kicker(tr: Translator, def: ChapterDefinition, s: GameState, slot?: string): string {
  const date = dateText(tr, def, s);
  return slot && slot !== 'briefing' ? tr.t('ui.kicker.slot', { date, slot: tr.t(`ui.step.${slot}`) }) : tr.t('ui.kicker', { date });
}

/** 함께 고를 수 없는 까닭 한 줄 (일할 사람 수, 이미 다른 전략을 맡은 사람) */
function planError(tr: Translator, s: GameState, pv: PlanPreview): string | undefined {
  const err = pv.error;
  if (!err) return undefined;
  const x = pv.errorParams ?? {};
  const person = typeof x['person'] === 'string' ? s.people[x['person']] : undefined;
  const params = {
    ...(typeof x['n'] === 'number' ? { n: x['n'] } : {}),
    ...(typeof x['need'] === 'number' ? { need: x['need'] } : {}),
    ...(typeof x['have'] === 'number' ? { have: x['have'] } : {}),
    ...(person ? { name: tr.label(person.name) } : {}),
    ...(typeof x['policy'] === 'string' ? { policy: tr.t(`policy.${x['policy']}.name`) } : {}),
  };
  // 마을에 남길 사람이 모자라면 숫자판 (R2-b-2: keepHome은 일할 사람 수 기준)
  const key = err === 'error.planLabor' && typeof x['need'] === 'number' ? 'ui.plan.error.planKeepHome' : `ui.plan.${err}`;
  return tr.t(tr.has(key) ? key : 'ui.plan.error', params);
}

/** 카드의 대가 한 줄: 사람 수 (원정이면 나가는 사람·남는 사람, 이끄는 사람) */
function crewMeta(tr: Translator, def: ChapterDefinition, s: GameState, cand: BoundPolicy): string {
  const p = findPolicy(def, cand.policyId);
  const leader = cand.leaderId ? s.people[cand.leaderId] : undefined;
  const split = crewSplit(def, s, cand);
  if (p.slot === 'growth') {
    const who = cand.crew.length > 0 ? tr.t('ui.plan.crewN', { n: cand.crew.length }) : leader ? tr.t('ui.plan.leaderOnly', { name: tr.label(leader.name) }) : '';
    const proj = p.builds ? tr.t('ui.plan.project', { done: (s.projects[p.builds.facility] ?? 0) + 1, months: p.builds.months }) : '';
    return [proj, who].filter(Boolean).join(' · ');
  }
  if (p.crew && !p.crew.atHome)
    // "남는 사람 3명 · 족장과 노인은 따로": 남는 사람은 일할 사람만 센다 (줄어든 숫자가 마을이 빈다는 뜻으로 읽히지 않게, R2-b-2)
    return [tr.t('ui.crew.expedition', { crew: split.crew, village: split.village }), tr.t('ui.crew.helpers'), leader ? tr.t('ui.crew.leader', { name: tr.label(leader.name) }) : ''].filter(Boolean).join(' · ');
  return tr.t('ui.crew.village', { village: split.village });
}

function policyModel(tr: Translator, def: ChapterDefinition, s: GameState): DecisionModel {
  const quotes: Quote[] = s.work.advice.map((a) => {
    const p = s.people[a.personId]!;
    return {
      key: a.personId,
      seat: p.advisor?.seat,
      name: tr.label(p.name),
      tag: p.advisor ? tr.t(`stance.${p.advisor.stance}`) : undefined,
      text: lineText(tr, a.line),
      ailing: p.ailments.length > 0,
    };
  });
  const cands = s.work.candidates;
  const slotOf = (uid: string) => {
    const c = cands.find((x) => x.uid === uid);
    return c ? findPolicy(def, c.policyId).slot : uid === NO_GROWTH ? 'growth' : undefined;
  };
  const real = (ids: string[]) => ids.filter((x) => x !== NO_GROWTH && !x.startsWith(COST_PREFIX));
  const firstFood = cands.find((c) => findPolicy(def, c.policyId).slot === 'food')?.uid;

  const tech = techView(def, s, (id) => tr.has(`tech.${id}.need`));
  const choices: Choice[] = cands.map((cand) => {
    const p = findPolicy(def, cand.policyId);
    const leader = cand.leaderId ? s.people[cand.leaderId] : undefined;
    const cell = p.tech ? tech.cells.find((c) => c.id === p.tech) : undefined;
    return {
      ...(cell
        ? {
            cell,
            cellCrew: crewLine(tr, s, cell, s.work.turn.kind),
            cellCrewShort: [cell.crew ? tr.t('ui.plan.crewN', { n: cell.crew.n }) : '', crewWho(tr, s, cell)].filter(Boolean).join(' · '),
          }
        : {}),
      ...(p.prep ? { prep: true } : {}),
      ...(leader ? { leader: tr.label(leader.name) } : {}),
      id: cand.uid,
      title: tr.t(`policy.${p.id}.name`),
      brief: opt(tr, `policy.${p.id}.brief`),
      desc: tr.t(`policy.${p.id}.summary`, {
        crew: cand.crew.length,
        ...(leader ? { leader: tr.label(leader.name) } : {}),
        ...((cand.place ?? p.place) ? { place: tr.t(`place.${cand.place ?? p.place}`) } : {}),
      }),
      cost: opt(tr, `policy.${p.id}.cost`),
      meta: crewMeta(tr, def, s, cand),
      hint: cand.hint,
      scene: resolveSceneSpec(def, s, p.scene, cand.place ?? p.place ?? s.campPlace, s.work.weather[0] ?? ''),
      group: p.slot,
    };
  });
  // 시작 비용이 모자란 칸: 숨기지 않고 흐린 카드로 (고를 수 없다, R2-b-2 검토). 엔진 후보가 아니다.
  // 1년차는 칸 자리가 한 장이라 그 칸이 자리에 올 칸일 때만 (techView가 그때만 cost 까닭을 준다), 카드가 넷을 넘지 않게
  const growthCount = () => choices.filter((x) => x.group === 'growth').length;
  for (const v of tech.cells) {
    if (v.hidden?.kind !== 'cost') continue;
    if (s.work.turn.kind === 'month' && growthCount() >= 3) continue;
    const cell = def.tech.cells.find((x) => x.id === v.id)!;
    choices.push({
      id: `${COST_PREFIX}${v.id}`,
      title: cellName(tr, v.id),
      group: 'growth',
      cell: v,
      cellCrew: crewLine(tr, s, v, s.work.turn.kind),
      cellCrewShort: [v.crew ? tr.t('ui.plan.crewN', { n: v.crew.n }) : '', crewWho(tr, s, v)].filter(Boolean).join(' · '),
      scene: resolveSceneSpec(def, s, cell.scene, s.campPlace, s.work.weather[0] ?? ''),
      disabled: true,
      lockText: shortageText(tr, v),
    });
  }
  choices.push({ id: NO_GROWTH, title: tr.t('ui.plan.noGrowth'), brief: tr.t('ui.plan.noGrowth.brief'), desc: tr.t('ui.plan.noGrowth.desc'), meta: tr.t('ui.plan.noGrowth.meta'), group: 'growth' });

  // 이어지는 공사는 처음부터 골라 둔다 (여러 달짜리 공사를 매달 다시 찾지 않게, §6.4.1.4)
  const going = cands.find((c) => {
    const p = findPolicy(def, c.policyId);
    return p.slot === 'growth' && p.builds && (s.projects[p.builds.facility] ?? 0) > 0;
  });

  return {
    kind: 'policy',
    key: `policy-${s.month}-${cands.map((c) => c.uid).join(',')}`,
    kicker: kicker(tr, def, s),
    title: tr.t('ui.sheet.policies'),
    chips: keyChips(tr, def, s),
    quotes,
    choices,
    command: (uid) => ({ type: 'choosePlan', uids: [uid] }),
    plan: {
      command: (ids) => ({ type: 'choosePlan', uids: real(ids) }),
      check: (ids) => planError(tr, s, previewPlan(def, s, real(ids))),
      labor: (ids) => previewPlan(def, s, real(ids)).labor,
      growthMeta: (foodId, growthId) => {
        const base = choices.find((x) => x.id === growthId)?.meta ?? '';
        if (growthId === NO_GROWTH) return { meta: base };
        // 비용이 모자란 칸: 막힘 이유 = 모자란 양
        if (growthId.startsWith(COST_PREFIX)) return { meta: base, blocked: choices.find((x) => x.id === growthId)?.lockText ?? '' };
        const food = foodId && slotOf(foodId) === 'food' ? foodId : firstFood;
        if (!food) return { meta: base };
        const pv = previewPlan(def, s, [food, growthId]);
        if (pv.error) return { meta: base, blocked: planError(tr, s, pv) };
        const kg = Math.round(pv.growthFoodCostKg / 10) * 10;
        return { meta: [base, kg > 0 ? tr.t('ui.plan.cost', { kg }) : tr.t('ui.plan.noCost')].filter(Boolean).join(' · '), kg };
      },
      growthFoot: (foodId, growthId) => {
        const ch = choices.find((x) => x.id === growthId);
        const v = ch?.cell;
        if (!v) return undefined;
        const food = foodId && slotOf(foodId) === 'food' ? foodId : firstFood;
        const pv = food ? previewPlan(def, s, [food, growthId]) : undefined;
        const kg = pv && !pv.error ? Math.round(pv.growthFoodCostKg / 10) * 10 : 0;
        const n = pv?.labor.growth ?? v.crew?.n ?? 0;
        return [
          v.costPaid ? '' : costText(tr, v),
          tr.t(`ui.plan.cellAway.${s.work.turn.kind}`, { n }),
          kg > 0 ? tr.t('ui.plan.cost', { kg }) : tr.t('ui.plan.noCost'),
          tech.continuing && tech.continuing !== v.id ? tr.t('ui.plan.driftFoot', { cell: cellName(tr, tech.continuing) }) : '',
        ]
          .filter(Boolean)
          .join(' · ');
      },
      tech,
      initial: going ? [going.uid] : [],
    },
  };
}

export function decisionModel(tr: Translator, def: ChapterDefinition, s: GameState): DecisionModel | undefined {
  const d = s.work.decision;
  if (s.step === 'policy') return policyModel(tr, def, s);
  if (s.step !== 'decision' || !d) return undefined;

  if (d.kind === 'leftover') {
    return {
      kind: 'leftover',
      key: d.uid,
      kicker: kicker(tr, def, s, 'late'),
      title: tr.t('leftover.title'),
      chips: keyChips(tr, def, s),
      quotes: [],
      intro: { text: tr.t('leftover.text', { kg: Math.round(d.kg) }) },
      choices: LEFTOVER_OPTIONS.map((id) => {
        const ok = leftoverAvailable(def, s, id);
        return {
          id,
          title: tr.t(`leftover.${id}`),
          cost: opt(tr, `leftover.${id}.cost`),
          disabled: !ok,
          lockText: ok ? undefined : tr.t(`leftover.${id}.lock`),
        };
      }),
      command: (optionId) => ({ type: 'chooseOption', uid: d.uid, optionId }),
    };
  }

  const ev = findEvent(def, d.eventId);
  const leaderId = currentEntry(s)?.bound.leaderId;
  const quotes: Quote[] = [];
  for (const sp of ev.speakers ?? []) {
    const who = sp.who;
    let id: string | undefined;
    if (who === 'leader') id = leaderId;
    else if (who === 'chief') id = Object.values(s.people).find((p) => p.alive && p.isChief)?.id;
    else if (typeof who === 'object' && 'seat' in who) id = Object.values(s.people).find((p) => p.alive && p.advisor?.seat === who.seat)?.id;
    else if (typeof who === 'object' && 'actor' in who) id = d.actors[who.actor];
    const p = id ? s.people[id] : undefined;
    if (!p || !p.alive) continue;
    quotes.push({ key: `${sp.line}-${p.id}`, seat: p.advisor?.seat, name: tr.label(p.name), text: tr.t(sp.line), ailing: p.ailments.length > 0 });
  }
  return {
    kind: 'event',
    key: d.uid,
    kicker: kicker(tr, def, s, d.slot),
    title: tr.t(`event.${ev.id}.title`),
    chips: keyChips(tr, def, s),
    quotes,
    intro: { text: lineText(tr, eventText(def, s, ev, d.actors)), scene: resolveSceneSpec(def, s, ev.scene, currentPlace(s) ?? s.campPlace, s.work.weather[1] ?? '') },
    lead: eventLead(tr, ev.id),
    choices: optionStatuses(def, s, ev, d.actors).map(({ option, available, hint }) => ({
      id: option.id,
      title: tr.t(`event.${ev.id}.opt.${option.id}`),
      cost: opt(tr, `event.${ev.id}.opt.${option.id}.cost`),
      hint,
      disabled: !available,
      lockText: available ? undefined : (opt(tr, `event.${ev.id}.opt.${option.id}.lock`) ?? tr.t('ui.sheet.locked')),
    })),
    command: (optionId) => ({ type: 'chooseOption', uid: d.uid, optionId }),
  };
}

/** 고른 카드 목록 갱신: 전략은 칸마다 하나 (큰 일은 혼자), 그 밖은 하나 */
export function togglePick(model: DecisionModel, prev: string[], ch: Choice): string[] {
  if (prev.includes(ch.id)) return prev.filter((x) => x !== ch.id);
  if (!model.plan || !ch.group) return [ch.id];
  const groupOf = (id: string) => model.choices.find((c) => c.id === id)?.group;
  const keep = prev.filter((id) => ch.group !== 'major' && groupOf(id) !== 'major' && groupOf(id) !== ch.group);
  return [...keep, ch.id];
}

interface PopupProps {
  model: DecisionModel;
  open: boolean;
  setOpen: (o: boolean) => void;
  send: (c: Command) => void;
  /** 하단 고정 결정 바를 보일까 (진행 화면은 자기 띠를 쓴다) */
  bar?: boolean;
}

/** 팝업 + 하단 결정 바. 고른 것과 전략의 단계는 팝업을 닫아도 남는다. 확정해야 다음으로 간다 */
export function DecisionPopup({ model, open, setOpen, send, bar = true }: PopupProps) {
  const tr = useT();
  const [picked, setPicked] = useState<string[]>(model.plan?.initial ?? []);
  // 전략 팝업의 단계: ① 식량(또는 큰 일) → ② 발전 (2026-11-25 4차 피드백)
  const [step, setStep] = useState<PlanStep>(1);
  // 결정이 바뀌면(새 달, 새 사건) 고른 것과 단계를 처음으로 되돌린다
  useEffect(() => {
    setPicked(model.plan?.initial ?? []);
    setStep(1);
  }, [model.key]);

  const byId = useMemo(() => new Map(model.choices.map((c) => [c.id, c])), [model]);
  const pickedFood = picked.find((id) => byId.get(id)?.group === 'food');
  const majorPicked = picked.some((id) => byId.get(id)?.group === 'major');

  // 발전 카드: 지금 고른 식량 전략 기준 대가와 막힘
  const growthInfo = useMemo(() => {
    const m = new Map<string, { meta: string; blocked?: string }>();
    if (!model.plan) return m;
    for (const ch of model.choices) if (ch.group === 'growth') m.set(ch.id, model.plan.growthMeta(pickedFood, ch.id));
    return m;
  }, [model, pickedFood]);

  // 고른 발전이 새로 고른 식량과 함께 못 가면 "발전하지 않는다"로 돌린다 (시안)
  useEffect(() => {
    const g = picked.find((id) => byId.get(id)?.group === 'growth');
    if (g && growthInfo.get(g)?.blocked) setPicked((prev) => [...prev.filter((x) => x !== g), NO_GROWTH]);
  }, [growthInfo, picked, byId]);

  const toggle = useCallback((ch: Choice) => setPicked((prev) => togglePick(model, prev, ch)), [model]);
  const pickedChoices = picked.map((id) => byId.get(id)).filter((c): c is Choice => !!c && !c.disabled);
  const ready = model.plan ? pickedChoices.some((c) => c.group === 'food' || c.group === 'major') : pickedChoices.length === 1;
  const error = model.plan && ready ? model.plan.check(pickedChoices.map((c) => c.id)) : undefined;
  const pickedTitle = pickedChoices.map((c) => c.title).join(tr.t('ui.phase.planJoin'));
  const confirm = useCallback(() => {
    if (!ready || error || !pickedChoices[0]) return;
    if (model.kind === 'policy') setOpen(false);
    send(model.plan ? model.plan.command(pickedChoices.map((c) => c.id)) : model.command(pickedChoices[0].id));
  }, [ready, error, pickedChoices, model, send, setOpen]);

  const isPolicy = model.kind === 'policy';
  const foodPicked = pickedChoices.some((c) => c.group === 'food');
  // ②단계로 갈 수 있는가: 식량을 골랐고 큰 일이 아니다
  const canGrowth = foodPicked && !majorPicked;
  // 전략 ①단계에서 식량을 골랐으면 "다음", 큰 일을 골랐으면 바로 "한 달을 시작한다"
  const nextStep = !!model.plan && step === 1 && !majorPicked;
  const goNext = useCallback(() => canGrowth && setStep(2), [canGrowth]);
  // 큰 일을 고르면 ②단계는 없다
  useEffect(() => {
    if (step === 2 && !canGrowth) setStep(1);
  }, [step, canGrowth]);

  // 키보드: 1~4 고르기(전략은 지금 단계의 카드, ①단계 0은 큰 일). Enter 다음/확정, Backspace 이전 단계
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (/^[0-9]$/.test(e.key)) {
        const n = Number(e.key);
        let ch: Choice | undefined;
        if (model.plan) {
          const food = model.choices.filter((c) => c.group === 'food');
          const growth = model.choices.filter((c) => c.group === 'growth');
          const major = model.choices.filter((c) => c.group === 'major');
          if (step === 1) ch = n === 0 ? major[0] : food[n - 1];
          else ch = n >= 1 ? growth[n - 1] : undefined;
        } else ch = n >= 1 ? model.choices[n - 1] : undefined;
        if (ch && !ch.disabled && !(ch.group === 'growth' && growthInfo.get(ch.id)?.blocked)) toggle(ch);
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        if (nextStep) goNext();
        else if (ready) confirm();
      } else if (e.key === 'Backspace' && model.plan && step === 2) {
        e.preventDefault();
        setStep(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, model, ready, confirm, toggle, growthInfo, step, nextStep, goNext]);

  const startLabel = isPolicy ? tr.t('ui.bar.start') : tr.t('ui.bar.confirm');

  // 아래 줄: 첫 줄은 고른 것, 둘째 줄은 고른 것의 대가 글 (또는 막힌 이유)
  // 전략 ①단계는 식량(큰 일)의 대가, ②단계는 발전의 대가
  const costOf = (() => {
    if (!model.plan) return pickedChoices[pickedChoices.length - 1];
    if (step === 1) return pickedChoices.find((c) => c.group === 'food' || c.group === 'major');
    return pickedChoices.find((c) => c.group === 'growth');
  })();
  const shownError = model.plan && step === 1 && !majorPicked ? undefined : error;
  // 발전 칸을 골랐으면 그 칸의 대가 글(비용 · 빠지는 사람 · 식량 kg · 이어 가던 칸), 그 밖은 전략의 대가 글
  const cellFoot = model.plan && step === 2 && costOf?.cell ? model.plan.growthFoot(pickedFood, costOf.id) : undefined;
  const costLine = shownError ?? cellFoot ?? (costOf?.cost ? tr.t(isPolicy ? 'ui.sheet.pickedCost' : 'ui.sheet.optionCost', { cost: costOf.cost }) : undefined);
  const summary = (() => {
    if (!isPolicy) return ready ? `${tr.t('ui.bar.pickedOption')}: ${pickedTitle}` : tr.t('ui.sheet.eventHint');
    if (!ready) return tr.t('ui.sheet.policyHint');
    if (majorPicked) return tr.t('ui.sheet.pickedMajor', { major: pickedChoices[0]!.title });
    const food = pickedChoices.find((c) => c.group === 'food');
    if (step === 1) return tr.t('ui.sheet.pickedFood', { food: food?.title ?? '' });
    const growth = pickedChoices.find((c) => c.group === 'growth');
    return tr.t('ui.sheet.pickedPlan', { food: food?.title ?? '', growth: growth?.title ?? tr.t('ui.plan.noGrowth') });
  })();

  const footButton = nextStep ? (
    canGrowth ? (
      <button type="button" className={u.btnPrimary} onClick={goNext}>
        {tr.t('ui.plan.next')}
      </button>
    ) : (
      <span className={u.btnDisabled} aria-disabled="true">
        {tr.t('ui.plan.next')}
      </span>
    )
  ) : ready && !error ? (
    <button type="button" className={u.btnPrimary} onClick={confirm}>
      {startLabel}
    </button>
  ) : (
    <span className={u.btnDisabled} aria-disabled="true">
      {startLabel}
    </span>
  );

  return (
    <>
      {bar && (
        <div className={c.bar}>
          {/* 전략은 ②단계까지 보았거나 큰 일을 골랐을 때만 바에서 바로 시작한다 */}
          {ready && !error && (!model.plan || majorPicked || step === 2) ? (
            <>
              <span className={c.barText}>
                {tr.t(isPolicy ? 'ui.bar.picked' : 'ui.bar.pickedOption')}: <b style={{ color: 'var(--accent)' }}>{pickedTitle}</b>
              </span>
              <div className={c.barButtons}>
                <button type="button" className={u.btnGhost} onClick={() => setOpen(true)}>
                  {tr.t('ui.bar.review')}
                </button>
                <button type="button" className={u.btnPrimary} onClick={confirm}>
                  {startLabel}
                </button>
              </div>
            </>
          ) : (
            <>
              <span className={c.barText}>
                {isPolicy ? tr.t('ui.bar.pending') : tr.t('ui.bar.eventPending')}
                {isPolicy && <span className={u.muted}> · {tr.t('ui.bar.slots')}</span>}
              </span>
              <button type="button" className={`${u.btnPrimary} ${u.call}`} onClick={() => setOpen(true)}>
                {isPolicy ? tr.t('ui.bar.open') : tr.t('ui.bar.decide')}
              </button>
            </>
          )}
        </div>
      )}

      <DecisionSheet
        open={open}
        onClose={() => setOpen(false)}
        kicker={model.kicker}
        title={model.title}
        chips={model.chips}
        steps={model.plan && <PlanSteps step={step} canGrowth={canGrowth} onStep={setStep} />}
        footer={
          <>
            <span className={c.footText}>
              <span className={c.footMain}>{summary}</span>
              {costLine && <span className={shownError ? c.footError : c.footSub}>{costLine}</span>}
            </span>
            {footButton}
          </>
        }
      >
        {model.plan ? (
          <PlanBody
            model={model}
            step={step}
            picked={picked}
            labor={model.plan.labor(picked)}
            growthInfo={growthInfo}
            majorPicked={majorPicked}
            onPick={toggle}
            onStep={setStep}
          />
        ) : (
          <EventBody model={model} picked={picked} onPick={toggle} />
        )}
      </DecisionSheet>
    </>
  );
}
