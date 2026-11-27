// 발전 나무 판 (R2-b-2, 시안 docs/design/r2/tree.html). 지금 화면 위에 겹쳐 뜬다.
// 갈래 셋이 가로 줄, 칸 1~4가 왼쪽에서 오른쪽. 옆줄 위 "칸 자세히", 아래 "신석기".
// 칸 상태 넷(잠김 / 열림 / 진행 중 / 켜짐), 갈래 끝 두 겹 테두리, 진척 막대(부족 몫 초록 · 선물 빗금 · 켜짐 황토 · 눈금).
// 키보드: T·Esc 닫기, 방향키 칸 옮기기. 판이 열려 있는 동안 아래 화면(전략 팝업)의 키는 막는다.
// 숨은 칸은 여기서 고를 수 없다 (보기만 한다).

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { techView, type CellView, type ChapterDefinition, type GameState } from '../../engine';
import { TECH_ICONS } from '../../assets/techIcons';
import { useT } from '../i18n';
import {
  branchName,
  cellName,
  cellPct,
  costText,
  crewLine,
  crewWho,
  doneAtText,
  durText,
  extraText,
  giftText,
  hiddenText,
  lockText,
  logText,
  openKind,
  openName,
} from '../techText';
import { StatusBar, type StatusMode } from './StatusBar';
import t from './tree.module.css';
import u from '../ui.module.css';

export function CellIcon({ id, size = 26, dim = false }: { id: string; size?: number; dim?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path className={dim ? t.lnDim : t.ln} d={TECH_ICONS[id] ?? TECH_ICONS['none']} />
    </svg>
  );
}

/** 진척 막대: 칸의 철 수, 조각(부족 몫 w · 선물 g · 켜짐 d · 이번 턴에 저절로 찰 몫 next), 눈금 간격(철) */
export function Prog({ total, parts, step, height }: { total: number; parts: { k: 'w' | 'g' | 'd' | 'next'; v: number }[]; step: number; height?: number }) {
  const n = Math.max(1, Math.round(total / step));
  return (
    <span className={t.prog} style={height ? { height } : undefined} aria-hidden="true">
      {parts
        .filter((p) => p.v > 1e-9)
        .map((p, i) => (
          <span key={i} className={t[p.k]} style={{ width: `${Math.min(100, (100 * p.v) / total)}%` }} />
        ))}
      {Array.from({ length: n - 1 }, (_, i) => (
        <span key={`t${i}`} className={t.tick} style={{ left: `calc(${(100 * (i + 1)) / n}% - 1px)` }} />
      ))}
    </span>
  );
}

export function cellParts(v: CellView): { k: 'w' | 'g' | 'd'; v: number }[] {
  return v.status === 'done' ? [{ k: 'd', v: v.seasons }] : [{ k: 'w', v: v.worked }, { k: 'g', v: v.gifted }];
}

function StatusTag({ v }: { v: CellView }) {
  const tr = useT();
  const cls = { locked: t.tagLock, open: t.tagOpen, active: t.tagAct, done: t.tagDone }[v.status];
  return (
    <span className={`${t.tag} ${cls}`}>
      {v.status === 'locked' && <CellIcon id="lock" size={13} dim />}
      {tr.t(`ui.tree.status.${v.status}`)}
    </span>
  );
}

interface Props {
  def: ChapterDefinition;
  state: GameState;
  /** 처음 볼 칸 */
  focus?: string;
  /** 전략 팝업에서 왔다 ("← 전략으로 돌아가기") */
  fromPlan: boolean;
  /** 판 위의 지표 바: 아래 화면과 같은 기준 (월초 상황은 지금 값, 진행 중은 월초 기준) */
  barMode: StatusMode;
  onClose: () => void;
}

