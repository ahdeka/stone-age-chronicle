// 결정 팝업의 내용 만들기 + 하단 결정 바 (화면 시안 TurnModal)
// 엔진 상태(방침 후보, 사건, 남은 고기)를 시트에 넣을 글과 카드로 바꾼다.

import { useCallback, useEffect, useState } from 'react';
import {
  crewSplit,
  findEvent,
  findPolicy,
  firewoodDays,
  foodDays,
  LEFTOVER_OPTIONS,
  leftoverAvailable,
  optionStatuses,
  resolveSceneSpec,
  totalKg,
  workers,
  type ChapterDefinition,
  type Command,
  type GameState,
  type Hint,
  type SceneSpec,
} from '../../engine';
import type { Translator } from '../../i18n';
import { dateText, lineText } from '../format';
import { useT } from '../i18n';
import { weatherSummary } from './TopBar';
import { ChoiceCard, DecisionSheet, type Chip, type Quote } from './DecisionSheet';
import { SceneView } from './SceneView';
import c from './chrome.module.css';
import d from './sheet.module.css';
import u from '../ui.module.css';

export interface Choice {
  id: string;
  title: string;
  desc?: string;
  cost?: string;
  crew?: string;
  hint?: Hint;
  scene?: SceneSpec;
  disabled?: boolean;
  lockText?: string;
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
  choices: Choice[];
  command: (id: string) => Command;
}

const opt = (tr: Translator, key: string) => (tr.has(key) ? tr.t(key) : undefined);

function keyChips(tr: Translator, def: ChapterDefinition, s: GameState): Chip[] {
  const days = Math.floor(foodDays(def, s));
  const chips: Chip[] = [
    { text: tr.t('ui.chip.food', { kg: Math.round(totalKg(s.stores.food)), days }), tone: days < def.balance.ui.foodWarnDays ? 'warn' : 'normal' },
    { text: tr.t('ui.chip.firewood', { kg: Math.round(s.stores.firewood) }), tone: firewoodDays(def, s) < def.balance.ui.firewoodWarnDays ? 'warn' : 'normal' },
    { text: tr.t('ui.chip.workers', { n: Math.round(workers(def, s)) }), tone: 'normal' },
    { text: weatherSummary(tr, s), tone: 'normal' },
  ];
  for (const ch of s.work.brief?.chips ?? []) chips.push({ text: lineText(tr, ch), tone: ch.tone });
  return chips;
}

function kicker(tr: Translator, def: ChapterDefinition, s: GameState, slot?: string): string {
  const date = dateText(tr, def, s);
  return slot && slot !== 'briefing' ? tr.t('ui.kicker.slot', { date, slot: tr.t(`ui.step.${slot}`) }) : tr.t('ui.kicker', { date });
}

