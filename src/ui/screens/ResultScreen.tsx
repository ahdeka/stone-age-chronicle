// 이달의 결과 (화면 시안 Result, 2026-11-24 3차 피드백). 평온한 달 요약 화면을 대신한다.
// 순별 한 줄 회고(중순 사건은 고른 것), 발전 칸 한 줄("나무", 나무 판 링크), 결과 등급, 덕분에, 사람 변화, 식량 장부(시작 → 얻은 것 → 쓴 것),
// 장작 장부 한 줄, 장부 맨 아래 "이달 말" 상자(식량·장작 최종 + 이달 바뀐 물자·인구), 아직 남은 일, 연대기 한 줄, "다음 달로".
// 수치는 이 화면에서만 보인다.

import { useEffect } from 'react';
import { foodDays, population, totalKg, type Alert, type ChapterDefinition, type GameState, type LedgerLine, type PhaseReport, type Tier } from '../../engine';
import { StatusBar, StepTrail } from '../components/StatusBar';
import { lineText, resName, stepLabel } from '../format';
import { useT } from '../i18n';
import { crewSourceTest, foldRows, orderRows, recapOf, rowLabel, techSummary } from '../story';
import { useTree } from '../tree';
import { memoryItems } from './SituationScreen';
import r from './result.module.css';
import u from '../ui.module.css';

interface Props {
  def: ChapterDefinition;
  state: GameState;
  onNext: () => void;
}

/** 한 칸에 보일 장부 행 수 (얻은 것, 쓴 것 각각) */
const MAX_ROWS = 4;
/** 식량 장부의 얻은 것 + 쓴 것 줄 수 상한 (최종 상자가 커져서, 2026-11-25 5차 피드백) */
const MAX_LEDGER_ROWS = 7;
/** 사람 칸에 보일 사람 수 */
const MAX_PEOPLE = 3;
/** 머리 등급 배지: 이달의 일을 가장 잘 말해 주는 것 (큰 실패와 대가 있는 성공이 먼저) */
const TIER_ORDER: Tier[] = ['disaster', 'costly', 'failure', 'triumph', 'success'];

