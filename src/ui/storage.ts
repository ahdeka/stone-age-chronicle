// localStorage 자동 저장 (DESIGN.md §11). 접근이 막힌 환경에서도 게임은 돌아가야 한다.

import { deserialize, serialize, type GameState } from '../engine';

const KEY = 'sac.save';
const PREV = 'sac.save.prev';

export function autosave(state: GameState): void {
  try {
    const cur = localStorage.getItem(KEY);
    if (cur) localStorage.setItem(PREV, cur);
    localStorage.setItem(KEY, serialize(state, new Date().toISOString()));
  } catch {
    // 저장 공간이 없거나 막혀 있으면 조용히 넘어간다
  }
}

export function loadAutosave(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const r = deserialize(raw);
    return r.ok ? r.state : null;
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(PREV);
  } catch {
    // 무시
  }
}

export function downloadSave(state: GameState): void {
  const blob = new Blob([serialize(state, new Date().toISOString())], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stone-age-chronicle-${state.seed}-m${state.month}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
