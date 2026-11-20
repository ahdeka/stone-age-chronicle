// 그림 매니페스트 (DESIGN.md §11.2). 콘텐츠는 그림을 id로만 참조한다.
// 각 id는 인라인 SVG 컴포넌트(svg) 또는 이미지 파일(image) 중 하나로 연결된다.
// 나중에 일러스트로 바꿀 때는 여기서 svg를 image로 바꾸면 된다. 콘텐츠 데이터는 그대로다.

import type { ComponentType } from 'react';
import * as L from './scenes/layers';
import type { SceneId } from './sceneIds';

export type LayerKind = 'bg' | 'subject' | 'overlay' | 'portrait';

export type SceneAsset =
  | { kind: LayerKind; svg: ComponentType<L.LayerProps> }
  | { kind: LayerKind; image: string };

/** 모든 id를 빠짐없이, 더도 덜도 없이 연결한다 (sceneIds.ts와 타입으로 묶음) */
export const manifest: Record<SceneId, SceneAsset> & Record<string, SceneAsset | undefined> = {
  // 배경
  'bg.steppe': { kind: 'bg', svg: L.BgSteppe },
  'bg.river_ford': { kind: 'bg', svg: L.BgRiverFord },
  'bg.camp_tents': { kind: 'bg', svg: L.BgCampTents },
  'bg.north_forest': { kind: 'bg', svg: L.BgNorthForest },
  'bg.cave_mouth': { kind: 'bg', svg: L.BgCaveMouth },
  'bg.cave_inside': { kind: 'bg', svg: L.BgCaveInside },
  'bg.marsh': { kind: 'bg', svg: L.BgMarsh },
  'bg.reed_lake': { kind: 'bg', svg: L.BgReedLake },
  // 대상
  'sub.reindeer_herd': { kind: 'subject', svg: L.SubReindeerHerd },
  'sub.reindeer_run': { kind: 'subject', svg: L.SubReindeerRun },
  'sub.hunters': { kind: 'subject', svg: L.SubHunters },
  'sub.gatherers': { kind: 'subject', svg: L.SubGatherers },
  'sub.fire_circle': { kind: 'subject', svg: L.SubFireCircle },
  'sub.camp_far': { kind: 'subject', svg: L.SubCampFar },
  'sub.firewood': { kind: 'subject', svg: L.SubFirewood },
  'sub.wolves': { kind: 'subject', svg: L.SubWolves },
  'sub.wolf_eyes': { kind: 'subject', svg: L.SubWolfEyes },
  'sub.strangers': { kind: 'subject', svg: L.SubStrangers },
  'sub.messenger': { kind: 'subject', svg: L.SubMessenger },
  'sub.reeds': { kind: 'subject', svg: L.SubReeds },
  // 날씨와 때
  'ov.dusk': { kind: 'overlay', svg: L.OvDusk },
  'ov.night': { kind: 'overlay', svg: L.OvNight },
  'ov.snow': { kind: 'overlay', svg: L.OvSnow },
  'ov.blizzard': { kind: 'overlay', svg: L.OvBlizzard },
  'ov.fog': { kind: 'overlay', svg: L.OvFog },
  'ov.rain': { kind: 'overlay', svg: L.OvRain },
  // 초상 (조언자 자리별 색)
  'portrait.hunt_leader': { kind: 'portrait', svg: L.makePortrait('#c9813a') },
  'portrait.elder': { kind: 'portrait', svg: L.makePortrait('#a9b8c9') },
  'portrait.healer': { kind: 'portrait', svg: L.makePortrait('#b9a35a') },
  'portrait.artisan': { kind: 'portrait', svg: L.makePortrait('#8fa87a') },
  'portrait.chief': { kind: 'portrait', svg: L.makePortrait('#e0a15a') },
};

export { SCENE_IDS } from './sceneIds';