const kg = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}kg`;
const signed = (n: number) => (Math.round(n) === 0 ? '±0' : `${n > 0 ? '+' : '−'}${Math.round(Math.abs(n)).toLocaleString('ko-KR')}`);

/** 이번 달 사람에게 일어난 일: 사람마다 마지막 일 하나 (죽음이 있으면 죽음) */
export function peopleChanges(reports: readonly PhaseReport[]): Alert[] {
  const by = new Map<string, Alert>();
  for (const rep of reports)
    for (const a of rep.alerts) {
      const prev = by.get(a.personId);
      if (prev?.kind === 'death') continue;
      by.set(a.personId, a);
    }
  // 죽음 → 다침·병 → 회복 순
  const rank = { death: 0, injury: 1, sick: 1, healed: 2 } as const;
  return [...by.values()].sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/** 최종 칸의 증감 색: 늘면 초록, 줄면 경고색 */
const deltaClass = (n: number) => (Math.round(n) > 0 ? r.up : Math.round(n) < 0 ? r.down : r.muted);

export function ResultScreen({ def, state, onNext }: Props) {
  const tr = useT();
  const reports = state.work.reports;
  const season = state.work.turn.kind === 'season';
  const settle = reports.find((x) => x.slot === 'settlement');
  const recaps = reports.map((x) => recapOf(tr, def, state, x)).filter((x): x is NonNullable<typeof x> => !!x);
  // 정산 줄 중 글로 보일 것 (두고 온 고기, 새 기술): settle.* 표 줄은 빼고.
  // 발전 칸의 켜짐·진척은 "나무" 한 줄로 모으고 나무 판으로 가는 링크를 붙인다 (R2-c-1)
  const settleLines = (settle?.lines ?? []).filter((l) => l.key.startsWith('line.'));
  const notes = settleLines.filter((l) => !l.key.startsWith('line.tech.'));
  const techLine = techSummary(tr, settleLines);
  const tree = useTree();
  const tiers = reports.map((x) => x.tier).filter((t): t is Tier => !!t);
  const tier = TIER_ORDER.find((t) => tiers.includes(t));
  const isCrew = crewSourceTest(def, state);
  const rows = settle?.rows ?? [];

  // 식량 장부
  // 덕분에 줄(bonus.*)도 장부 행이다 (합 = 식량 변화). 덕분에 칸에도 따로 보인다
  const foodRows = orderRows(rows.filter((x) => x.res === 'food'));
  const gains = foldRows(
    foodRows.filter((x) => x.delta > 0),
    MAX_ROWS,
  );
  // 이달 말 상자: 식량·장작 + 이달 바뀐 물자와 인구 (2026-11-25 5차 피드백 2차)
  const goodsChange = new Map<string, number>();
  for (const x of rows) if (x.res !== 'food' && x.res !== 'firewood') goodsChange.set(x.res, (goodsChange.get(x.res) ?? 0) + x.delta);
  const goodsEnd = [...goodsChange].filter(([, d]) => Math.round(d) !== 0);
  const popFrom = state.work.start.population;
  const popTo = population(state);
  // 물자가 둘 이상 바뀌면 한 줄("물자 가죽 −3 · 그물 +1")로 합친다 → 상자는 많아야 4줄
  const extraEnd = (goodsEnd.length > 0 ? 1 : 0) + (popTo !== popFrom ? 1 : 0);
  // 얻은 것·쓴 것을 합쳐 MAX_LEDGER_ROWS줄까지, 이달 말 상자의 줄이 늘면 그만큼 줄인다 (1366×650에서 장부 칸이 넘치지 않게)
  const spends = foldRows(
    foodRows.filter((x) => x.delta < 0),
    Math.max(2, Math.min(MAX_ROWS, MAX_LEDGER_ROWS - extraEnd - gains.shown.length - (gains.rest ? 1 : 0))),
  );
  const bonus = rows.filter((x) => x.source.startsWith('bonus.') && Math.abs(x.delta) >= 0.5);
  const foodFrom = settle?.from.food ?? state.work.start.food;
  const foodTo = settle?.to?.food ?? totalKg(state.stores.food);
  const days = Math.floor(foodDays(def, state));
  const woodRows = rows.filter((x) => x.res === 'firewood');
  const woodIn = woodRows.filter((x) => x.delta > 0).reduce((a, x) => a + x.delta, 0);
  const woodOut = woodRows.filter((x) => x.delta < 0).reduce((a, x) => a + x.delta, 0);
  const woodFrom = settle?.from.firewood ?? state.work.start.firewood;
  const woodTo = settle?.to?.firewood ?? state.stores.firewood;

  // 덕분에: 덕분에 늘어난 몫(장부) + 아낀 양
  const thanks: string[] = [
    ...bonus.map((x) => tr.t('ui.result.bonus', { what: rowLabel(tr, x, isCrew), kg: Math.round(x.delta) })),
    ...(settle?.savings ?? [])
      .filter((x) => x.kg >= 0.5)
      .map((x) => tr.t(`ui.result.saving.${x.res === 'firewood' ? 'firewood' : 'food'}`, { what: tr.has(x.source) ? tr.t(x.source) : tr.t('row.other'), kg: Math.round(x.kg) })),
  ];

  const people = peopleChanges(reports);
  const shownPeople = people.slice(0, MAX_PEOPLE);
  const memory = memoryItems(tr, def, state);
  const chronicle = state.chronicle.filter((c) => c.month === state.month).at(-1);
  const ended = state.step === 'ended';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      if (e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNext]);

  const ledgerRow = (x: LedgerLine) => (
    <div key={`${x.source}-${x.delta > 0}`} className={r.row}>
      <span>{rowLabel(tr, x, isCrew)}</span>
      <span className={x.delta > 0 ? r.up : r.down}>{signed(x.delta)}kg</span>
    </div>
  );
  const restRow = (rest: { delta: number; count: number } | undefined) =>
    rest && (
      <div className={r.row}>
        <span>{tr.t('ui.result.rest', { n: rest.count })}</span>
        <span className={rest.delta > 0 ? r.up : r.down}>{signed(rest.delta)}kg</span>
      </div>
    );

  // 이달 말 상자의 한 줄: 이름 | 값(· 며칠치) | 증감. 조금 큰 굵은 글씨 (2026-11-25 5차 피드백)
  const endRow = (key: string, name: string, value: string, days: string | undefined, change: number) => (
    <div key={key} className={r.endRow} data-end={key}>
      <span className={r.endName}>{name}</span>
      <span className={r.endValue}>
        {value}
        {days && <span className={r.endDays}>{` · ${days}`}</span>}
      </span>
      <span className={`${r.endDelta} ${deltaClass(change)}`}>{signed(change)}</span>
    </div>
  );
  const unit = (id: string, n: number) => tr.t(tr.has(`unit.${id}`) ? `unit.${id}` : 'ui.result.amount', { n: Math.round(n) });

  return (
    <div className={r.page}>
      <StatusBar def={def} state={state} mode="result">
        <StepTrail now="settlement" season={season} />
      </StatusBar>

      <div className={r.body} data-fit="result">
        <div className={`${r.titleRow} ${u.in}`}>
          <h1 className={`${r.title} ${u.serif}`}>{tr.t(season ? 'ui.result.title.season' : 'ui.result.title')}</h1>
          {tier && <span className={`${r.tier} ${r[tier]}`}>{tr.t(`tier.${tier}`)}</span>}
        </div>

        <div className={r.cols}>
        <section className={`${r.main} ${u.in}`}>
          <ol className={`${r.recaps} ${season ? r.recapsSeason : ''}`}>
            {recaps.map((x) => (
              <li key={x.slot} className={r.recap}>
                <span className={r.recapLabel}>{stepLabel(tr, state, x.slot)}</span>
                <span className={`${r.recapText} ${u.serif}`}>
                  {x.text}
                  {x.chose && <span className={r.chose}> · {tr.t('ui.result.chose', { option: x.chose })}</span>}
                </span>
              </li>
            ))}
            {notes.map((l, i) => (
              <li key={`note-${i}`} className={r.recap}>
                <span className={r.recapLabel}>{tr.t(season ? 'ui.result.note.season' : 'ui.result.note')}</span>
                <span className={`${r.recapText} ${u.serif}`}>{lineText(tr, l)}</span>
              </li>
            ))}
            {techLine && (
              <li className={`${r.recap} ${r.treeRow}`} data-result="tree">
                <span className={r.recapLabel}>{tr.t('ui.result.tree')}</span>
                <span className={r.treeText}>{techLine.text}</span>
                {tree && (
                  <button type="button" className={r.treeLink} onClick={() => tree.open(techLine.focus)}>
                    {tr.t('ui.result.tree.open')} (T)
                  </button>
                )}
              </li>
            )}
          </ol>

          <div className={r.boxes}>
            <div className={`${r.box} ${r.good}`}>
              <span className={r.boxTitle}>{tr.t('ui.result.thanks')}</span>
              {thanks.length > 0 ? thanks.slice(0, 3).map((t) => <span key={t} className={r.boxLine}>{t}</span>) : <span className={`${r.boxLine} ${r.empty}`}>{tr.t('ui.result.thanks.none')}</span>}
            </div>
            <div className={`${r.box} ${people.some((a) => a.kind !== 'healed') ? r.bad : ''}`}>
              <span className={r.boxTitle}>{tr.t('ui.result.people')}</span>
              {shownPeople.length > 0 ? (
                shownPeople.map((a) => {
                  const person = state.people[a.personId];
                  const name = person ? tr.label(person.name) : '';
                  const what = a.kind === 'death' ? tr.t(`cause.${a.what}`) : tr.t(`ailment.${a.what}`);
                  const effect = a.kind === 'injury' || a.kind === 'sick' ? (tr.has(`ailment.${a.what}.effect`) ? tr.t(`ailment.${a.what}.effect`) : '') : '';
                  return (
                    <span key={a.personId} className={r.boxLine}>
                      {tr.t(`ui.result.person.${a.kind}`, { name, what })}
                      {effect && <span className={r.muted}> · {effect}</span>}
                    </span>
                  );
                })
              ) : (
                <span className={`${r.boxLine} ${r.empty}`}>{tr.t('ui.result.people.none')}</span>
              )}
              {people.length > MAX_PEOPLE && <span className={r.muted}>{tr.t('ui.result.people.more', { n: people.length - MAX_PEOPLE })}</span>}
            </div>
          </div>

          {memory.length > 0 && (
            <div className={r.memory} title={memory.join(' · ')}>
              {tr.t('ui.memory')} · {memory.join(' · ')}
            </div>
          )}
        </section>

        <section className={`${r.ledger} ${u.in} ${u.d1}`}>
          <h2 className={r.ledgerTitle}>{tr.t('ui.result.foodLedger')}</h2>
          <div className={r.row}>
            <span className={r.muted}>{tr.t('ui.ledger.start')}</span>
            <span>{kg(foodFrom)}</span>
          </div>
          {(gains.shown.length > 0 || gains.rest) && <span className={r.group}>{tr.t('ui.ledger.gain')}</span>}
          {gains.shown.map(ledgerRow)}
          {restRow(gains.rest)}
          {(spends.shown.length > 0 || spends.rest) && <span className={r.group}>{tr.t('ui.ledger.spend')}</span>}
          {spends.shown.map(ledgerRow)}
          {restRow(spends.rest)}

          {/* 장작: 제목 줄에 시작 · 모음 · 태움 (스크롤 없는 높이를 지키려고 한 줄로). 최종은 아래 이달 말 상자에 */}
          <div className={r.woodHead}>
            <h2 className={r.ledgerTitle}>{tr.t('ui.result.woodLedger')}</h2>
            <span className={`${r.woodLine} ${r.muted}`}>
              {tr.t('ui.result.wood', { from: Math.round(woodFrom) })}
              {woodIn > 0.5 && (
                <>
                  {' · '}
                  {tr.t('ui.result.woodIn')} <span className={r.up}>{signed(woodIn)}</span>
                </>
              )}
              {woodOut < -0.5 && (
                <>
                  {' · '}
                  {tr.t('ui.result.woodOut')} <span className={r.down}>{signed(woodOut)}</span>
                </>
              )}
            </span>
          </div>

          {/* 이달 말: 최종 자원을 한 상자에 (식량·장작, 이달 바뀐 물자와 인구) */}
          <div className={r.monthEnd} data-fit="month-end">
            <span className={r.endTitle}>{tr.t(season ? 'ui.result.monthEnd.season' : 'ui.result.monthEnd')}</span>
            {endRow('food', tr.t('res.food'), kg(foodTo), tr.t('ui.top.foodDays', { days }), foodTo - foodFrom)}
            {endRow('firewood', tr.t('res.firewood'), kg(woodTo), undefined, woodTo - woodFrom)}
            {goodsEnd.length === 1 && goodsEnd.map(([id, d]) => endRow(id, resName(tr, id), unit(id, state.stores.goods[id] ?? 0), undefined, d))}
            {goodsEnd.length > 1 && (
              <div className={r.endRow} data-end="goods">
                <span className={r.endName}>{tr.t('ui.result.goods')}</span>
                <span className={`${r.endValue} ${r.endGoods}`}>
                  {goodsEnd.map(([id, d], i) => (
                    <span key={id}>
                      {i > 0 && ' · '}
                      {`${resName(tr, id)} `}
                      <span className={deltaClass(d)}>{signed(d)}</span>
                    </span>
                  ))}
                </span>
              </div>
            )}
            {popTo !== popFrom && endRow('population', tr.t('ui.result.population'), tr.t('ui.top.people', { n: popTo }), undefined, popTo - popFrom)}
          </div>
        </section>
        </div>
      </div>

      <div className={r.foot}>
        <span className={`${r.chronicle} ${u.serif}`}>
          {chronicle && (
            <>
              <span className={r.chronLabel}>{tr.t('ui.chronicle')} ·</span> {lineText(tr, chronicle)}
            </>
          )}
        </span>
        <button type="button" className={`${u.btnPrimary} ${r.next}`} onClick={onNext} autoFocus>
          {tr.t(ended ? 'ui.next.ending' : season ? 'ui.next.season' : 'ui.next.month')}
        </button>
      </div>
    </div>
  );
}
