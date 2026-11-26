// npm run sim -- --games 100 --strategy random|first|sure --turns 20 [--preset id]
// 턴: 1년차는 한 달 = 1턴(12턴), 2년차부터 한 철 = 1턴. 기본 20턴 = 1년차 + 2년. (--months는 예전 이름, --turns와 같다)
// 결과를 콘솔에 요약하고 sim-report.json에 쓴다.

import { writeFileSync } from 'node:fs';
import { chapters, DEFAULT_CHAPTER } from '../src/data/registry';
import { CAL_ORDER, playGame, summarize, type StrategyName } from './lib/sim';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const games = Number(arg('games', '300'));
const strategy = arg('strategy', 'random') as StrategyName;
const chapterId = arg('chapter', DEFAULT_CHAPTER);
const presetId = arg('preset', '') || undefined;
const def = chapters[chapterId]!.definition;
const turns = Number(arg('turns', arg('months', '20')));

const t0 = Date.now();
const recs = Array.from({ length: games }, (_, i) => playGame(def, `sim-${i}`, strategy, turns, presetId));
const report = summarize(def, recs);
writeFileSync('sim-report.json', JSON.stringify({ chapterId, strategy, presetId, ...report }, null, 2));

const f = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const r1 = (x: number) => (Math.abs(x) < 0.05 ? '.' : x.toFixed(1));
const cell = (s: string, w = 6) => s.padStart(w);
console.log(`${chapterId} · ${strategy} · ${games}판 · ${turns}턴 · ${((Date.now() - t0) / 1000).toFixed(1)}초`);
console.log('결말:', report.endings);
console.log(`진행 턴 p10/p50/p90: ${report.turns.p10}/${report.turns.p50}/${report.turns.p90} · 달 p50 ${report.months.p50} · 첫 겨울 멸족 ${f(report.firstWinterExtinct)}`);
console.log(`신석기: ${f(report.neolithic.rate)} · 도달 턴 p50 ${report.neolithic.turnP50 ?? '-'}`);
console.log('\n해별 (그 해에 닿은 판 기준)');
console.log(['해', '도달', '턴', '사망p50', '사망p90', '감축순', '굶주림순', '칸p10', '칸p50', '칸p90', '결속p50'].map((x, i) => (i === 0 ? x.padEnd(4) : cell(x, 8))).join(''));
for (const [yr, v] of Object.entries(report.years)) {
  console.log([`${yr}년차`.padEnd(4), f(v.reached), String(v.turnsP50), String(v.deaths.p50), String(v.deaths.p90), f(v.reducedRate), f(v.starveRate), String(v.cellsDone.p10), String(v.cellsDone.p50), String(v.cellsDone.p90), String(Math.round(v.cohesionEndP50))].map((x, i) => (i === 0 ? x : cell(x, 8))).join(''));
}
console.log(`첫 겨울 전 사망 p50 ${report.preWinterDeaths.p50} · p90 ${report.preWinterDeaths.p90} · 사망 있는 판 ${f(report.preWinterDeaths.anyDeath)}`);
for (const [w, v] of Object.entries(report.winters)) {
  if (v.reached === 0) continue;
  console.log(
    `${w}: 도달 ${f(v.reached)} · 사망 p10/p50/p90 ${v.deaths.p10}/${v.deaths.p50}/${v.deaths.p90} · 사망 있는 판 ${f(v.anyDeath)} · 배급 감축 이상 ${f(v.hungry)} · 굶주림 ${f(v.starved)} · 최저 며칠치 p50 ${f(v.minFoodDaysP50)}`,
  );
}
console.log(['월초 식량 며칠치 p50'.padEnd(22), ...CAL_ORDER.map((c) => cell(r1(report.startFoodDaysP50[c] ?? NaN)))].join(''));
console.log('\n결속 경로 (판당 평균, 첫 해)');
console.log(['출처'.padEnd(22), ...CAL_ORDER.map((c) => cell(`${c}월`)), cell('합', 7)].join(''));
for (const [src, row] of Object.entries(report.cohesionPaths)) {
  if (Math.abs(row.total) < 0.05) continue;
  console.log([src.padEnd(22), ...CAL_ORDER.map((c) => cell(r1(row[c] ?? 0))), cell(r1(row.total), 7)].join(''));
}
console.log('\n방침 선택률 (제시 대비):', Object.fromEntries(Object.entries(report.pickRate).map(([k, v]) => [k, f(v)])));
console.log('판당 사건:', Object.fromEntries(Object.entries(report.eventsPerGame).map(([k, v]) => [k, f(v)])));
console.log('한 번도 안 나온 사건:', report.neverFired);
console.log(`평온한 달 비율: ${f(report.quietMonthRate)}`);
console.log('자세한 결과: sim-report.json');
