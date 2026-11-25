// 월초 상황 화면 (화면 시안 Situation, 2026-11-24 3차 피드백). 스크롤을 허용하는 유일한 진행 화면이다.
// 순서: 지표 바 → 그림(높이 약 240) → 그림 아래 소식 → 사람들 → 옆줄(시대 목표, 아직 남은 일, 부족의 기록) → 맨 아래 땅.
// 사람들은 주요 인물 4명과 성인·노인·아이 비율, 일손·아픈 사람·다친 사람 수, 거처만 보인다.
// 부족원 개인 기록(이름·나이·건강)은 엔진에만 둔다 (이름 있는 죽음·부상 서술에 쓴다).
// 결정은 결정 팝업에서 한다. 월초에는 저절로 열지 않고(2026-11-25 4차 피드백, 설정으로 켤 수 있다)
// 아래 "전략 정하기" 버튼이 맥박 움직임으로 눈에 띈다.

import { useEffect, useMemo, useRef, useState } from 'react';
import { band, countBand, goalProgress, laborUnits, living, totalKg, type ChapterDefinition, type Command, type GameState, type LandIcon } from '../../engine';
import type { Translator } from '../../i18n';
import { Caret } from '../components/bits';
import { decisionModel, DecisionPopup } from '../components/Decision';
import { Portrait, SceneView } from '../components/SceneView';
import { StatusBar } from '../components/StatusBar';
import { lineText, shortDateText } from '../format';
import { typedLines, typeSchedule, useClock } from '../hooks/useClock';
import { useInView } from '../hooks/useInView';
import { useT } from '../i18n';
import { useMotion } from '../motion';
import v from './situation.module.css';
import u from '../ui.module.css';

interface Props {
  def: ChapterDefinition;
  state: GameState;
  send: (c: Command) => void;
}

export function SituationScreen({ def, state, send }: Props) {
  const tr = useT();
  const { mul, settings } = useMotion();
  const brief = state.work.brief;
  const news = useMemo(() => (brief?.news ?? []).map((l) => lineText(tr, l)), [brief, tr]);
  // 월초 소식 타이핑은 예전 속도 그대로 (새 속도 표는 진행 화면에만, timing.ts)
  const sched = useMemo(() => typeSchedule(news, { startAt: 700 * mul, perChar: 32 * mul, gap: 500 * mul }), [news, mul]);
  // 소식 타이핑은 소식 글(바로 위의 머리글로 잰다)이 화면에 보일 때 시작한다
  const newsRef = useRef<HTMLHeadingElement>(null);
  const newsSeen = useInView(newsRef, state.month);
  const clock = useClock(sched.end, `brief-${state.month}`, { hold: !newsSeen });
  const typed = typedLines(news, sched, clock.elapsed, 32 * mul);

  const model = decisionModel(tr, def, state);
  const [open, setOpen] = useState(false);
  const [autoDone, setAutoDone] = useState<number | null>(null);
  useEffect(() => {
    if (clock.done && settings.autoOpenPlan && autoDone !== state.month && model) {
      setOpen(true);
      setAutoDone(state.month);
    }
  }, [clock.done, settings.autoOpenPlan, autoDone, state.month, model]);

  return (
    <div className={v.page}>
      <StatusBar def={def} state={state} mode="live" />
      <div className={v.layout}>
        <main className={v.main}>
          <section className={`${v.hero} ${u.in} ${u.d1}`} onClick={clock.skip}>
            <div className={v.heroScene}>{brief && <SceneView scene={brief.scene} />}</div>
            <div className={v.heroText}>
              <span className={u.label}>{tr.t('ui.briefingLabel')}</span>
              <h1 ref={newsRef} className={`${v.headline} ${u.serif}`}>
                {brief ? lineText(tr, brief.headline) : ''}
              </h1>
              <div className={`${v.news} ${u.serif}`} aria-live="polite">
                {typed.map((l, i) => (
                  <p key={i}>
                    {l.text}
                    {l.typing && <Caret />}
                  </p>
                ))}
              </div>
              {/* 화면 읽기 프로그램에는 소식 전체를 바로 준다 */}
              <div className="visually-hidden">{news.join(' ')}</div>
            </div>
          </section>
          <PeopleCard def={def} state={state} />
        </main>
        <aside className={v.side}>
          <GoalsCard def={def} state={state} />
          <MemoryCard def={def} state={state} />
          <ChronicleCard def={def} state={state} />
        </aside>
        <LandCard def={def} state={state} />
      </div>
      {model && <DecisionPopup model={model} open={open} setOpen={setOpen} send={send} />}
    </div>
  );
}