export function TechTree({ def, state, focus, fromPlan, barMode, onClose }: Props) {
  const tr = useT();
  const view = useMemo(() => techView(def, state, (id) => tr.has(`tech.${id}.need`)), [def, state, tr]);
  const kind = view.turnKind;
  const step = kind === 'month' ? 1 / 3 : 1;
  const lanes = view.branches.map((b) => view.cells.filter((c) => c.branch === b));
  const initial = useMemo(() => {
    const pick = focus ?? view.continuing ?? view.cells.find((c) => c.inPlan)?.id ?? view.cells.find((c) => c.status === 'active' || c.status === 'open')?.id ?? view.cells[0]?.id;
    return pick ?? '';
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [sel, setSel] = useState(initial);
  const refs = useRef(new Map<string, HTMLButtonElement>());

  // 처음 열 때 보는 칸에 초점
  useEffect(() => {
    refs.current.get(sel)?.focus();
  }, [sel]);

  // 키보드: 판이 열려 있는 동안은 판이 먼저 받는다 (아래 팝업의 1~4·Enter·Backspace·Esc를 막는다)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'Tab') return;
      const k = e.key;
      if (k === 'Escape' || k === 't' || k === 'T' || k === 'ㅅ') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      const dir = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[k] as [number, number] | undefined;
      if (dir) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const r = lanes.findIndex((l) => l.some((c) => c.id === sel));
        const c = r >= 0 ? lanes[r]!.findIndex((x) => x.id === sel) : 0;
        const nr = Math.max(0, Math.min(lanes.length - 1, r + dir[0]));
        const lane = lanes[nr]!;
        const nc = Math.max(0, Math.min(lane.length - 1, c + dir[1]));
        if (lane[nc]) setSel(lane[nc]!.id);
        return;
      }
      // 판 밖(아래 화면)의 단축키를 막는다. 전파만 막으므로 초점 단추의 Enter·Space(칸 고르기)는 그대로 된다
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [lanes, sel, onClose]);

  const selected = view.cells.find((c) => c.id === sel) ?? view.cells[0]!;

  return (
    <div className={t.overlay} role="dialog" aria-modal="true" aria-label={tr.t('ui.tree.title')} data-fit="tree">
      <StatusBar def={def} state={state} mode={barMode} compact treeOn />
      <div className={t.head}>
        <h2 className={`${t.h2} ${u.serif}`}>{tr.t('ui.tree.title')}</h2>
        <span className={t.sum}>
          {tr.t('ui.tree.sum.cells')} <b>{view.done}</b> / {view.total} · {tr.t('ui.tree.sum.ends')} <b>{view.endsDone}</b> / {view.endsNeed}
        </span>
        <div className={t.legend} aria-hidden="true">
          <span>
            <i className={t.sw} style={{ background: 'var(--growth)' }} />
            {tr.t('ui.tree.legend.worked')}
          </span>
          <span>
            <i className={`${t.sw} ${t.swGift}`} />
            {tr.t('ui.tree.legend.gift')}
          </span>
          <span>
            <i className={t.sw} style={{ background: 'var(--accent)' }} />
            {tr.t('ui.tree.legend.done')}
          </span>
          <span>
            <i className={`${t.sw} ${t.swCont}`} />
            {tr.t('ui.tree.legend.cont')}
          </span>
          <span>{tr.t(`ui.tree.legend.tick.${kind}`)}</span>
        </div>
        <button type="button" className={u.btnGhost} onClick={onClose}>
          {tr.t(fromPlan ? 'ui.tree.backPlan' : 'ui.tree.back')}
        </button>
      </div>

      <div className={t.main}>
        <div className={t.lanes}>
          {lanes.map((lane, i) => {
            const b = view.branches[i]!;
            return (
              <div key={b} className={t.lane} style={{ ['--bc' as string]: `var(--br-${b})` }}>
                <div className={t.laneHead}>
                  <b className={u.serif}>{branchName(tr, b)}</b>
                  <span>{tr.t('ui.tree.laneDone', { n: lane.filter((c) => c.status === 'done').length, m: lane.length })}</span>
                </div>
                {lane.map((v) => (
                  <CellBox
                    key={v.id}
                    def={def}
                    state={state}
                    v={v}
                    step={step}
                    kind={kind}
                    selected={v.id === sel}
                    onSelect={() => setSel(v.id)}
                    refFn={(el) => {
                      if (el) refs.current.set(v.id, el);
                      else refs.current.delete(v.id);
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>

        <div className={t.side}>
          <Detail def={def} state={state} v={selected} step={step} kind={kind} />
          <section className={`${t.panel} ${t.neo}`} data-fit="neo">
            <div className={t.neoTop}>
              <b className={u.serif}>{tr.t('ui.tree.neo')}</b>
              <span>{tr.t('ui.tree.neo.count', { n: view.endsDone, m: view.endsNeed })}</span>
            </div>
            <div className={t.slots} aria-hidden="true">
              {Array.from({ length: view.endsNeed }, (_, i) => (
                <i key={i} className={i < view.endsDone ? t.on : ''} />
              ))}
            </div>
            <div className={t.rule}>{tr.t('ui.tree.neo.rule', { n: view.endsNeed })}</div>
            <ul className={t.ends}>
              {view.branches.map((b) => {
                const end = view.cells.find((c) => c.branch === b && c.isEnd);
                if (!end) return null;
                const state2 =
                  end.status === 'done'
                    ? tr.t('ui.tree.status.done')
                    : end.status === 'active'
                      ? tr.t('ui.tree.neo.active', { pct: cellPct(end) })
                      : end.status === 'open'
                        ? tr.t('ui.tree.neo.open')
                        : lockText(tr, end.lock);
                return (
                  <li key={b} style={{ ['--bc' as string]: `var(--br-${b})` }}>
                    <i className={t.dot} />
                    <span className={t.what} title={`${tr.t('ui.tree.neo.line', { branch: branchName(tr, b), cell: cellName(tr, end.id) })} · ${state2}`}>
                      {tr.t('ui.tree.neo.line', { branch: branchName(tr, b), cell: cellName(tr, end.id) })} · <span className={end.status === 'done' ? t.ok : ''}>{state2}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>

      <div className={t.foot}>
        <span>{tr.t(`ui.tree.foot.${kind}`)}</span>
        <span className={t.keys}>{tr.t('ui.tree.keys')}</span>
      </div>
    </div>
  );
}

interface CellProps {
  def: ChapterDefinition;
  state: GameState;
  v: CellView;
  step: number;
  kind: 'month' | 'season';
  selected: boolean;
  onSelect: () => void;
  refFn: (el: HTMLButtonElement | null) => void;
}

function CellBox({ def, state, v, step, kind, selected, onSelect, refFn }: CellProps) {
  const tr = useT();
  const cls = [t.cell, t[`s_${v.status}`], v.isEnd ? t.end : '', v.continuing ? t.cont : '', selected ? t.focus : ''].filter(Boolean).join(' ');
  const opens = v.opens.map((o, i) => (
    <span key={i} className={`${t.line} ${i > 0 ? t.extra : ''}`}>
      <span className={t.k}>{openKind(tr, o)}</span>
      {openName(tr, o)}
    </span>
  ));
  const gift = giftText(tr, state, v);
  let tail: ReactNode = null;
  if (v.status === 'locked') {
    tail = (
      <>
        {gift && <span className={`${t.line} ${t.gift}`}>{gift}</span>}
        <span className={`${t.line} ${t.m}`}>
          <CellIcon id="lock" size={12} dim /> {lockText(tr, v.lock)}
        </span>
      </>
    );
  } else if (v.status !== 'done') {
    tail = v.continuing ? (
      <span className={t.line}>
        <span className={`${t.tag} ${t.tagCont}`}>{tr.t('ui.tree.cont')}</span>
      </span>
    ) : gift ? (
      <span className={`${t.line} ${t.gift}`}>{gift}</span>
    ) : v.inPlan ? (
      <span className={`${t.line} ${t.inPlan}`}>{tr.t(`ui.tree.inPlan.${kind}`)}</span>
    ) : v.hidden ? (
      <span className={`${t.line} ${t.hiddenLine}`}>{hiddenText(tr, v.hidden, v)}</span>
    ) : null;
  }
  return (
    <button type="button" ref={refFn} className={cls} aria-pressed={selected} title={cellName(tr, v.id)} onClick={onSelect} data-cell={v.id}>
      {selected && <span className={t.hereMark}>{tr.t('ui.tree.here')}</span>}
      {v.isEnd && <span className={t.endMark}>{tr.t('ui.tree.endMark')}</span>}
      <span className={t.clip} data-fit={`cell-${v.id}`}>
        <span className={t.cellTop}>
          <span className={t.ic}>
            <CellIcon id={v.id} dim={v.status === 'locked'} />
          </span>
          <span className={`${t.cellName} ${u.serif}`}>{cellName(tr, v.id)}</span>
          <StatusTag v={v} />
        </span>
        <span className={t.progRow}>
          <Prog total={v.seasons} parts={cellParts(v)} step={step} />
          <span className={t.pct}>{v.status === 'done' && v.doneMonth !== undefined ? doneAtText(tr, def, state, v.doneMonth) : `${cellPct(v)}%`}</span>
        </span>
        {v.status === 'done' ? (
          opens
        ) : v.status === 'locked' ? (
          <>
            {opens}
            {tail}
          </>
        ) : (
          <>
            <span className={`${t.line} ${t.m}`}>{crewLine(tr, state, v, kind)}</span>
            <span className={`${t.line} ${t.m} ${t.extra}`}>{costText(tr, v)}</span>
            {opens}
            {tail}
          </>
        )}
      </span>
    </button>
  );
}

function Detail({ def, state, v, step, kind }: { def: ChapterDefinition; state: GameState; v: CellView; step: number; kind: 'month' | 'season' }) {
  const tr = useT();
  const extra = extraText(tr, v.id);
  const who = crewWho(tr, state, v);
  const left = v.status === 'done' ? tr.t('ui.tree.d.leftDone') : v.planned ? tr.t('ui.tree.lock.planned') : durText(tr, Math.max(0, v.seasons - v.progress), kind);
  const log = v.log.slice(-3);
  return (
    <section className={`${t.panel} ${t.detail}`} data-fit="detail" aria-live="polite">
      <h3 className={t.dh}>{tr.t('ui.tree.detail', { branch: branchName(tr, v.branch), n: v.order })}</h3>
      <div className={`${t.dn} ${u.serif}`}>{cellName(tr, v.id)}</div>
      <div className={t.row2}>
        <StatusTag v={v} />
        {v.continuing && <span className={`${t.tag} ${t.tagCont}`}>{tr.t('ui.tree.cont')}</span>}
        {v.inPlan && <span className={`${t.tag} ${t.tagOpen}`}>{tr.t(`ui.tree.d.inPlan.${kind}`)}</span>}
      </div>
      <Prog total={v.seasons} parts={cellParts(v)} step={step} height={10} />
      <dl className={t.dl}>
        <dt>{tr.t('ui.tree.d.left')}</dt>
        <dd>{left}</dd>
        {!v.planned && v.status !== 'done' && (
          <>
            <dt>{tr.t(`ui.tree.d.per.${kind}`)}</dt>
            <dd>{[v.crew ? tr.t('ui.plan.crewN', { n: v.crew.n }) : '', who].filter(Boolean).join(' · ')}</dd>
            <dt>{tr.t('ui.tree.d.cost')}</dt>
            <dd>{costText(tr, v)}</dd>
          </>
        )}
        <dt>{tr.t('ui.tree.d.opens')}</dt>
        <dd>
          <ul className={t.opens}>
            {v.opens.map((o, i) => (
              <li key={i}>
                <span className={t.kind}>{openKind(tr, o)}</span>
                <span>{openName(tr, o)}</span>
              </li>
            ))}
            {extra && (
              <li>
                <span className={t.kind}>{tr.t('ui.tree.kind.extra')}</span>
                <span>{extra}</span>
              </li>
            )}
          </ul>
        </dd>
      </dl>
      {v.status === 'locked' && v.lock && <div className={t.note}>{lockText(tr, v.lock)}</div>}
      {v.hidden && <div className={t.note}>{hiddenText(tr, v.hidden, v)}</div>}
      {log.map((l, i) => (
        <div key={i} className={t.logline}>
          {logText(tr, def, state, l, kind)}
        </div>
      ))}
      {v.gifted > 1e-9 && !v.continuing && <div className={`${t.note} ${t.bigOnly}`}>{tr.t('ui.tree.d.note')}</div>}
    </section>
  );
}
