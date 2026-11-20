// 그림 id 목록 (React와 CSS 없이 읽을 수 있게 따로 둔다 — 콘텐츠 검증기가 쓴다).
// manifest.ts는 이 목록의 모든 id를 정확히 연결해야 한다 (타입으로 검사).

export const SCENE_ID_LIST = [
  'bg.steppe',
  'bg.river_ford',
  'bg.camp_tents',
  'bg.north_forest',
  'bg.cave_mouth',
  'bg.cave_inside',
  'bg.marsh',
  'bg.reed_lake',
  'sub.reindeer_herd',
  'sub.reindeer_run',
  'sub.hunters',
  'sub.gatherers',
  'sub.fire_circle',
  'sub.camp_far',
  'sub.firewood',
  'sub.wolves',
  'sub.wolf_eyes',
  'sub.strangers',
  'sub.messenger',
  'sub.reeds',
  'ov.dusk',
  'ov.night',
  'ov.snow',
  'ov.blizzard',
  'ov.fog',
  'ov.rain',
  'portrait.hunt_leader',
  'portrait.elder',
  'portrait.healer',
  'portrait.artisan',
  'portrait.chief',
] as const;

export type SceneId = (typeof SCENE_ID_LIST)[number];

export const SCENE_IDS: ReadonlySet<string> = new Set(SCENE_ID_LIST);
