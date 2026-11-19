// 턴 처리 (DESIGN.md §3). 이 파일의 단계 순서가 곧 명세다. 순서를 바꾸면 문서를 먼저 고친다.
// 모든 함수는 reduce가 넘겨준 복제본을 제자리에서 바꾼다.

import type { ChapterDefinition, GameState, RoleOutput } from '../types';
import { allTrue } from '../conditions/evaluate';
import { addResource, applyEffects, type EffectCtx } from '../effects/apply';
import { nextFloat } from '../rng/rng';
import { stat } from '../stats/stats';
import { clamp, round4 } from './lookup';
import { changePopulation } from './population';

function ctx(def: ChapterDefinition, state: GameState, source: string): EffectCtx {
  return { def, state, source };
}

// ───────────────────────── [A] 계절 시작 ─────────────────────────

export function beginTurn(def: ChapterDefinition, s: GameState): void {
  // A1. 턴과 계절
  s.turn += 1;
  const season = def.seasons[(s.turn - 1) % def.seasons.length];
  if (!season) throw new Error('chapter has no seasons');
  s.season = season.id;
  s.turnLog = [];

  // A2. 만료된 임시 모디파이어 제거
  s.modifiers = s.modifiers.filter((m) => m.lastTurn >= s.turn);

  // A3. 계절 효과: 계절 모디파이어는 getStat이 현재 계절을 보고 자동으로 켠다.
  // A4. 전통 axisDrift (M4) / A5. 이웃 AI (M5) / A6. 이벤트 뽑기 (M2)
  // A7. 턴 시작 스냅샷: turnLog를 비우는 것으로 대신한다 (요약은 로그에서 계산).

  // [C] 행동 단계 준비 — 이벤트가 생기면(M2) phase='event'가 먼저 온다
  const a = def.balance.actions;
  s.actions.playsLeft = clamp(Math.round(stat(def, s, a.stat)), a.min, a.max);
  s.phase = 'action';
}

// ───────────────────────── [D] 결산 ─────────────────────────

function roleOutputAmount(def: ChapterDefinition, s: GameState, workers: number, out: RoleOutput): number {
  let amount = workers * stat(def, s, out.stat);
  if (out.bonusFrom) {
    const pop = Math.max(1, s.tribe.population);
    const perCapita = (s.tribe.resources[out.bonusFrom.resource] ?? 0) / pop;
    amount *= 1 + Math.min(perCapita, out.bonusFrom.perCapitaCap) * out.bonusFrom.weight;
  }
  if (out.depletes) {
    const dep = s.regions.state[s.regions.current]?.depletion ?? 0;
    amount *= 1 - dep;
  }
  if (out.variance && workers > 0) {
    // 일하는 사람이 없으면 난수를 뽑지 않는다 → 배분에 따라 난수 소비량이 달라지지만,
    // 같은 커맨드 열이면 같은 소비이므로 재현성은 유지된다.
    amount *= 1 + (nextFloat(s.rng) * 2 - 1) * out.variance;
  }
  return Math.max(0, amount);
}

/** D2. 생산 — 역할 정의 순서대로 */
function produce(def: ChapterDefinition, s: GameState): void {
  for (const role of def.roles) {
    const workers = s.tribe.roles[role.id] ?? 0;
    for (const out of role.outputs) {
      const amount = roleOutputAmount(def, s, workers, out);
      const gained = addResource(ctx(def, s, `role.${role.id}`), out.resource, amount);
      const counter = def.balance.totalCounters[out.resource];
      if (counter !== undefined && gained > 0) s.counters[counter] = round4((s.counters[counter] ?? 0) + gained);
    }
  }
}

/** D3. 소비와 마모. 부족분은 굶주림 판정을 위해 돌려준다 */
function consume(def: ChapterDefinition, s: GameState): Record<string, number> {
  const shortage: Record<string, number> = {};
  for (const u of def.balance.upkeep) {
    const need = s.tribe.population * stat(def, s, u.perCapitaStat);
    const have = s.tribe.resources[u.resource] ?? 0;
    if (need > have) shortage[u.resource] = round4(need - have);
    addResource(ctx(def, s, `upkeep.${u.resource}`), u.resource, -need);
  }
  return shortage;
}

/** D4. 저장 상한과 부패 */
function store(def: ChapterDefinition, s: GameState): void {
  for (const st of def.balance.storage) {
    const c = ctx(def, s, `storage.${st.resource}`);
    const cap = s.tribe.population * stat(def, s, st.capPerCapitaStat);
    const have = s.tribe.resources[st.resource] ?? 0;
    if (have > cap) addResource(c, st.resource, cap - have);
    const spoil = (s.tribe.resources[st.resource] ?? 0) * stat(def, s, st.spoilStat);
    if (spoil > 0) addResource(ctx(def, s, `spoil.${st.resource}`), st.resource, -spoil);
  }
}

