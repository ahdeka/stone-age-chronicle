import { describe, expect, it } from 'vitest';
import { manifest } from './manifest';
import { SCENE_ID_LIST } from './sceneIds';

describe('그림 매니페스트', () => {
  it('id 목록과 매니페스트가 정확히 같다', () => {
    expect(Object.keys(manifest).sort()).toEqual([...SCENE_ID_LIST].sort());
  });

  it('각 항목은 SVG 컴포넌트 또는 이미지 파일 중 하나로 연결된다', () => {
    for (const [id, a] of Object.entries(manifest)) {
      expect(a, id).toBeDefined();
      expect('svg' in a! !== 'image' in a!, id).toBe(true);
    }
  });
});
