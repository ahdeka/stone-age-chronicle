// 인트로 (화면 시안 Main): 풍경이 서서히 나타남 → 배경 설명 8줄 타이핑(55ms/글자, 줄 사이 650ms)
// → 지나간 줄은 흐리게 → 부족 이름과 "첫 달을 시작한다". 건너뛰기, 남은 초, 진행 막대, 다시 보기.
// 문장은 시작 프리셋의 브리핑 데이터에서 온다.

import { useEffect } from 'react';
import { countBand, foodDays, monthDef, population, type ChapterDefinition, type GameState } from '../../engine';
import { Caret } from '../components/bits';
import { SceneView } from '../components/SceneView';
import { dateText, tribeDisplayName } from '../format';
import { typedLines, typeSchedule, useClock } from '../hooks/useClock';
import { useT } from '../i18n';
import { useMotion } from '../motion';
import i from './intro.module.css';
import u from '../ui.module.css';

interface Props {
  def: ChapterDefinition;
  state: GameState;
  onStart: () => void;
}

export function IntroScreen({ def, state, onStart }: Props) {
  const tr = useT();
  const { mul } = useMotion();
  const preset = def.presets.find((p) => p.id === state.presetId) ?? def.presets[0]!;
  const pres = preset.presentation;
  const m = monthDef(def, state);
  const params = {
    pop: population(state),
    adults: countBand(def, state, 'adult'),
    elders: countBand(def, state, 'elder'),
    children: countBand(def, state, 'child'),
    days: Math.floor(foodDays(def, state)),
    tents: state.shelter.units,
    /** 이야기 문장(인트로 줄)에서 쓰는 달 이름 */
    month: tr.t(`month.${m.id}`),
    when: tr.t(`month.${m.id}.when`),
    /** 화면 정보(제목 위 한 줄)에서 쓰는 날짜 */
    date: dateText(tr, def, state),
  };
  const lines = pres.introLines.map((k) => tr.t(k, params));
  const perChar = 55 * mul;
  const sched = typeSchedule(lines, { startAt: 1600 * mul, perChar, gap: 650 * mul });
  const end = sched.end + 400 * mul;
  const clock = useClock(end, 'intro');
  const typed = typedLines(lines, sched, clock.elapsed, perChar);
  const showTitle = clock.done;
  const current = typed.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      if (!clock.done) clock.skip();
      else onStart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clock, onStart]);

  return (
    <div className={i.page}>
      <div className={i.scene}>
        <SceneView scene={def.scenes.intro} align="xMaxYMax" />
      </div>
      <div className={i.shade} aria-hidden="true" />

      <div className={i.top}>
        <p className={i.chapter}>{tr.t(pres.chapterLabel)}</p>
        {!showTitle && (
          <div className={i.topRight}>
            <span className={u.muted}>{tr.t('ui.intro.seconds', { n: Math.max(0, Math.ceil((end - clock.elapsed) / 1000)) })}</span>
            <button type="button" className={`${u.btnGhost} ${i.skip}`} onClick={clock.skip}>
              {tr.t('ui.intro.skip')}
            </button>
          </div>
        )}
      </div>

      {!showTitle ? (
        <div className={i.lines} aria-live="polite">
          {typed.map((l, n) => (
            <p key={n} className={`${i.line} ${u.serif} ${n === current ? i.now : i.past}`}>
              {l.text}
              {l.typing && <Caret />}
            </p>
          ))}
          <div className="visually-hidden">{lines.join(' ')}</div>
        </div>
      ) : (
        <div className={i.titleWrap}>
          <p className={`${i.meta} ${i.later}`}>{tr.t(pres.meta, params)}</p>
          <h1 className={`${i.title} ${u.serif}`}>{tribeDisplayName(tr, def, state)}</h1>
          <p className={`${i.tagline} ${u.serif} ${i.later}`}>{tr.t(pres.tagline)}</p>
          <div className={`${i.buttons} ${i.later2}`}>
            <button type="button" className={u.btnPrimary} onClick={onStart} autoFocus>
              {tr.t('ui.intro.start')}
            </button>
            <button type="button" className={u.btnGhost} onClick={clock.replay}>
              {tr.t('ui.intro.replay')}
            </button>
          </div>
        </div>
      )}

      <div className={i.progress} aria-hidden="true">
        <div className={i.progressFill} style={{ width: `${Math.min(100, Math.round((clock.elapsed / end) * 100))}%` }} />
      </div>
    </div>
  );
}