/** D5. 굶주림 */
function starve(def: ChapterDefinition, s: GameState, shortage: Record<string, number>): void {
  const b = def.balance.starvation;
  const deficit = shortage[b.resource] ?? 0;
  if (deficit <= 0) {
    s.tribe.hunger = 0;
    return;
  }
  s.tribe.hunger += 1;
  const c = ctx(def, s, 'starvation');
  addResource(c, def.balance.cohesionResource, -deficit * b.cohesionPerDeficit);
  if (s.tribe.hunger >= b.hungerTurnsForLoss) {
    const loss = Math.max(1, Math.ceil(s.tribe.population * b.popLossRate));
    const applied = changePopulation(def, s, -loss);
    if (applied !== 0) s.turnLog.push({ kind: 'population', delta: applied, source: 'starvation' });
  }
}

/** D6. 인구 증가 */
function grow(def: ChapterDefinition, s: GameState): void {
  const g = def.balance.growth;
  const cohesion = s.tribe.resources[def.balance.cohesionResource] ?? 0;
  if (s.tribe.hunger > 0 || cohesion < g.cohesionMin || s.tribe.population <= 0) return;
  s.tribe.growth = round4(s.tribe.growth + s.tribe.population * stat(def, s, g.rateStat));
  let born = 0;
  while (s.tribe.growth >= 1) {
    s.tribe.growth = round4(s.tribe.growth - 1);
    born += 1;
  }
  if (born > 0) {
    const applied = changePopulation(def, s, born);
    s.turnLog.push({ kind: 'population', delta: applied, source: 'growth' });
  }
}

/** D7. 도래한 지연 효과 — 등록 순서대로 */
function runDelayed(def: ChapterDefinition, s: GameState): void {
  const due = s.delayed.filter((d) => d.dueTurn <= s.turn).sort((a, b) => a.seq - b.seq);
  s.delayed = s.delayed.filter((d) => d.dueTurn > s.turn);
  for (const d of due) applyEffects(ctx(def, s, d.sourceKey), d.effects);
}

/** D8. 지역 고갈: 머무는 곳은 쌓이고 떠난 곳은 회복된다 */
function deplete(def: ChapterDefinition, s: GameState): void {
  const d = def.balance.depletion;
  for (const id of s.regions.discovered) {
    const rs = (s.regions.state[id] ??= { depletion: 0 });
    rs.depletion =
      id === s.regions.current
        ? round4(Math.min(d.max, rs.depletion + d.perTurn))
        : round4(Math.max(0, rs.depletion - d.recoverPerTurn));
  }
}

/** D9. 인물: 생애 단계 진행 (사망·출생·계승은 M3) — id 순으로 처리 */
function agePeople(def: ChapterDefinition, s: GameState): void {
  for (const id of Object.keys(s.people).sort()) {
    const p = s.people[id];
    if (!p || !p.alive) continue;
    p.stageTurns += 1;
    const stage = def.lifeStages.find((x) => x.id === p.stage);
    if (stage?.next && p.stageTurns >= stage.turnsToNext) {
      p.stage = stage.next;
      p.stageTurns = 0;
      s.turnLog.push({ kind: 'stage', personId: p.id, to: p.stage, source: 'aging' });
    }
  }
}

/** D11. 결말 판정 — priority 높은 순 */
function checkEndings(def: ChapterDefinition, s: GameState): void {
  const sorted = [...def.content.endings].sort((a, b) => b.priority - a.priority);
  for (const e of sorted) {
    if (allTrue(def, s, e.check)) {
      s.ending = { id: e.id, kind: e.kind, turn: s.turn };
      return;
    }
  }
}

export function resolveTurn(def: ChapterDefinition, s: GameState): void {
  // D1. 손패 정리 (M2)
  produce(def, s); // D2
  const shortage = consume(def, s); // D3
  store(def, s); // D4
  starve(def, s, shortage); // D5
  grow(def, s); // D6
  runDelayed(def, s); // D7
  deplete(def, s); // D8
  agePeople(def, s); // D9
  // D10. 이웃 상태 갱신 (M5)
  checkEndings(def, s); // D11
  // D12. 연대기 문장 확정 (M2)

  // D13. 요약을 굳히고 다음 턴으로
  s.history.push({ turn: s.turn, season: s.season, reign: s.reign, log: s.turnLog });
  if (s.ending) {
    s.phase = 'ended';
    return;
  }
  beginTurn(def, s);
}
