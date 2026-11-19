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
  console.error(`알 수 없는 전략: ${strategy} (M1: random | fixed, greedy는 M6)`);
  process.exit(1);
}
const entry = getChapter(chapterId);
if (!entry) {
  console.error(`알 수 없는 장: ${chapterId}`);
  process.exit(1);
}

const t0 = Date.now();
const report = runSim(entry.definition, { games, strategy, seed, checkpoints: [4, 12, 24, 36, 48] });
const ms = Date.now() - t0;

console.log(`\n== 시뮬레이션: ${chapterId}, ${games}판, 전략 ${strategy}, 시드 ${seed} (${ms}ms) ==`);
console.log(`평균 종료 턴: ${report.avgFinalTurn}`);
console.log('결말 분포:');
for (const [id, n] of Object.entries(report.endings).sort((a, b) => b[1] - a[1]))
  console.log(`  ${id.padEnd(16)} ${String(n).padStart(5)}  (${((n / games) * 100).toFixed(1)}%)`);
console.log(`굶주린 턴 비율: ${(report.hungryTurnRate * 100).toFixed(1)}%`);
console.log(`굶주림으로 인구를 잃은 판: ${(report.popLossGameRate * 100).toFixed(1)}%`);
console.log('\n자원 추이 (p10 / p50 / p90):');
const keys = Object.keys(report.checkpoints[4] ?? {});
console.log(`  ${'턴'.padEnd(4)} ${keys.map((k) => k.padStart(18)).join('')}`);
for (const [turn, bucket] of Object.entries(report.checkpoints)) {
  const cells = keys.map((k) => {
    const q = bucket[k];
    return (q ? `${q.p10}/${q.p50}/${q.p90}` : '-').padStart(18);
  });
  console.log(`  ${turn.padEnd(4)} ${cells.join('')}`);
}

writeFileSync('sim-report.json', JSON.stringify(report, null, 2));
console.log('\nsim-report.json 저장');