export function decisionModel(tr: Translator, def: ChapterDefinition, s: GameState): DecisionModel | undefined {
  const d = s.work.decision;
  if (s.step === 'policy') {
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
    return {
      kind: 'policy',
      key: `policy-${s.month}-${s.work.candidates.map((c) => c.uid).join(',')}`,
      kicker: kicker(tr, def, s),
      title: tr.t('ui.sheet.policies'),
      chips: keyChips(tr, def, s),
      quotes,
      choices: s.work.candidates.map((cand) => {
        const p = findPolicy(def, cand.policyId);
        const leader = cand.leaderId ? s.people[cand.leaderId] : undefined;
        const split = crewSplit(def, s, cand);
        const crewText = p.crew
          ? [tr.t('ui.crew.expedition', { crew: split.crew, village: split.village }), leader ? tr.t('ui.crew.leader', { name: tr.label(leader.name) }) : '']
              .filter(Boolean)
              .join(' · ')
          : tr.t('ui.crew.village', { village: split.village });
        return {
          id: cand.uid,
          title: tr.t(`policy.${p.id}.name`),
          desc: tr.t(`policy.${p.id}.summary`, { crew: cand.crew.length, ...(leader ? { leader: tr.label(leader.name) } : {}) }),
          cost: opt(tr, `policy.${p.id}.cost`),
          crew: crewText,
          hint: cand.hint,
          scene: resolveSceneSpec(def, s, p.scene, p.place ?? s.campPlace, s.work.weather[0] ?? ''),
        };
      }),
      command: (uid) => ({ type: 'choosePolicy', uid }),
    };
  }
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
  const leaderId = s.work.chosen?.leaderId;
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
    intro: { text: tr.t(`event.${ev.id}.text`), scene: resolveSceneSpec(def, s, ev.scene, s.work.place ?? s.campPlace, s.work.weather[1] ?? '') },
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

interface PopupProps {
  model: DecisionModel;
  open: boolean;
  setOpen: (o: boolean) => void;
  send: (c: Command) => void;
}

/** 시트 + 하단 결정 바. 고른 것은 시트를 닫아도 남는다. 확정해야 다음으로 간다 */
export function DecisionPopup({ model, open, setOpen, send }: PopupProps) {
  const tr = useT();
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => setPicked(null), [model.key]);

  const pickedChoice = model.choices.find((c) => c.id === picked);
  const confirm = useCallback(() => {
    if (!pickedChoice || pickedChoice.disabled) return;
    setOpen(model.kind === 'policy' ? false : open);
    send(model.command(pickedChoice.id));
  }, [pickedChoice, model, send, setOpen, open]);

  // 키보드: 1~5 고르기, Enter 확정
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 5) {
        const c = model.choices[n - 1];
        if (c && !c.disabled) setPicked((p) => (p === c.id ? null : c.id));
      } else if (e.key === 'Enter' && pickedChoice && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        confirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, model, pickedChoice, confirm]);

  const isPolicy = model.kind === 'policy';
  const startLabel = isPolicy ? tr.t('ui.sheet.startWith') : tr.t('ui.bar.confirm');
  const pickedLabel = isPolicy ? tr.t('ui.bar.picked') : tr.t('ui.bar.pickedOption');

  return (
    <>
      <div className={c.bar}>
        {pickedChoice ? (
          <>
            <span className={c.barText}>
              {pickedLabel}: <b style={{ color: 'var(--accent)' }}>{pickedChoice.title}</b>
            </span>
            <div className={c.barButtons}>
              <button type="button" className={u.btnGhost} onClick={() => setOpen(true)}>
                {tr.t('ui.bar.review')}
              </button>
              <button type="button" className={u.btnPrimary} onClick={confirm}>
                {isPolicy ? tr.t('ui.bar.start') : tr.t('ui.bar.confirm')}
              </button>
            </div>
          </>
        ) : (
          <>
            <span className={c.barText}>
              {isPolicy ? tr.t('ui.bar.pending') : tr.t('ui.bar.eventPending')}{' '}
              {isPolicy && <span className={u.muted}>· {tr.t('ui.bar.count', { n: model.choices.length })}</span>}
            </span>
            <button type="button" className={`${u.btnPrimary} ${u.call}`} onClick={() => setOpen(true)}>
              {isPolicy ? tr.t('ui.bar.open') : tr.t('ui.bar.decide')}
            </button>
          </>
        )}
      </div>

      <DecisionSheet
        open={open}
        onClose={() => setOpen(false)}
        kicker={model.kicker}
        title={model.title}
        chips={model.chips}
        quotes={model.quotes}
        intro={
          model.intro && (
            <div className={d.event}>
              {model.intro.scene && (
                <div className={d.eventScene}>
                  <SceneView scene={model.intro.scene} />
                </div>
              )}
              <p className={`${d.eventText} ${u.serif}`}>{model.intro.text}</p>
            </div>
          )
        }
        footer={
          pickedChoice ? (
            <>
              <span className={c.barText}>
                {pickedLabel}: <b style={{ color: 'var(--accent)' }}>{pickedChoice.title}</b>
              </span>
              <button type="button" className={u.btnPrimary} onClick={confirm}>
                {startLabel}
              </button>
            </>
          ) : (
            <>
              <span className={u.muted} style={{ fontSize: 'var(--fs-md)' }}>
                {isPolicy ? tr.t('ui.sheet.policyHint') : tr.t('ui.sheet.eventHint')}
              </span>
              <span className={u.btnDisabled} aria-disabled="true">
                {isPolicy ? tr.t('ui.bar.start') : tr.t('ui.bar.confirm')}
              </span>
            </>
          )
        }
      >
        {model.choices.map((ch, i) => (
          <ChoiceCard
            key={ch.id}
            num={i + 1}
            title={ch.title}
            desc={ch.desc}
            cost={ch.cost}
            crew={ch.crew}
            hint={ch.hint}
            scene={ch.scene}
            selected={picked === ch.id}
            disabled={ch.disabled}
            lockText={ch.lockText}
            onPick={() => setPicked((p) => (p === ch.id ? null : ch.id))}
          />
        ))}
      </DecisionSheet>
    </>
  );
}