/** 땅 정보의 선 아이콘 (화면 시안 Situation의 SVG, 이모지 금지) */
const LAND_ICONS: Record<LandIcon, string[]> = {
  terrain: ['M2 19 L8.5 9 L12 14 L15 10 L22 19 Z', 'M7 11.3 L8.5 9 L10 11.3'],
  climate: ['M9 5.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z', 'M9 2.5v1.5M9 14v1.5M2.5 9H4M3.9 3.9l1 1M13.1 4.9l1-1', 'M17 13v8M13.5 15l7 4M20.5 15l-7 4'],
  rain: ['M6.5 14.5a4 4 0 0 1 .6-8 5 5 0 0 1 9.6 1.4 3.3 3.3 0 0 1-.2 6.6Z', 'M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5'],
  river: ['M2 8c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0', 'M2 13c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0', 'M2 18c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0'],
  soil: ['M3 8h18M3 13h18M3 18h18', 'M6 10.5h.01M11 10.5h.01M16 15.5h.01M8 15.5h.01M18 10.5h.01'],
  danger: ['M12 3.5 L21.5 20 H2.5 Z', 'M12 10v4.5M12 17.2v.01'],
};

function LandCard({ def, state }: { def: ChapterDefinition; state: GameState }) {
  const tr = useT();
  const preset = def.presets.find((p) => p.id === state.presetId) ?? def.presets[0]!;
  const land = preset.presentation.land;
  return (
    <section className={`${u.card} ${v.land} ${u.in} ${u.d4}`}>
      <div className={v.cardHead}>
        <h2 className={u.h2}>{tr.t(land.title)}</h2>
        <span className={`${u.muted} ${u.small}`}>{tr.t(land.subtitle)}</span>
      </div>
      <p className={`${v.landIntro} ${u.serif}`}>{tr.t(land.intro)}</p>
      <div className={v.facts}>
        {land.facts.map((f) => (
          <div key={f.label} className={`${v.fact} ${f.tone === 'warn' ? v.factWarn : ''}`}>
            <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true" className={v.factIcon}>
              {LAND_ICONS[f.icon].map((d) => (
                <path key={d} className={u.icon} d={d} />
              ))}
            </svg>
            <div className={v.factText}>
              <span className={v.factLabel}>{tr.t(f.label)}</span>
              <span className={v.factValue}>{tr.t(f.value)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PeopleCard({ def, state }: { def: ChapterDefinition; state: GameState }) {
  const tr = useT();
  const people = living(state);
  const advisors = people.filter((p) => p.advisor).slice(0, 4);
  const advice = new Map(state.work.advice.map((a) => [a.personId, lineText(tr, a.line)]));
  const start = state.work.start;
  const adults = countBand(def, state, 'adult');
  const elders = countBand(def, state, 'elder');
  const children = countBand(def, state, 'child');
  const total = Math.max(1, adults + elders + children);
  const working = (b: 'adult' | 'elder') => people.filter((p) => band(def, state, p) === b && laborUnits(def, state, p) > 0).length;
  // 아픈 사람의 병 이름 (서로 다른 것만)
  const kinds = [...new Set(people.flatMap((p) => p.ailments.map((a) => a.kind)))].map((k) => tr.t(`ailment.${k}`));
  return (
    <section className={`${u.card} ${u.in} ${u.d2}`}>
      <div className={v.cardHead}>
        <h2 className={u.h2}>{tr.t('ui.people.title')}</h2>
        <span className={`${u.muted} ${u.small}`}>
          {tr.t('ui.people.line', {
            workers: start.workers,
            sick: start.sick,
            injured: start.injured,
            shelter: tr.t(`shelter.${state.shelter.kind}`),
            units: state.shelter.units,
            hides: state.stores.goods['hide'] ?? 0,
          })}
        </span>
      </div>
      <div className={v.people}>
        {advisors.map((p) => {
          const elder = band(def, state, p) === 'elder';
          const health = p.ailments.length > 0 ? p.ailments.map((a) => tr.t(`ailment.${a.kind}`)).join(', ') : tr.t('ui.state.healthy');
          const line = advice.get(p.id);
          return (
            <div key={p.id} className={v.person}>
              <Portrait seat={p.advisor?.seat} ailing={p.ailments.length > 0} label={tr.label(p.name)} />
              <div className={v.personText}>
                <span className={v.personName}>
                  <b>{tr.label(p.name)}</b> <span className={v.personRole}>{tr.t(`seat.${p.advisor!.seat}`)}</span>
                </span>
                <span className={v.personState}>
                  {elder ? `${tr.t('ui.state.elder')} · ` : ''}
                  {health}
                </span>
                {line && <span className={`${v.personLine} ${u.serif}`}>“{line}”</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className={v.mix}>
        <div className={v.mixBar} aria-hidden="true">
          <div className={v.mixAdult} style={{ width: `${(adults / total) * 100}%` }} />
          <div className={v.mixElder} style={{ width: `${(elders / total) * 100}%` }} />
          <div className={v.mixChild} style={{ width: `${(children / total) * 100}%` }} />
        </div>
        <div className={v.mixText}>
          <span>
            <b className={v.inkAdult}>{tr.t('ui.people.adults', { n: adults })}</b> {tr.t('ui.people.adultsWork', { n: working('adult') })}
          </span>
          <span>
            <b className={v.inkElder}>{tr.t('ui.people.elders', { n: elders })}</b> {tr.t('ui.people.eldersWork', { n: working('elder') })}
          </span>
          <span>
            <b className={v.inkChild}>{tr.t('ui.people.children', { n: children })}</b>
          </span>
          {kinds.length > 0 && <span className={v.inkWarn}>{tr.t('ui.people.ailments', { n: start.sick + start.injured, what: kinds.join(', ') })}</span>}
        </div>
      </div>
    </section>
  );
}

function GoalsCard({ def, state }: { def: ChapterDefinition; state: GameState }) {
  const tr = useT();
  const goals = goalProgress(def, state);
  return (
    <section className={`${u.cardSm} ${u.in} ${u.d2}`}>
      <h2 className={u.h2accent}>{tr.t('goals.era')}</h2>
      {goals.map((g) => (
        <div key={g.id} className={v.goal}>
          <div className={v.goalHead}>
            <b>{tr.t(`goal.${g.id}`)}</b>
            <span className={u.muted}>{g.pct === null ? '—' : `${Math.round(g.pct * 100)}%`}</span>
          </div>
          <div className={v.bar} aria-hidden="true">
            <div className={v.barFill} style={{ width: `${Math.round((g.pct ?? 0) * 100)}%` }} />
          </div>
          <span className={v.paths}>
            {g.paths.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ' · '}
                <span className={p.pct === null ? v.unmeasured : undefined} title={p.pct === null ? tr.t('ui.goal.unmeasured') : `${Math.round(p.pct * 100)}%`}>
                  {tr.t(`goal.${g.id}.${p.id}`)}
                  {p.pct === null && <span className="visually-hidden"> ({tr.t('ui.goal.unmeasured')})</span>}
                </span>
              </span>
            ))}
          </span>
        </div>
      ))}
    </section>
  );
}

/** "아직 남은 일": 묻어 둔 고기, 기다리는 손님, 단서 (이달의 결과에도 한 줄로 보인다) */
export function memoryItems(tr: Translator, def: ChapterDefinition, state: GameState): string[] {
  const stale = def.balance.cache.staleAfterMonths;
  const items: string[] = [];
  for (const c of state.caches) {
    items.push(
      state.month - c.checkedMonth < stale
        ? tr.t('brief.cache.known', { place: tr.t(`place.${c.place}`), kg: Math.round(totalKg(c.lots)) })
        : tr.t('brief.cache.unknown', { place: tr.t(`place.${c.place}`) }),
    );
  }
  for (const x of state.scheduled) if (tr.has(`event.${x.event}.memo`)) items.push(tr.t(`event.${x.event}.memo`));
  for (const c of state.clues) items.push(tr.t(`clue.${c.id}`));
  return items;
}

function MemoryCard({ def, state }: { def: ChapterDefinition; state: GameState }) {
  const tr = useT();
  const items = memoryItems(tr, def, state);
  return (
    <section className={`${u.cardSm} ${u.in} ${u.d3}`}>
      <h2 className={u.h2accent}>{tr.t('ui.memory')}</h2>
      {items.length === 0 ? (
        <p className={`${v.memoryEmpty} ${u.muted}`}>{tr.t('ui.memory.empty')}</p>
      ) : (
        <ul className={v.memory}>
          {items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ChronicleCard({ def, state }: { def: ChapterDefinition; state: GameState }) {
  const tr = useT();
  const entries = state.chronicle.slice(-4).reverse();
  return (
    <section className={`${u.cardSm} ${u.in} ${u.d4}`}>
      <h2 className={u.h2accent}>{tr.t('ui.chronicle')}</h2>
      {entries.map((c, i) => (
        <p key={i} className={`${v.chron} ${u.serif}`}>
          <span className={v.chronMonth}>{tr.t('ui.chronicle.month', { date: shortDateText(tr, def, state, c.month) })}</span> {lineText(tr, c)}
        </p>
      ))}
    </section>
  );
}
