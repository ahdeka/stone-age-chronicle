// npm run sim -- --games 1000 --strategy random|fixed [--seed base] [--chapter ch1]

import { writeFileSync } from 'node:fs';
import { DEFAULT_CHAPTER, getChapter } from '../src/data/registry';
import { runSim, type Strategy } from './lib/sim';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const games = Number(arg('games', '200'));
const strategy = arg('strategy', 'random') as Strategy;
const seed = arg('seed', 'sim');
const chapterId = arg('chapter', DEFAULT_CHAPTER);

if (!['random', 'fixed'].includes(strategy)) {
  console.error(`알 수 없는 전략: ${strategy} (random | fixed, greedy는 M6)`);
  process.exit(1);
}
const entry = getChapter(chapterId);
if (!entry) {
  console.error(`알 수 없는 장: ${chapterId}`);
  process.exit(1);
}

const t0 = Date.now();
const r = runSim(entry.definition, { games, strategy, seed, checkpoints: [4, 12, 24, 30, 36, 48] });
const ms = Date.now() - t0;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

console.log(`\n== 시뮬레이션: ${chapterId}, ${games}판, 전략 ${strategy}, 시드 ${seed} (${ms}ms) ==`);
console.log(`평균 종료 턴: ${r.avgFinalTurn}   턴당 이벤트: ${r.eventsPerTurn}`);
console.log('결말 분포:');
for (const [id, n] of Object.entries(r.endings).sort((a, b) => b[1] - a[1]))
  console.log(`  ${id.padEnd(16)} ${String(n).padStart(5)}  (${pct(n / games)})`);
console.log(`굶주린 턴 비율: ${pct(r.hungryTurnRate)}   겨울 직후 굶주림: ${pct(r.winterHungerRate)}   굶주림으로 인구를 잃은 판: ${pct(r.popLossGameRate)}`);

console.log('\n자원 추이 (p10 / p50 / p90):');
const keys = Object.keys(r.checkpoints[4] ?? {});
console.log(`  ${'턴'.padEnd(4)}${keys.map((k) => k.padStart(17)).join('')}`);
for (const [turn, bucket] of Object.entries(r.checkpoints)) {
  const cells = keys.map((k) => {
    const q = bucket[k];
    return (q ? `${q.p10}/${q.p50}/${q.p90}` : '-').padStart(17);
  });
  console.log(`  ${turn.padEnd(4)}${cells.join('')}`);
}

console.log('\n이벤트별 판당 발생:');
for (const [id, v] of Object.entries(r.eventRates).sort((a, b) => b[1] - a[1])) console.log(`  ${id.padEnd(20)} ${v}`);
console.log(`한 번도 나오지 않은 이벤트: ${r.neverFired.length ? r.neverFired.join(', ') : '없음'}`);

console.log('\n카드별 판당 사용:');
for (const [id, v] of Object.entries(r.cardRates).sort((a, b) => b[1] - a[1])) console.log(`  ${id.padEnd(22)} ${v}`);

const shown = r.optionStats.filter((o) => o.picked > 0);
const byLift = [...shown].sort((a, b) => b.popLift - a.popLift);
console.log('\n선택지와 최종 인구의 상관 (popLift = 고른 판의 평균 최종 인구 / 전체 평균):');
console.log('  높은 쪽 (지배적 선택지 후보):');
for (const o of byLift.slice(0, 6)) console.log(`    ${`${o.eventId}.${o.optionId}`.padEnd(36)} lift ${o.popLift}  선택 ${o.picked}/${o.shown}`);
console.log('  낮은 쪽:');
for (const o of byLift.slice(-6)) console.log(`    ${`${o.eventId}.${o.optionId}`.padEnd(36)} lift ${o.popLift}  선택 ${o.picked}/${o.shown}`);
const neverPicked = r.optionStats.filter((o) => o.picked === 0).map((o) => `${o.eventId}.${o.optionId}`);
console.log(`한 번도 고르지 않은(또는 못한) 선택지: ${neverPicked.length ? neverPicked.join(', ') : '없음'}`);

console.log('\n아직 측정할 수 없는 항목:');
for (const x of r.notYetMeasurable) console.log(`  - ${x}`);

writeFileSync('sim-report.json', JSON.stringify(r, null, 2));
console.log('\nsim-report.json 저장');
