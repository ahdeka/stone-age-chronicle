// npm run sim -- --games 1000 --strategy random|first --months 60
// 결과를 콘솔에 요약하고 sim-report.json에 쓴다.

import { writeFileSync } from 'node:fs';
import { chapters, DEFAULT_CHAPTER } from '../src/data/registry';
import { playGame, summarize, type StrategyName } from './lib/sim';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const games = Number(arg('games', '300'));
const strategy = arg('strategy', 'random') as StrategyName;
const chapterId = arg('chapter', DEFAULT_CHAPTER);
const def = chapters[chapterId]!.definition;
const months = Number(arg('months', String(def.balance.monthLimit)));

const t0 = Date.now();
const recs = Array.from({ length: games }, (_, i) => playGame(def, `sim-${i}`, strategy, months));
const report = summarize(def, recs);
writeFileSync('sim-report.json', JSON.stringify({ chapterId, strategy, ...report }, null, 2));

const f = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '-');
console.log(`${chapterId} · ${strategy} · ${games}판 · ${((Date.now() - t0) / 1000).toFixed(1)}초`);
console.log('결말:', report.endings);
console.log(`진행 달 p10/p50/p90: ${report.months.p10}/${report.months.p50}/${report.months.p90} · 첫 겨울 멸족 ${f(report.firstWinterExtinct)}`);
for (const [w, v] of Object.entries(report.winters)) {
  console.log(
    `${w}: 도달 ${f(v.reached)} · 사망 p10/p50/p90 ${v.deaths.p10}/${v.deaths.p50}/${v.deaths.p90} · 사망 있는 판 ${f(v.anyDeath)} · 배급 감축 이상 ${f(v.hungry)} · 최저 며칠분 p50 ${f(v.minFoodDaysP50)}`,
  );
}
console.log('방침 선택률 (제시 대비):', Object.fromEntries(Object.entries(report.pickRate).map(([k, v]) => [k, f(v)])));
console.log('판당 사건:', Object.fromEntries(Object.entries(report.eventsPerGame).map(([k, v]) => [k, f(v)])));
console.log('한 번도 안 나온 사건:', report.neverFired);
console.log(`평온한 달 비율: ${f(report.quietMonthRate)}`);
console.log('자세한 결과: sim-report.json');
